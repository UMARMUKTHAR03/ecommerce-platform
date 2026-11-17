import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCategoryParentIdAndSeedCatalog0041712000000000 implements MigrationInterface {
  name = 'AddCategoryParentIdAndSeedCatalog0041712000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add parent_id column and foreign key to categories table if not present
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'categories' AND column_name = 'parent_id'
        ) THEN
          ALTER TABLE "categories" ADD COLUMN "parent_id" uuid;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_categories_parent'
        ) THEN
          ALTER TABLE "categories" ADD CONSTRAINT "fk_categories_parent" 
          FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL;
        END IF;
      EXCEPTION
        WHEN duplicate_table THEN null;
      END $$;
    `);

    // 2. Seed initial luxury categories if categories table is empty
    await queryRunner.query(`
      INSERT INTO "categories" ("id", "name", "slug", "description", "image_url")
      SELECT 
        'a0000000-0000-0000-0000-000000000001'::uuid, 
        'Timepieces', 
        'timepieces', 
        'Mastercrafted horology and Swiss-engineered mechanical luxury watches.', 
        'https://images.unsplash.com/photo-1523275335684-37898b6baf30'
      WHERE NOT EXISTS (SELECT 1 FROM "categories" WHERE "slug" = 'timepieces');

      INSERT INTO "categories" ("id", "name", "slug", "description", "image_url")
      SELECT 
        'a0000000-0000-0000-0000-000000000002'::uuid, 
        'Leather Goods', 
        'leather-goods', 
        'Full-grain artisan leather accessories, briefcases, and travel essentials.', 
        'https://images.unsplash.com/photo-1548036328-c9fa89d128fa'
      WHERE NOT EXISTS (SELECT 1 FROM "categories" WHERE "slug" = 'leather-goods');

      INSERT INTO "categories" ("id", "name", "slug", "description", "image_url")
      SELECT 
        'a0000000-0000-0000-0000-000000000003'::uuid, 
        'Fine Fragrances', 
        'fine-fragrances', 
        'Exquisite niche perfumery and handcrafted botanical essences.', 
        'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539'
      WHERE NOT EXISTS (SELECT 1 FROM "categories" WHERE "slug" = 'fine-fragrances');
    `);

    // 3. Seed initial products if products table is empty
    await queryRunner.query(`
      INSERT INTO "products" (
        "id", "title", "slug", "description", "price", "discount_price", "stock", "images", "is_active", "category_id"
      )
      SELECT 
        'b0000000-0000-0000-0000-000000000001'::uuid,
        'Aethelgard Chronograph Royal Obsidian',
        'aethelgard-chronograph-royal-obsidian',
        'Precision automatic chronograph encased in brushed Grade-5 titanium with a double anti-reflective sapphire crystal and exhibition caseback.',
        48500.00,
        44900.00,
        18,
        ARRAY['https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9', 'https://images.unsplash.com/photo-1524805444758-089113d48a6d'],
        true,
        'a0000000-0000-0000-0000-000000000001'::uuid
      WHERE NOT EXISTS (SELECT 1 FROM "products" WHERE "slug" = 'aethelgard-chronograph-royal-obsidian');

      INSERT INTO "products" (
        "id", "title", "slug", "description", "price", "discount_price", "stock", "images", "is_active", "category_id"
      )
      SELECT 
        'b0000000-0000-0000-0000-000000000002'::uuid,
        'Vanguard Tourbillon Sovereign Titanium',
        'vanguard-tourbillon-sovereign-titanium',
        'Flying tourbillon with 72-hour power reserve, hand-finished movement plates, and hand-stitched Mississippiensis alligator leather strap.',
        125000.00,
        NULL,
        6,
        ARRAY['https://images.unsplash.com/photo-1547996160-71dfabb1d31a', 'https://images.unsplash.com/photo-1509042239860-f550ce710b93'],
        true,
        'a0000000-0000-0000-0000-000000000001'::uuid
      WHERE NOT EXISTS (SELECT 1 FROM "products" WHERE "slug" = 'vanguard-tourbillon-sovereign-titanium');

      INSERT INTO "products" (
        "id", "title", "slug", "description", "price", "discount_price", "stock", "images", "is_active", "category_id"
      )
      SELECT 
        'b0000000-0000-0000-0000-000000000003'::uuid,
        'Valois Heritage Full-Grain Weekender',
        'valois-heritage-full-grain-weekender',
        'Vegetable-tanned Tuscan bridle leather travel duffle featuring hand-burnished edges, solid brass hardware, and dual reinforced passport compartments.',
        32000.00,
        28800.00,
        24,
        ARRAY['https://images.unsplash.com/photo-1548036328-c9fa89d128fa', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62'],
        true,
        'a0000000-0000-0000-0000-000000000002'::uuid
      WHERE NOT EXISTS (SELECT 1 FROM "products" WHERE "slug" = 'valois-heritage-full-grain-weekender');

      INSERT INTO "products" (
        "id", "title", "slug", "description", "price", "discount_price", "stock", "images", "is_active", "category_id"
      )
      SELECT 
        'b0000000-0000-0000-0000-000000000004'::uuid,
        'Oud Al-Malik Imperial Extrait de Parfum',
        'oud-al-malik-imperial-extrait-de-parfum',
        'Distillation of 40-year aged Cambodian wild agarwood, Taif damascene rose absolute, ambergris infusion, and rare Bourbon vanilla bean.',
        22500.00,
        19900.00,
        35,
        ARRAY['https://images.unsplash.com/photo-1592945403244-b3fbafd7f539', 'https://images.unsplash.com/photo-1588405748880-12d1d2a59f75'],
        true,
        'a0000000-0000-0000-0000-000000000003'::uuid
      WHERE NOT EXISTS (SELECT 1 FROM "products" WHERE "slug" = 'oud-al-malik-imperial-extrait-de-parfum');
    `);

    // 4. Seed initial variants
    await queryRunner.query(`
      INSERT INTO "product_variants" (
        "id", "product_id", "sku", "title", "size", "color", "price_adjustment", "stock"
      )
      SELECT 
        'c0000000-0000-0000-0000-000000000001'::uuid,
        'b0000000-0000-0000-0000-000000000001'::uuid,
        'AET-OBS-42',
        '42mm Obsidian Dial / Titanium Bracelet',
        '42mm',
        'Obsidian Black',
        0.00,
        10
      WHERE NOT EXISTS (SELECT 1 FROM "product_variants" WHERE "sku" = 'AET-OBS-42');

      INSERT INTO "product_variants" (
        "id", "product_id", "sku", "title", "size", "color", "price_adjustment", "stock"
      )
      SELECT 
        'c0000000-0000-0000-0000-000000000002'::uuid,
        'b0000000-0000-0000-0000-000000000001'::uuid,
        'AET-OBS-44',
        '44mm Obsidian Dial / Alligator Strap',
        '44mm',
        'Obsidian Black',
        2500.00,
        8
      WHERE NOT EXISTS (SELECT 1 FROM "product_variants" WHERE "sku" = 'AET-OBS-44');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "fk_categories_parent";`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" DROP COLUMN IF EXISTS "parent_id";`,
    );
  }
}
