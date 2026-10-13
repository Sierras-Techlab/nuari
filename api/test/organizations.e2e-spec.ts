import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { vi } from 'vitest';
import { ApiExceptionFilter } from '../src/common/errors.js';
import { Clock } from '../src/common/clock.js';
import { RateLimiter } from '../src/common/rate-limiter.js';
import { OrganizationsController, AccessContextController } from '../src/organizations/organizations.controller.js';
import { OrganizationsService } from '../src/organizations/organizations.service.js';
import { TenantGuard, PermissionGuard, BusinessAccessGuard } from '../src/organizations/tenant.guard.js';
import { SubscriptionsController } from '../src/subscriptions/subscriptions.controller.js';
import { SubscriptionsService } from '../src/subscriptions/subscriptions.service.js';
import { ApiError } from '../src/common/errors.js';

const orgId = '58e5404f-8071-4f50-a534-3b64016a2f28';
const principal = { userId: '3650f358-c4b6-4bee-9e09-017cdbd9d4c8', sessionId: '3ce30040-c204-4496-9b12-1c036ff96a89', activeOrganizationId: null };
const org = { id: orgId, name: 'Mi negocio', slug: 'mi-negocio', businessType: 'SERVICES', createdAt: new Date('2026-10-12T12:00:00Z'), updatedAt: new Date('2026-10-12T12:00:00Z') };
const member = { id: 'member-id', userId: principal.userId, organizationId: orgId, role: 'EMPLOYEE' as const, status: 'ACTIVE' as const, createdAt: org.createdAt, updatedAt: org.updatedAt, organization: org };

