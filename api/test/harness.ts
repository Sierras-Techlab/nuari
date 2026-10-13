import 'reflect-metadata';
import { randomInt, randomUUID } from 'node:crypto';
import { createHmac } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.config.js';
import { Clock } from '../src/common/clock.js';
import { RateLimiter } from '../src/common/rate-limiter.js';
import { SecurityConfig } from '../src/common/security.config.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { EmailSender, type EmailMessage } from '../src/integrations/email-sender.js';
import { EmailDispatcher } from '../src/integrations/email-dispatcher.js';
import { IdentityService } from '../src/identity/identity.service.js';
import { OrganizationsService } from '../src/organizations/organizations.service.js';
import { SubscriptionsService } from '../src/subscriptions/subscriptions.service.js';

export class MutableClock extends Clock {
  constructor(private instant: Date = new Date()) { super(); }
  now(): Date { return new Date(this.instant); }
  set(value: Date | string): void { this.instant = new Date(value); }
  advance(milliseconds: number): void { this.instant = new Date(this.instant.getTime() + milliseconds); }
}

export class CapturingEmailSender extends EmailSender {
  readonly messages: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> { this.messages.push({ ...message }); }
  token(email: string, purpose: 'verify-email' | 'reset-password'): string {
    const message = this.messages.findLast(item => item.to === email && item.text.includes(`/${purpose}#`));
    if (!message) throw new Error('Test email was not dispatched.');
    const token = new URL(message.text).hash.slice('#token='.length);
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('Invalid test email token.');
    return token;
  }
}

export function isolatedDatabaseEnvironment(env: NodeJS.ProcessEnv = process.env): { databaseUrl: string; directUrl: string } {
  const databaseUrl = env.TEST_DATABASE_URL;
  const directUrl = env.TEST_DIRECT_URL;
  if (!databaseUrl || !directUrl) throw new Error('TEST_DATABASE_URL and TEST_DIRECT_URL are required; database suites never use runtime credentials.');
  // Opt-in explícito para la rama Neon `dev` compartida: el id de endpoint debe coincidir exactamente (con o sin `-pooler`).
  const sharedDevEndpoint = env.TEST_DATABASE_SHARED_DEV_ENDPOINT;
  if (sharedDevEndpoint !== undefined && !/^ep-[a-z0-9-]+$/.test(sharedDevEndpoint)) throw new Error('Invalid shared development endpoint.');
  const normalizedHost = (url: URL): string => url.hostname.replace(/^(ep-[a-z0-9-]+?)-pooler\./, '$1.');
  const validate = (value: string): URL => {
    let url: URL;
    try { url = new URL(value); } catch { throw new Error('Invalid isolated test database configuration.'); }
    const protocolOk = ['postgres:', 'postgresql:'].includes(url.protocol) && (url.searchParams.get('schema') ?? 'public') === 'public';
    const loopbackOk = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && /^\/(?:[a-z0-9_]*test[a-z0-9_]*|nuari_task07)$/.test(url.pathname);
    const sharedDevOk = sharedDevEndpoint !== undefined && normalizedHost(url).startsWith(`${sharedDevEndpoint}.`) && url.hostname.endsWith('.neon.tech');
    if (!protocolOk || !(loopbackOk || sharedDevOk)) throw new Error('Database suites require a loopback-only explicitly named isolated test database.');
    return url;
  };
  const database = validate(databaseUrl);
  const direct = validate(directUrl);
  if (normalizedHost(database) !== normalizedHost(direct) || database.port !== direct.port || database.pathname !== direct.pathname) throw new Error('Test runtime and migration URLs must target the same isolated database.');
  return { databaseUrl, directUrl };
}

type BucketKey = { scope: string; keyHash: string; windowStartedAt: Date };
class TrackingRateLimiter extends RateLimiter {
  readonly keys = new Map<string, BucketKey>();
  constructor(db: PrismaService, private readonly testClock: Clock, private readonly testConfig: SecurityConfig) { super(db, testClock, testConfig); }
  override async consume(scope: string, identifier: string, limit: number, windowMs: number): Promise<void> {
    const windowStartedAt = new Date(Math.floor(this.testClock.now().getTime() / windowMs) * windowMs);
    const keyHash = createHmac('sha256', this.testConfig.rateLimitSecret).update(`${scope}:${identifier}`).digest('hex');
    this.keys.set(`${scope}:${keyHash}:${windowStartedAt.toISOString()}`, { scope, keyHash, windowStartedAt });
    await super.consume(scope, identifier, limit, windowMs);
  }
}

