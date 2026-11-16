import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

const shouldRunE2E = process.env.RUN_E2E === 'true' || Boolean(process.env.DATABASE_URL);
const describeSuite = shouldRunE2E ? describe : describe.skip;

describeSuite('App, Auth & Health E2E', () => {
  let app: INestApplication<App>;
  const isPostgresConfigured = Boolean(process.env.DATABASE_URL);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();
  }, 30000);

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
    expect([200, 503]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.db).toBe('connected');
    } else {
      expect(res.body.db).toBe('disconnected');
    }
  });

  it('PostgreSQL Registration, Login, Token Refresh and /store/auth/me workflow', async () => {
    if (!isPostgresConfigured) {
      console.log('Skipping live DB auth flow: DATABASE_URL not set in local environment');
      return;
    }

    const testEmail = `e2e.test.${Date.now()}.${Math.floor(Math.random() * 10000)}@bazaarflow.com`;
    const testPassword = 'Password123!@#';

    // 1. Registration
    const registerRes = await request(app.getHttpServer())
      .post('/store/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        name: 'E2E Luxe Customer',
      })
      .expect(201);

    expect(registerRes.body).toHaveProperty('customer');
    expect(registerRes.body.customer.email).toBe(testEmail);

    const regCookies = registerRes.headers['set-cookie'] as string[] | undefined;
    expect(Array.isArray(regCookies)).toBe(true);
    expect(regCookies!.some((c) => c.startsWith('refresh_token='))).toBe(true);

    // 2. Login
    const loginRes = await request(app.getHttpServer())
      .post('/store/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      })
      .expect(200);

    const loginCookies = loginRes.headers['set-cookie'] as string[];
    const refreshTokenCookie = loginCookies.find((c) => c.startsWith('refresh_token='));
    expect(refreshTokenCookie).toBeDefined();

    // 3. Authenticated customer request to /store/auth/me
    const meRes = await request(app.getHttpServer())
      .get('/store/auth/me')
      .set('Cookie', loginCookies)
      .expect(200);

    expect(meRes.body.email).toBe(testEmail);

    // 4. Session Refresh & Rotation
    const refreshRes = await request(app.getHttpServer())
      .post('/store/auth/refresh')
      .set('Cookie', [refreshTokenCookie!])
      .send({})
      .expect(200);

    expect(refreshRes.body).toHaveProperty('tokens');
    expect(refreshRes.body.tokens).toHaveProperty('accessToken');
    expect(refreshRes.body.tokens).toHaveProperty('refreshToken');

    // 5. Logout & Revocation check
    await request(app.getHttpServer())
      .post('/store/auth/logout')
      .set('Cookie', [refreshTokenCookie!])
      .send({})
      .expect(200);
  });
});