describe('Organizations and subscriptions HTTP (isolated service boundary)', () => {
  let app: INestApplication;
  const state = { businessAllowed: true, reason: 'TRIAL_ACTIVE', validUntil: '2026-10-26T12:00:00.000Z', canManageSubscription: false };
  const subscriptions = {
    state: vi.fn(async () => ({ subscription: { id: 'sub-id', organizationId: orgId, planCode: 'BASIC', status: 'TRIALING', trialStartedAt: '2026-10-12T12:00:00.000Z', trialEndsAt: state.validUntil, paidThrough: null }, access: { ...state } })),
  };
  const organizations = {
    snapshot: vi.fn(async () => ({ user: { id: principal.userId }, memberships: [{ id: member.id, role: member.role, organization: { ...org, createdAt: org.createdAt.toISOString(), updatedAt: org.updatedAt.toISOString() } }], activeOrganizationId: orgId, access: { ...state }, onboarding: { canCreateOrganization: false, reason: 'HAS_MEMBERSHIP' } })),
    resolveMember: vi.fn(async () => member),
    createInitial: vi.fn(async (_principal: unknown, _key: string, input: unknown) => ({ replay: false, organization: input, membership: { id: member.id, organizationId: orgId, role: 'OWNER', status: 'ACTIVE' }, subscription: { id: 'sub-id' } })),
  };

  beforeEach(async () => {
    state.businessAllowed = true;
    state.reason = 'TRIAL_ACTIVE';
    vi.clearAllMocks();
    subscriptions.state.mockImplementation(async () => ({ subscription: { id: 'sub-id', organizationId: orgId, planCode: 'BASIC', status: 'TRIALING', trialStartedAt: '2026-10-12T12:00:00.000Z', trialEndsAt: state.validUntil, paidThrough: null }, access: { ...state } }));
    organizations.resolveMember.mockImplementation(async () => member);
    organizations.createInitial.mockImplementation(async (_principal: unknown, _key: string, input: unknown) => ({ replay: false, organization: input, membership: { id: member.id, organizationId: orgId, role: 'OWNER', status: 'ACTIVE' }, subscription: { id: 'sub-id' } }));
    const module = await Test.createTestingModule({
      controllers: [AccessContextController, OrganizationsController, SubscriptionsController],
      providers: [
        { provide: OrganizationsService, useValue: organizations },
        { provide: SubscriptionsService, useValue: subscriptions },
        { provide: RateLimiter, useValue: { consume: vi.fn().mockResolvedValue(undefined) } },
        { provide: Clock, useValue: { now: () => new Date('2026-10-12T12:00:00.000Z') } },
        TenantGuard, PermissionGuard, BusinessAccessGuard,
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.use((req: Request, _res: Response, next: NextFunction) => { Object.assign(req, { principal }); next(); });
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: false }));
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  afterEach(async () => { await app.close(); });

  it('publishes closed plan codes, validates onboarding DTO and distinguishes first create from replay', async () => {
    await request(app.getHttpServer()).get('/api/subscription-plans').expect(200, { plans: [{ code: 'BASIC' }, { code: 'PRO' }, { code: 'BUSINESS' }, { code: 'TOURISM' }], trialDays: 14 });
    await request(app.getHttpServer()).post('/api/organizations').send({ name: 'Mi negocio', slug: 'Mi-Negocio', businessType: 'SERVICES', planCode: 'BASIC' }).expect(400);
    await request(app.getHttpServer()).post('/api/organizations').set('Idempotency-Key', '25b848dd-7cc7-4744-a69f-826632cbe58b').send({ name: 'Mi negocio', slug: 'mi-negocio', businessType: 'SERVICES', planCode: 'BASIC', ownerId: 'attacker' }).expect(400);

    await request(app.getHttpServer()).post('/api/organizations').send({ name: 'Mi negocio', slug: 'mi-negocio', businessType: 'SERVICES', planCode: 'BASIC' }).expect(400).expect(({ body }) => expect(body.code).toBe('INVALID_IDEMPOTENCY_KEY'));
    await request(app.getHttpServer()).post('/api/organizations').set('Idempotency-Key', '25b848dd-7cc7-4744-a69f-826632cbe58b').send({ name: 'Mi negocio', slug: 'mi-negocio', businessType: 'SERVICES', planCode: 'BASIC' }).expect(201);
    organizations.createInitial.mockResolvedValueOnce({ replay: true, organization: org, membership: member, subscription: { id: 'sub-id' } });
    await request(app.getHttpServer()).post('/api/organizations').set('Idempotency-Key', '25b848dd-7cc7-4744-a69f-826632cbe58b').send({ name: 'Mi negocio', slug: 'mi-negocio', businessType: 'SERVICES', planCode: 'BASIC' }).expect(200);
  });

  it('keeps subscription readable for a tenant member but gates workspace at expiry', async () => {
    await request(app.getHttpServer()).get(`/api/organizations/${orgId}/subscription`).expect(200).expect(({ body }) => expect(body.access.businessAllowed).toBe(true));
    state.businessAllowed = false;
    state.reason = 'TRIAL_EXPIRED';
    subscriptions.state.mockImplementation(async () => ({ subscription: { id: 'sub-id', organizationId: orgId, planCode: 'BASIC', status: 'EXPIRED', trialStartedAt: '2026-10-12T12:00:00.000Z', trialEndsAt: state.validUntil, paidThrough: null }, access: { ...state } }));
    await request(app.getHttpServer()).get(`/api/organizations/${orgId}/workspace`).expect(403).expect(({ body }) => expect(body.code).toBe('SUBSCRIPTION_REQUIRED'));
    await request(app.getHttpServer()).get(`/api/organizations/${orgId}/subscription`).expect(200).expect(({ body }) => expect(body.access.reason).toBe('TRIAL_EXPIRED'));
  });

  it('does not expose another or inactive tenant through the tenant guard', async () => {
    organizations.resolveMember.mockRejectedValueOnce(new ApiError(404, 'ORGANIZATION_NOT_FOUND', 'No se encontró la organización.'));
    await request(app.getHttpServer()).get(`/api/organizations/${orgId}/subscription`).expect(404).expect(({ body }) => expect(body.code).toBe('ORGANIZATION_NOT_FOUND'));
  });
});
