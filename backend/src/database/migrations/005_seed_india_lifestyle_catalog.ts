import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedIndiaLifestyleCatalog0051713000000000 implements MigrationInterface {
  name = 'SeedIndiaLifestyleCatalog0051713000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Seed categories matching frontend footer & navigation:
    // smartphones, home-kitchen, fashion, beauty, sports, accessories
    await queryRunner.query(`
      INSERT INTO "categories" ("id", "name", "slug", "description", "image_url")
      SELECT 
        'a0000000-0000-0000-0000-000000000010'::uuid, 
        'Smartphones', 
        'smartphones', 
        'Flagship computational photography devices, bespoke titanium chassis, and next-gen mobile flagships.', 
        'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=1200&q=80'
      WHERE NOT EXISTS (SELECT 1 FROM "categories" WHERE "slug" = 'smartphones');

      INSERT INTO "categories" ("id", "name", "slug", "description", "image_url")
      SELECT 
        'a0000000-0000-0000-0000-000000000020'::uuid, 
        'Home & Kitchen', 
        'home-kitchen', 
        'Artisan espresso hardware, handcrafted ceramics, and sculptural domestic lifestyle pieces.', 
        'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=80'
      WHERE NOT EXISTS (SELECT 1 FROM "categories" WHERE "slug" = 'home-kitchen');

      INSERT INTO "categories" ("id", "name", "slug", "description", "image_url")
      SELECT 
        'a0000000-0000-0000-0000-000000000030'::uuid, 
        'Fashion', 
        'fashion', 
        'Bespoke silk tailoring, cashmere outerwear, and contemporary minimalist couture.', 
        'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=80'
      WHERE NOT EXISTS (SELECT 1 FROM "categories" WHERE "slug" = 'fashion');

      INSERT INTO "categories" ("id", "name", "slug", "description", "image_url")
      SELECT 
        'a0000000-0000-0000-0000-000000000040'::uuid, 
        'Beauty', 
        'beauty', 
        'Clean botanical skincare serums, restorative antioxidant elixirs, and bespoke apothecary essentials.', 
        'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80'
      WHERE NOT EXISTS (SELECT 1 FROM "categories" WHERE "slug" = 'beauty');

      INSERT INTO "categories" ("id", "name", "slug", "description", "image_url")
      SELECT 
        'a0000000-0000-0000-0000-000000000050'::uuid, 
        'Sports', 
        'sports', 
        'Performance carbon-fiber gear, precision biometric trackers, and luxury athletic equipment.', 
        'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1200&q=80'
      WHERE NOT EXISTS (SELECT 1 FROM "categories" WHERE "slug" = 'sports');

      INSERT INTO "categories" ("id", "name", "slug", "description", "image_url")
      SELECT 
        'a0000000-0000-0000-0000-000000000060'::uuid, 
        'Accessories', 
        'accessories', 
        'Polarized titanium eyewear, woven silk scarves, and minimalist card cases.', 
        'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=1200&q=80'
      WHERE NOT EXISTS (SELECT 1 FROM "categories" WHERE "slug" = 'accessories');
    `);

    // 2. Seed realistic luxury products for each category
    await queryRunner.query(`
      -- Smartphones
      INSERT INTO "products" (
        "id", "title", "slug", "description", "price", "discount_price", "stock", "images", "is_active", "category_id"
      )
      SELECT 
        'b0000000-0000-0000-0000-000000000011'::uuid,
        'Aura One Titanium Flagship 512GB',
        'aura-one-titanium-flagship-512gb',
        'Engineered from aerospace-grade Grade 5 titanium with custom photonic sensor array, sapphire backplate, and all-day silicon battery.',
        134900.00,
        129900.00,
        25,
        ARRAY['https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80'],
        true,
        'a0000000-0000-0000-0000-000000000010'::uuid
      WHERE NOT EXISTS (SELECT 1 FROM "products" WHERE "slug" = 'aura-one-titanium-flagship-512gb');

      -- Home & Kitchen
      INSERT INTO "products" (
        "id", "title", "slug", "description", "price", "discount_price", "stock", "images", "is_active", "category_id"
      )
      SELECT 
        'b0000000-0000-0000-0000-000000000021'::uuid,
        'Artisan Brass & Walnut Manual Espresso Atelier',
        'artisan-brass-walnut-manual-espresso-atelier',
        'Direct-lever manual espresso extraction machine with solid polished brass boiler, American walnut lever grips, and precision pressure profiling gauge.',
        89000.00,
        79900.00,
        12,
        ARRAY['https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=1200&q=80'],
        true,
        'a0000000-0000-0000-0000-000000000020'::uuid
      WHERE NOT EXISTS (SELECT 1 FROM "products" WHERE "slug" = 'artisan-brass-walnut-manual-espresso-atelier');

      -- Fashion
      INSERT INTO "products" (
        "id", "title", "slug", "description", "price", "discount_price", "stock", "images", "is_active", "category_id"
      )
      SELECT 
        'b0000000-0000-0000-0000-000000000031'::uuid,
        'Verona Double-Breasted Raw Mulberry Silk Blazer',
        'verona-double-breasted-raw-mulberry-silk-blazer',
        'Tailored unstructured silhouette hand-stitched from pure raw mulberry silk, horn buttons, and cupro breathable half-lining.',
        42000.00,
        37500.00,
        18,
        ARRAY['https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1200&q=80'],
        true,
        'a0000000-0000-0000-0000-000000000030'::uuid
      WHERE NOT EXISTS (SELECT 1 FROM "products" WHERE "slug" = 'verona-double-breasted-raw-mulberry-silk-blazer');

      -- Beauty
      INSERT INTO "products" (
        "id", "title", "slug", "description", "price", "discount_price", "stock", "images", "is_active", "category_id"
      )
      SELECT 
        'b0000000-0000-0000-0000-000000000041'::uuid,
        'Cellular Renewal Bakuchiol & Rosehip Nectar',
        'cellular-renewal-bakuchiol-rosehip-nectar',
        'Cold-pressed botanical retinol alternative with Himalayan sea buckthorn, cold-extracted damask rosehip seed oil, and 24K colloidal gold suspension.',
        14500.00,
        12800.00,
        40,
        ARRAY['https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1608248597359-009f7df8b69d?auto=format&fit=crop&w=1200&q=80'],
        true,
        'a0000000-0000-0000-0000-000000000040'::uuid
      WHERE NOT EXISTS (SELECT 1 FROM "products" WHERE "slug" = 'cellular-renewal-bakuchiol-rosehip-nectar');

      -- Sports
      INSERT INTO "products" (
        "id", "title", "slug", "description", "price", "discount_price", "stock", "images", "is_active", "category_id"
      )
      SELECT 
        'b0000000-0000-0000-0000-000000000051'::uuid,
        'AeroVelo Ultralight Toray Carbon Fiber Road Frame',
        'aerovelo-ultralight-toray-carbon-fiber-road-frame',
        'Monocoque 820-gram Toray T1000 carbon fiber frame with integrated aerodynamic cockpit and internal routing for electronic groupsets.',
        195000.00,
        179000.00,
        8,
        ARRAY['https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?auto=format&fit=crop&w=1200&q=80'],
        true,
        'a0000000-0000-0000-0000-000000000050'::uuid
      WHERE NOT EXISTS (SELECT 1 FROM "products" WHERE "slug" = 'aerovelo-ultralight-toray-carbon-fiber-road-frame');

      -- Accessories
      INSERT INTO "products" (
        "id", "title", "slug", "description", "price", "discount_price", "stock", "images", "is_active", "category_id"
      )
      SELECT 
        'b0000000-0000-0000-0000-000000000061'::uuid,
        'Elysium Polarized Japanese Beta-Titanium Sunglasses',
        'elysium-polarized-japanese-beta-titanium-sunglasses',
        'Ultra-flexible Japanese beta-titanium aviator frame with diamond-cut filigree, anti-reflective mineral glass lenses, and 100% UV400 filtering.',
        28000.00,
        24500.00,
        30,
        ARRAY['https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=1200&q=80'],
        true,
        'a0000000-0000-0000-0000-000000000060'::uuid
      WHERE NOT EXISTS (SELECT 1 FROM "products" WHERE "slug" = 'elysium-polarized-japanese-beta-titanium-sunglasses');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "products" WHERE "id" IN (
        'b0000000-0000-0000-0000-000000000011'::uuid,
        'b0000000-0000-0000-0000-000000000021'::uuid,
        'b0000000-0000-0000-0000-000000000031'::uuid,
        'b0000000-0000-0000-0000-000000000041'::uuid,
        'b0000000-0000-0000-0000-000000000051'::uuid,
        'b0000000-0000-0000-0000-000000000061'::uuid
      );
      DELETE FROM "categories" WHERE "id" IN (
        'a0000000-0000-0000-0000-000000000010'::uuid,
        'a0000000-0000-0000-0000-000000000020'::uuid,
        'a0000000-0000-0000-0000-000000000030'::uuid,
        'a0000000-0000-0000-0000-000000000040'::uuid,
        'a0000000-0000-0000-0000-000000000050'::uuid,
        'a0000000-0000-0000-0000-000000000060'::uuid
      );
    `);
  }
}
