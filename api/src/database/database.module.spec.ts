import { Test } from '@nestjs/testing';
import { afterEach, vi } from 'vitest';

import { DatabaseModule } from './database.module.js';
import { PrismaService } from './prisma.service.js';

describe('DatabaseModule', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('provides the Prisma client configured for the runtime URL', async () => {
    vi.stubEnv(
      'DATABASE_URL',
      'postgresql://nuari:nuari@localhost:5432/nuari?schema=public',
    );

    const moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule],
    }).compile();

    const prismaService = moduleRef.get(PrismaService);

    expect(prismaService).toBeDefined();

    await moduleRef.close();
  });
});
