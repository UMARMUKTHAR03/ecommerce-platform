import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config();

const dbUrl = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
const isProd = process.env.NODE_ENV === 'production';
const forceSsl = process.env.DATABASE_SSL === 'true';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: dbUrl,
  ssl: isProd || forceSsl ? { rejectUnauthorized: false } : false,
  extra: {
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  },
  entities: [join(__dirname, '..', 'entities', '*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
  synchronize: false,
});
