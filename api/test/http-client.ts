import request from 'supertest';
import type { INestApplication } from '@nestjs/common';

export class HttpClient {
  readonly agent: ReturnType<typeof request.agent>;
  csrfToken = '';
  constructor(app: INestApplication, readonly origin = 'http://localhost:3000') { this.agent = request.agent(app.getHttpServer()); }
  async csrf(): Promise<request.Response> {
    const response = await this.agent.get('/api/auth/csrf').set('Origin', this.origin).expect(200);
    if (typeof response.body.csrfToken !== 'string') throw new Error('Missing CSRF DTO.');
    this.csrfToken = response.body.csrfToken;
    return response;
  }
  post(path: string, body: object = {}) {
    return this.agent.post(`/api${path}`).set('Origin', this.origin).set('X-CSRF-Token', this.csrfToken).send(body);
  }
  async login(email: string, password: string): Promise<request.Response> {
    await this.csrf();
    const response = await this.post('/auth/login', { email, password }).expect(200);
    this.csrfToken = response.body.csrfToken;
    return response;
  }
}
