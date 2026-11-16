import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('App & Health E2E', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    // If not in e2e mode or without DB, test runs gracefully or validates health
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/ (GET) returns Welcome / Root greeting', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/health (GET) returns database health status', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    // In CI with postgresql service, health returns 200 with db: connected
    // If db is not connected, it returns 503
    expect([200, 503]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.db).toBe('connected');
    }
  });
});
