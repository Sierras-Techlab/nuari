import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { connect, createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import request from 'supertest';
import { isolatedDatabaseEnvironment } from './harness.js';

describe('private isolated browser-test API process', () => {
  let child: ChildProcess;
  let origin: string;
  let socketPath: string;
  const runId = randomUUID();
  async function invoke(operation: string, values: Record<string, unknown> = {}): Promise<unknown> {
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const socket = connect(socketPath);
      socket.setTimeout(5000, () => socket.destroy(new Error('Private test socket timeout.')));
      let buffer = '';
      socket.once('connect', () => socket.write(`${JSON.stringify({ id, operation, ...values })}\n`));
      socket.once('error', reject);
      socket.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        if (!buffer.includes('\n')) return;
        socket.end();
        const result = JSON.parse(buffer.split('\n')[0]) as { id: string; ok: boolean; result: unknown };
        if (result.id !== id || !result.ok) reject(new Error('Private test operation failed.')); else resolve(result.result);
      });
    });
  }
  beforeAll(async () => {
    const env = isolatedDatabaseEnvironment();
    const portServer = createServer();
    await new Promise<void>(resolve => portServer.listen(0, '127.0.0.1', resolve));
    const address = portServer.address();
    if (!address || typeof address === 'string') throw new Error('No isolated test port.');
    const port = address.port;
    await new Promise<void>(resolve => portServer.close(() => resolve()));
    origin = `http://127.0.0.1:${port}`;
    socketPath = process.platform === 'win32' ? `\\\\.\\pipe\\nuari-e2e-${randomUUID()}` : join(tmpdir(), `nuari-e2e-${randomUUID()}.sock`);
    child = spawn(process.execPath, ['.test-dist/test/e2e-runner.js'], {
      cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test', NUARI_E2E_TEST_MODE: '1', NUARI_E2E_CONTROL_SOCKET: socketPath, PORT: String(port), WEB_ORIGIN: origin, DATABASE_URL: env.databaseUrl, DIRECT_URL: env.directUrl, TEST_DATABASE_URL: env.databaseUrl, TEST_DIRECT_URL: env.directUrl },
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Isolated E2E runner did not start.')), 10_000);
      child.once('error', () => { clearTimeout(timer); reject(new Error('Isolated E2E runner spawn failed.')); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error('Isolated E2E runner exited before readiness.')); });
      child.stdout?.on('data', (data: Buffer) => { if (data.toString().includes('runner ready')) { clearTimeout(timer); resolve(); } });
    });
  });
  afterAll(async () => {
    if (child && child.exitCode === null) {
      try { await invoke('run.cleanup', { runId }); } finally { const exit = once(child, 'exit'); child.kill('SIGTERM'); await exit; }
    }
  });

  it('captures email, creates employee/multi-tenant fixtures via IPC only, and cleans only its run', async () => {
    const agent = request.agent(origin);
    const csrf = await agent.get('/api/auth/csrf').set('Origin', origin).expect(200);
    const email = `e2e-${runId}@example.test`;
    const password = 'browser runner password';
    const mutation = (path: string, body: object, token: string) => agent.post(`/api${path}`).set('Origin', origin).set('X-CSRF-Token', token).send(body);
    await mutation('/auth/register', { name: 'E2E Owner', email, password }, csrf.body.csrfToken).expect(202);
    const link = await invoke('mailbox.take', { email });
    expect(typeof link).toBe('string');
    const verification = new URL(link as string);
    await mutation('/auth/email-verification/confirm', { token: verification.hash.slice(7) }, csrf.body.csrfToken).expect(204);
    const login = await mutation('/auth/login', { email, password }, csrf.body.csrfToken).expect(200);
    await mutation('/organizations', { name: 'Browser Owner Business', slug: `e2e-${runId}`, businessType: 'SERVICES', planCode: 'PRO' }, login.body.csrfToken).set('Idempotency-Key', randomUUID()).expect(201);
    const employee = await invoke('fixture.employee', { runId });
    expect(employee).toMatchObject({ ownerEmail: email, role: 'EMPLOYEE' });
    const second = await invoke('fixture.multi-organization', { runId });
    expect(second).toMatchObject({ role: 'ADMIN', name: expect.any(String), organizationId: expect.any(String) });
    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.memberships).toHaveLength(2);
    await agent.get('/api/test/mailbox').expect(404);
    await invoke('clock.advance', { milliseconds: 14 * 86_400_000 });
    await agent.get('/api/auth/me').expect(401);
    await invoke('run.cleanup', { runId });
    await agent.get('/api/auth/me').expect(401);
  });
});
