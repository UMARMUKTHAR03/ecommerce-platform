import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTrackingNumber1700000007 implements MigrationInterface {
  name = 'AddTrackingNumber1700000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Safe: only adds column if it doesn't already exist
    const table = await queryRunner.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'tracking_number'`,
    );
    if (table.length === 0) {
      await queryRunner.query(
        `ALTER TABLE "orders" ADD COLUMN "tracking_number" varchar(100) DEFAULT NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "tracking_number"`);
  }
}
