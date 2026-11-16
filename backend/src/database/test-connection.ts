import { DataSource } from 'typeorm';
import { AppDataSource } from './data-source';
import { Logger } from '@nestjs/common';

const logger = new Logger('DatabaseProbe');

/**
 * Safe database connectivity probe that verifies:
 * - PostgreSQL TCP & authentication handshake
 * - SSL/TLS connectivity state
 * - Database identity (current database, version, time)
 * - TypeORM DataSource initialization
 * - Discovered migrations count
 * - Query execution
 *
 * NOTE: Credentials, passwords, and connection strings are NEVER printed.
 */
export async function testDatabaseConnection(customDataSource?: DataSource): Promise<boolean> {
  const ds = customDataSource ?? AppDataSource;
  const configuredUrl = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;

  if (!configuredUrl) {
    logger.warn('Neither DATABASE_MIGRATION_URL nor DATABASE_URL is set in environment.');
    logger.warn('Skipping live database probe. To run this probe against Supabase, set DATABASE_URL.');
    return false;
  }

  // Parse host without logging credentials
  try {
    const parsed = new URL(configuredUrl);
    const options = ds.options as any;
    logger.log(`Target database host: ${parsed.hostname}:${parsed.port || '5432'} (database: ${parsed.pathname.replace(/^\//, '')})`);
    logger.log(`SSL mode: ${options.ssl ? 'Enabled (rejectUnauthorized: false)' : 'Disabled'}`);
  } catch {
    logger.log('Target database: custom connection string configured');
  }

  try {
    if (!ds.isInitialized) {
      logger.log('Initializing TypeORM DataSource...');
      await ds.initialize();
    }

    logger.log('Executing PostgreSQL identity and SSL probe...');
    const result = await ds.query(`
      SELECT 
        current_database() AS "database",
        current_user AS "user",
        version() AS "version",
        NOW() AS "server_time",
        (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS "ssl_active"
    `);

    const row = result[0] || {};
    logger.log(`✅ PostgreSQL Connected Successfully!`);
    logger.log(`   Database Name : ${row.database}`);
    logger.log(`   Connected User: ${row.user}`);
    logger.log(`   Server Time   : ${row.server_time}`);
    logger.log(`   SSL Active    : ${row.ssl_active !== null ? row.ssl_active : 'N/A'}`);
    logger.log(`   Engine Version: ${String(row.version).split(' on ')[0]}`);

    const registeredMigrations = ds.migrations.length;
    logger.log(`   Registered Migrations in Bundle: ${registeredMigrations}`);

    return true;
  } catch (error: any) {
    logger.error(`❌ Database Probe Failed: ${error.message}`);
    if (error.code) {
      logger.error(`   Error Code: ${error.code}`);
    }
    return false;
  } finally {
    if (ds.isInitialized && !customDataSource) {
      await ds.destroy();
    }
  }
}

if (require.main === module) {
  testDatabaseConnection()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((err) => {
      logger.error('Unexpected failure during database test:', err.message);
      process.exit(1);
    });
}
