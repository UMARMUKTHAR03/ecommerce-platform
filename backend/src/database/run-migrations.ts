import { DataSource } from 'typeorm';
import { AppDataSource } from './data-source';
import { Logger } from '@nestjs/common';

const logger = new Logger('MigrationRunner');

export async function runMigrations(dataSource?: DataSource) {
  const ds = dataSource ?? AppDataSource;
  if (!ds.isInitialized) {
    await ds.initialize();
  }
  logger.log('Executing pending database migrations...');
  const migrations = await ds.runMigrations();
  logger.log(`Executed ${migrations.length} migration(s) successfully.`);
  return migrations;
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.log('Migration command completed cleanly.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Migration failed:', err);
      process.exit(1);
    });
}
