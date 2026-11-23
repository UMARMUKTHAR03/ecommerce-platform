import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, raw } from 'express';
import helmet from 'helmet';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { SanitizeInterceptor } from './common/interceptors/sanitize.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { GlobalValidationPipe } from './common/pipes/validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const frontendUrl = configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", frontendUrl],
        },
      },
    }),
  );

  // Exact origin checking: allow configured frontend URL and explicit production/development origins
  const normalizedFrontend = frontendUrl.replace(/\/+$/, '');
  const allowedOrigins = new Set([
    normalizedFrontend,
    'https://bazaarflow-luxe.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ]);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      const cleanOrigin = origin.replace(/\/+$/, '');
      if (allowedOrigins.has(cleanOrigin)) {
        return callback(null, true);
      }

      // Allow vercel preview deployments only in non-production or if explicitly matching app domain
      if (
        !isProduction &&
        cleanOrigin.endsWith('.vercel.app')
      ) {
        return callback(null, true);
      }

      return callback(new Error(`CORS origin not allowed: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'stripe-signature'],
  });

  app.use(compression());
  app.use(cookieParser());

  app.use('/store/payments/stripe/webhook', raw({ type: 'application/json' }));
  app.use(json({ limit: '10mb' }));

  app.useGlobalInterceptors(new SanitizeInterceptor(), new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new GlobalValidationPipe());

  // Auto-run pending database migrations on startup if DATABASE_URL is configured
  const dbUrl = configService.get<string>('DATABASE_URL');
  if (dbUrl) {
    const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
    try {
      const { AppDataSource } = await import('./database/data-source.js');
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
      }
      const migrations = await AppDataSource.runMigrations();
      logger.log(`Executed ${migrations.length} database migration(s) on startup.`);
    } catch (migErr) {
      logger.error(`Startup database migration failed: ${(migErr as Error).message}`, (migErr as Error).stack);
      if (isProduction) {
        throw migErr;
      }
    }
  }

  await app.listen(process.env.PORT || 3001);
}
bootstrap();
