import { createServer, type Socket } from 'node:net';
import { chmod } from 'node:fs/promises';
import { basename, isAbsolute } from 'node:path';
import { randomToken } from '../src/common/crypto.js';
import { createApiHarness, MutableClock, isolatedDatabaseEnvironment } from './harness.js';
import { randomUUID } from 'node:crypto';

// This entrypoint is deliberately outside src/, never imported by production bootstrap.
if (process.env.NUARI_E2E_TEST_MODE !== '1' || !['test', 'development'].includes(process.env.NODE_ENV || '')) throw new Error('Private E2E runner requires explicit test mode and a non-production environment.');
isolatedDatabaseEnvironment();
process.env.NODE_ENV = 'test';
process.env.TRUSTED_PROXY_CIDRS = '';
const path = process.env.NUARI_E2E_CONTROL_SOCKET;
if (!path || (process.platform === 'win32'
  ? !/^\\\\\.\\pipe\\nuari-e2e-[a-zA-Z0-9_-]+$/.test(path)
  : !isAbsolute(path) || !/^nuari-e2e-[a-zA-Z0-9_-]+\.sock$/.test(basename(path)))) throw new Error('Private local E2E socket path is required.');
const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid test API port.');
process.umask(0o077);
const harness = await createApiHarness({ clock: new MutableClock() });
const runs = new Map<string, Set<string>>();
const sockets = new Set<Socket>();
let closing = false;

function assertRunId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) throw new Error('Invalid test run identifier.');
}
async function rememberRun(runId: string): Promise<Set<string>> {
  const users = runs.get(runId) ?? new Set<string>();
  runs.set(runId, users);
  for (const email of [`e2e-${runId}@example.test`, `employee-${runId}@example.test`]) {
    const user = await harness.db.user.findUnique({ where: { email }, select: { id: true } });
    if (user) { users.add(user.id); harness.ownedUsers.add(user.id); }
  }
  return users;
}

async function operation(command: Record<string, unknown>): Promise<unknown> {
  if (command.operation === 'mailbox.take') {
    if (typeof command.email !== 'string') throw new Error('Invalid mailbox identifier.');
    const match = /^e2e-([0-9a-f-]{36})@example\.test$/.exec(command.email);
    if (!match) throw new Error('Mailbox is outside this test namespace.');
    assertRunId(match[1]);
    await rememberRun(match[1]);
    await harness.dispatcher.drain();
    const email = harness.emailSender.messages.findLast(message => message.to === command.email && message.text.includes('/verify-email#token='));
    if (!email) throw new Error('Verification mail is not available.');
    return email.text;
  }
  if (command.operation === 'fixture.employee') {
    assertRunId(command.runId);
    await rememberRun(command.runId);
    const ownerEmail = `e2e-${command.runId}@example.test`;
    const owner = await harness.db.user.findUniqueOrThrow({ where: { email: ownerEmail } });
    const member = await harness.db.organizationMember.findFirstOrThrow({ where: { userId: owner.id, role: 'OWNER', status: 'ACTIVE' } });
    const email = `employee-${command.runId}@example.test`;
    const password = randomToken();
    const employee = await harness.user({ email, password, verified: false });
    await harness.db.organizationMember.create({ data: { userId: employee.id, organizationId: member.organizationId, role: 'EMPLOYEE', status: 'ACTIVE', createdAt: harness.clock.now(), updatedAt: harness.clock.now() } });
    await rememberRun(command.runId);
    return { email, password, organizationId: member.organizationId, role: 'EMPLOYEE', ownerEmail };
  }
  if (command.operation === 'clock.advance') {
    if (typeof command.milliseconds !== 'number' || !Number.isSafeInteger(command.milliseconds) || command.milliseconds < 0 || command.milliseconds > 366 * 86_400_000) throw new Error('Invalid clock advance.');
    harness.clock.advance(command.milliseconds);
    return null;
  }
  if (command.operation === 'fixture.multi-organization') {
    assertRunId(command.runId);
    const users = await rememberRun(command.runId);
    const subject = await harness.db.user.findUniqueOrThrow({ where: { email: `e2e-${command.runId}@example.test` } });
    const creator = await harness.user();
    users.add(creator.id);
    const name = `Second organization ${command.runId.slice(0, 8)}`;
    const result = await harness.organizations.createInitial(creator.principal, randomUUID(), { name, slug: `e2e-${randomUUID()}`, businessType: 'COMMERCE', planCode: 'BUSINESS' });
    await harness.db.organizationMember.create({ data: { userId: subject.id, organizationId: result.organization.id, role: 'ADMIN', status: 'ACTIVE', createdAt: harness.clock.now(), updatedAt: harness.clock.now() } });
    harness.ownedOrganizations.add(result.organization.id);
    return { id: result.organization.id, organizationId: result.organization.id, name, role: 'ADMIN' };
  }
  if (command.operation === 'run.cleanup') {
    assertRunId(command.runId);
    const users = await rememberRun(command.runId);
    await harness.cleanupFixtures([...users], []);
    runs.delete(command.runId);
    return null;
  }
  throw new Error('Unknown private test operation.');
}

let serialized: Promise<void> = Promise.resolve();
const server = createServer(socket => {
  sockets.add(socket);
  socket.once('close', () => sockets.delete(socket));
  socket.on('error', () => socket.destroy());
  socket.setTimeout(5000, () => socket.destroy());
  let buffer = '';
  let accepted = false;
  socket.on('data', (chunk: Buffer) => {
    if (accepted) return;
    buffer += chunk.toString('utf8');
    if (Buffer.byteLength(buffer) > 4096) { socket.destroy(); return; }
    const newline = buffer.indexOf('\n');
    if (newline < 0) return;
    accepted = true;
    serialized = serialized.then(async () => {
      let id = '';
      try {
        const value: unknown = JSON.parse(buffer.slice(0, newline));
        if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid command.');
        const command = value as Record<string, unknown>;
        assertRunId(command.id); id = command.id;
        const result = await operation(command);
        socket.end(`${JSON.stringify({ id, ok: true, result })}\n`);
      } catch (err: unknown) {
        console.error('E2E runner operation failed:', err);
        // No payload/Prisma/provider error is reflected to the private client either.
        socket.end(`${JSON.stringify({ id, ok: false, error: 'Private test operation failed.' })}\n`);
      }
    });
  });
});
await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(path, resolve); });
if (process.platform !== 'win32') await chmod(path, 0o600);
await harness.app.listen(port, '127.0.0.1');
console.info('Private isolated API E2E runner ready.');

async function shutdown(): Promise<void> {
  if (closing) return;
  closing = true;
  for (const socket of sockets) socket.destroy();
  await new Promise<void>(resolve => server.close(() => resolve()));
  await serialized;
  for (const runId of runs.keys()) await rememberRun(runId);
  await harness.close();
}
process.once('SIGINT', () => { void shutdown().then(() => process.exit(0), () => process.exit(1)); });
process.once('SIGTERM', () => { void shutdown().then(() => process.exit(0), () => process.exit(1)); });