export type ApiHarness = Awaited<ReturnType<typeof createApiHarness>>;
export async function createApiHarness(options: { clock?: MutableClock; emailSender?: CapturingEmailSender } = {}) {
  const env = isolatedDatabaseEnvironment();
  // Override before constructing Prisma. No dotenv import and no runtime DB fallback.
  process.env.DATABASE_URL = env.databaseUrl;
  process.env.DIRECT_URL = env.directUrl;
  const clock = options.clock ?? new MutableClock(new Date(Date.UTC(2035, 0, 1) + randomInt(0, 100_000) * 3_600_000));
  const emailSender = options.emailSender ?? new CapturingEmailSender();
  const fixture = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(Clock).useValue(clock)
    .overrideProvider(EmailSender).useValue(emailSender)
    .overrideProvider(RateLimiter).useFactory({ factory: (db: PrismaService, value: Clock, config: SecurityConfig) => new TrackingRateLimiter(db, value, config), inject: [PrismaService, Clock, SecurityConfig] })
    .compile();
  const app = fixture.createNestApplication<NestExpressApplication>({ bodyParser: false });
  app.useLogger(false);
  configureApp(app);
  await app.init();
  const db = app.get(PrismaService);
  try {
    await db.$connect();
    const migrations = await db.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL`;
    if (Number(migrations[0]?.count) < 3) throw new Error('Deploy the three API migrations to the isolated test database first.');
  } catch {
    await app.close();
    throw new Error('Isolated test PostgreSQL is unavailable or migrations are missing. Runtime credentials were not used.');
  }
  const runId = randomUUID().replaceAll('-', '');
  const ownedUsers = new Set<string>();
  const ownedOrganizations = new Set<string>();
  const identity = app.get(IdentityService);
  const organizations = app.get(OrganizationsService);
  const subscriptions = app.get(SubscriptionsService);
  const dispatcher = app.get(EmailDispatcher);
  const rateLimiter = app.get<TrackingRateLimiter>(RateLimiter);

  async function user(options: { verified?: boolean; email?: string; password?: string } = {}) {
    const email = options.email ?? `${randomUUID().slice(0, 16)}-${runId}@example.test`;
    const password = options.password ?? 'correct horse battery staple';
    await identity.register({ name: 'Test User', email, password });
    const record = await db.user.findUniqueOrThrow({ where: { email } });
    ownedUsers.add(record.id);
    await dispatcher.drain();
    if (options.verified !== false) await identity.confirmVerification(emailSender.token(email, 'verify-email'));
    const login = await identity.login(email, password);
    const principal = await identity.authenticate(login.token);
    return { ...record, email, password, token: login.token, principal };
  }

  async function cleanupFixtures(userIds = [...ownedUsers], organizationIds = [...ownedOrganizations]): Promise<void> {
    await dispatcher.drain();
    const [grantOrganizations, memberOrganizations] = await Promise.all([
      db.trialGrant.findMany({ where: { userId: { in: userIds } }, select: { organizationId: true } }),
      db.organizationMember.findMany({ where: { userId: { in: userIds } }, select: { organizationId: true } }),
    ]);
    const orgIds = [...new Set([
      ...organizationIds,
      ...grantOrganizations.map(row => row.organizationId),
      ...memberOrganizations.map(row => row.organizationId),
    ])];
    await db.$transaction(async tx => {
      await tx.onboardingSubmission.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { organizationId: { in: orgIds } }] } });
      await tx.trialGrant.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { organizationId: { in: orgIds } }] } });
      await tx.organizationMember.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { organizationId: { in: orgIds } }] } });
      await tx.subscription.deleteMany({ where: { organizationId: { in: orgIds } } });
      await tx.session.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { activeOrganizationId: { in: orgIds } }] } });
      await tx.organization.deleteMany({ where: { id: { in: orgIds } } });
      await tx.user.deleteMany({ where: { id: { in: userIds } } });
    });
    for (const id of userIds) ownedUsers.delete(id);
    for (const id of orgIds) ownedOrganizations.delete(id);
  }
  async function close(): Promise<void> {
    await cleanupFixtures();
    for (const key of rateLimiter.keys.values()) await db.rateLimitBucket.deleteMany({ where: key });
    await app.close();
  }
  return { app: app as INestApplication, db, clock, emailSender, dispatcher, identity, organizations, subscriptions, rateLimiter, runId, ownedUsers, ownedOrganizations, user, cleanupFixtures, close };
}
