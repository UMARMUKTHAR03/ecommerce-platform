import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema0001711700000000 implements MigrationInterface {
  name = 'InitialSchema0001711700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable uuid-ossp extension if available or pgcrypto
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // Create ENUM types safely
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "orders_status_enum" AS ENUM ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "coupons_type_enum" AS ENUM ('percentage', 'fixed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "payments_status_enum" AS ENUM ('pending', 'completed', 'failed', 'refunded');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "admins_role_enum" AS ENUM ('superadmin', 'admin', 'manager');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 1. categories
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(100) NOT NULL,
        "slug" character varying(120) NOT NULL,
        "description" text,
        "image_url" character varying(255),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "uq_categories_slug" UNIQUE ("slug"),
        CONSTRAINT "pk_categories" PRIMARY KEY ("id")
      );
    `);

    // 2. products
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "products" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(255) NOT NULL,
        "slug" character varying(255) NOT NULL,
        "description" text,
        "price" numeric(12,2) NOT NULL,
        "discount_price" numeric(12,2),
        "stock" integer NOT NULL DEFAULT 0,
        "images" text[] NOT NULL DEFAULT '{}',
        "is_active" boolean NOT NULL DEFAULT true,
        "category_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "uq_products_slug" UNIQUE ("slug"),
        CONSTRAINT "pk_products" PRIMARY KEY ("id"),
        CONSTRAINT "fk_products_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL
      );
    `);

    // 3. product_variants
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_variants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "product_id" uuid NOT NULL,
        "sku" character varying(100) NOT NULL,
        "title" character varying(100),
        "size" character varying(50),
        "color" character varying(50),
        "price_adjustment" numeric(12,2) NOT NULL DEFAULT 0,
        "stock" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "uq_product_variants_sku" UNIQUE ("sku"),
        CONSTRAINT "pk_product_variants" PRIMARY KEY ("id"),
        CONSTRAINT "fk_product_variants_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE
      );
    `);

    // 4. customers
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying(255) NOT NULL,
        "password_hash" character varying(255) NOT NULL,
        "name" character varying(180) NOT NULL,
        "phone" character varying(30),
        "is_verified" boolean NOT NULL DEFAULT false,
        "failed_login_attempts" integer NOT NULL DEFAULT 0,
        "locked_until" TIMESTAMP WITH TIME ZONE,
        "password_reset_token_hash" character varying(255),
        "password_reset_expires_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "uq_customers_email" UNIQUE ("email"),
        CONSTRAINT "pk_customers" PRIMARY KEY ("id")
      );
    `);

    // 5. addresses
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "addresses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "customer_id" uuid NOT NULL,
        "full_name" character varying(180) NOT NULL,
        "phone" character varying(30) NOT NULL,
        "street_address" character varying(255) NOT NULL,
        "city" character varying(100) NOT NULL,
        "postal_code" character varying(30),
        "country" character varying(100) NOT NULL DEFAULT 'Bangladesh',
        "is_default" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_addresses" PRIMARY KEY ("id"),
        CONSTRAINT "fk_addresses_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE
      );
    `);

    // 6. admins
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admins" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying(255) NOT NULL,
        "password_hash" character varying(255) NOT NULL,
        "name" character varying(180) NOT NULL DEFAULT 'Admin',
        "role" "admins_role_enum" NOT NULL DEFAULT 'admin',
        "totp_secret" character varying(255),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "uq_admins_email" UNIQUE ("email"),
        CONSTRAINT "pk_admins" PRIMARY KEY ("id")
      );
    `);

    // 7. coupons
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "coupons" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying(50) NOT NULL,
        "type" "coupons_type_enum" NOT NULL DEFAULT 'percentage',
        "value" numeric(10,2) NOT NULL,
        "min_spend" numeric(12,2),
        "usage_limit" integer,
        "used_count" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "expires_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "uq_coupons_code" UNIQUE ("code"),
        CONSTRAINT "pk_coupons" PRIMARY KEY ("id")
      );
    `);

    // 8. orders
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "customer_id" uuid NOT NULL,
        "status" "orders_status_enum" NOT NULL DEFAULT 'pending',
        "subtotal" numeric(12,2) NOT NULL DEFAULT 0,
        "shipping_fee" numeric(12,2) NOT NULL DEFAULT 0,
        "discount_amount" numeric(12,2) NOT NULL DEFAULT 0,
        "total" numeric(12,2) NOT NULL,
        "delivery_method" character varying(50) NOT NULL DEFAULT 'standard',
        "shipping_address" jsonb,
        "payment_method" character varying(60),
        "payment_reference" character varying(255),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_orders" PRIMARY KEY ("id"),
        CONSTRAINT "fk_orders_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE
      );
    `);

    // 9. order_items
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "order_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "order_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "variant_id" uuid,
        "quantity" integer NOT NULL,
        "price" numeric(12,2) NOT NULL,
        CONSTRAINT "pk_order_items" PRIMARY KEY ("id"),
        CONSTRAINT "fk_order_items_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_order_items_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_order_items_variant" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL
      );
    `);

    // 10. payments
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "order_id" uuid NOT NULL,
        "provider" character varying(50) NOT NULL,
        "transaction_id" character varying(255),
        "amount" numeric(12,2) NOT NULL,
        "currency" character varying(10) NOT NULL DEFAULT 'BDT',
        "status" "payments_status_enum" NOT NULL DEFAULT 'pending',
        "raw_payload" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_payments" PRIMARY KEY ("id"),
        CONSTRAINT "fk_payments_order" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE
      );
    `);

    // 11. refresh_tokens
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "token_hash" character varying(255) NOT NULL,
        "customer_id" uuid NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_refresh_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "fk_refresh_tokens_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE
      );
    `);

    // 12. reviews
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reviews" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "customer_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "rating" integer NOT NULL,
        "comment" text,
        "is_approved" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_reviews" PRIMARY KEY ("id"),
        CONSTRAINT "fk_reviews_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_reviews_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE
      );
    `);

    // 13. wishlists
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "wishlists" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "customer_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_wishlists" PRIMARY KEY ("id"),
        CONSTRAINT "fk_wishlists_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_wishlists_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE
      );
    `);

    // Common baseline indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_products_slug" ON "products" ("slug");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_products_category_id" ON "products" ("category_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_product_variants_product_id" ON "product_variants" ("product_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_product_variants_sku" ON "product_variants" ("sku");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_customers_email" ON "customers" ("email");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_addresses_customer_id" ON "addresses" ("customer_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_orders_customer_id" ON "orders" ("customer_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_orders_status" ON "orders" ("status");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_payments_order_id" ON "payments" ("order_id");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_payments_transaction_id" ON "payments" ("transaction_id");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payments" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_items" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wishlists" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reviews" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "addresses" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "admins" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "coupons" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_variants" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "products" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "categories" CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS "admins_role_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payments_status_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "coupons_type_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "orders_status_enum";`);
  }
}
