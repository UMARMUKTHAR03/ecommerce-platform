import { MigrationInterface, QueryRunner } from 'typeorm';

export class SchemaConsistencyAndConstraints0031711900000000 implements MigrationInterface {
  name = 'SchemaConsistencyAndConstraints0031711900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Ensure refresh_tokens table has column "token" varchar(512) and is_revoked
    // If a legacy table exists with "token_hash" NOT NULL, make token_hash nullable or migrate it safely
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'refresh_tokens' AND column_name = 'token_hash'
        ) THEN
          ALTER TABLE "refresh_tokens" ALTER COLUMN "token_hash" DROP NOT NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'refresh_tokens' AND column_name = 'token'
        ) THEN
          ALTER TABLE "refresh_tokens" ADD COLUMN "token" character varying(512);
        END IF;
      END $$;
    `);

    // Migrate token_hash to token if token is null
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'refresh_tokens' AND column_name = 'token_hash'
        ) THEN
          UPDATE "refresh_tokens" SET "token" = "token_hash" WHERE "token" IS NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'refresh_tokens' AND column_name = 'is_revoked'
        ) THEN
          ALTER TABLE "refresh_tokens" ADD COLUMN "is_revoked" boolean NOT NULL DEFAULT false;
        END IF;
      END $$;
    `);

    // Migrate legacy revoked_at to is_revoked = true
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'refresh_tokens' AND column_name = 'revoked_at'
        ) THEN
          UPDATE "refresh_tokens" SET "is_revoked" = true WHERE "revoked_at" IS NOT NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_refresh_tokens_token" 
      ON "refresh_tokens" ("token") WHERE "token" IS NOT NULL;
    `);

    // 2. Ensure reviews table matches entity: body and is_verified
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'reviews' AND column_name = 'body'
        ) THEN
          ALTER TABLE "reviews" ADD COLUMN "body" text;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'reviews' AND column_name = 'is_verified'
        ) THEN
          ALTER TABLE "reviews" ADD COLUMN "is_verified" boolean NOT NULL DEFAULT false;
        END IF;
      END $$;
    `);

    // Copy comment -> body if body is null and comment exists
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'reviews' AND column_name = 'comment'
        ) THEN
          UPDATE "reviews" SET "body" = "comment" WHERE "body" IS NULL;
        END IF;
      END $$;
    `);

    // 3. Unique review constraint: a customer can review a product at most once
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_reviews_customer_product'
        ) THEN
          ALTER TABLE "reviews" ADD CONSTRAINT "uq_reviews_customer_product" UNIQUE ("customer_id", "product_id");
        END IF;
      EXCEPTION
        WHEN duplicate_table THEN null;
      END $$;
    `);

    // 4. Unique wishlist constraint: a customer can only have a product once in wishlist
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_wishlists_customer_product'
        ) THEN
          ALTER TABLE "wishlists" ADD CONSTRAINT "uq_wishlists_customer_product" UNIQUE ("customer_id", "product_id");
        END IF;
      EXCEPTION
        WHEN duplicate_table THEN null;
      END $$;
    `);

    // 5. Unique payment transaction_id constraint (ignoring nulls)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_payments_transaction_id" 
      ON "payments" ("transaction_id") WHERE "transaction_id" IS NOT NULL;
    `);

    // 6. Rating check constraint: 1 <= rating <= 5
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_review_rating_range'
        ) THEN
          ALTER TABLE "reviews" ADD CONSTRAINT "chk_review_rating_range" CHECK (rating >= 1 AND rating <= 5);
        END IF;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_payments_transaction_id";`);
    await queryRunner.query(`ALTER TABLE "wishlists" DROP CONSTRAINT IF EXISTS "uq_wishlists_customer_product";`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "uq_reviews_customer_product";`);
    await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "chk_review_rating_range";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_refresh_tokens_token";`);
  }
}
