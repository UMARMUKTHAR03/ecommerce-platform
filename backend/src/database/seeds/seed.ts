import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Category } from '../../entities/category.entity';
import { Product } from '../../entities/product.entity';
import { ProductVariant } from '../../entities/product-variant.entity';
import { Coupon, CouponType } from '../../entities/coupon.entity';
import { Admin, AdminRole } from '../../entities/admin.entity';

export async function runDatabaseSeed(dataSource: DataSource) {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    const categoryRepo = queryRunner.manager.getRepository(Category);
    const productRepo = queryRunner.manager.getRepository(Product);
    const variantRepo = queryRunner.manager.getRepository(ProductVariant);
    const couponRepo = queryRunner.manager.getRepository(Coupon);
    const adminRepo = queryRunner.manager.getRepository(Admin);

    // 1. Categories
    const categoriesData = [
      {
        name: 'Timepieces',
        slug: 'timepieces',
        description: 'Mastercrafted horology and Swiss-engineered mechanical luxury watches.',
        imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30',
      },
      {
        name: 'Leather Goods',
        slug: 'leather-goods',
        description: 'Full-grain artisan leather accessories, briefcases, and travel essentials.',
        imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa',
      },
      {
        name: 'Fine Fragrances',
        slug: 'fine-fragrances',
        description: 'Exquisite niche perfumery and handcrafted botanical essences.',
        imageUrl: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539',
      },
    ];

    const categoryMap = new Map<string, Category>();
    for (const cat of categoriesData) {
      let existing = await categoryRepo.findOneBy({ slug: cat.slug });
      if (!existing) {
        existing = await categoryRepo.save(categoryRepo.create(cat));
      }
      categoryMap.set(cat.slug, existing);
    }

    // 2. Products and Variants
    const productsData = [
      {
        title: 'Aethelgard Chronograph Royal Obsidian',
        slug: 'aethelgard-chronograph-royal-obsidian',
        description:
          'Precision automatic chronograph encased in brushed Grade-5 titanium with a double anti-reflective sapphire crystal and exhibition caseback.',
        price: '48500.00',
        discountPrice: '44900.00',
        stock: 18,
        images: [
          'https://images.unsplash.com/photo-1523275335684-37898b6baf30',
          'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9',
        ],
        categorySlug: 'timepieces',
        variants: [
          { sku: 'AETHEL-OBS-40', title: '40mm Titanium / Obsidian Dial', size: '40mm', color: 'Obsidian', priceAdjustment: '0.00', stock: 10 },
          { sku: 'AETHEL-OBS-42', title: '42mm Titanium / Obsidian Dial', size: '42mm', color: 'Obsidian', priceAdjustment: '2500.00', stock: 8 },
        ],
      },
      {
        title: 'Vanguard Artisan Calfskin Weekender',
        slug: 'vanguard-artisan-calfskin-weekender',
        description:
          'Handcrafted vegetable-tanned Italian calfskin duffle bag with solid brass hardware, YKK Excella zippers, and waterproof nylon lining.',
        price: '28900.00',
        discountPrice: null,
        stock: 25,
        images: [
          'https://images.unsplash.com/photo-1548036328-c9fa89d128fa',
        ],
        categorySlug: 'leather-goods',
        variants: [
          { sku: 'VANGUARD-COGNAC', title: 'Cognac Brown', size: 'Medium', color: 'Cognac', priceAdjustment: '0.00', stock: 15 },
          { sku: 'VANGUARD-NOIR', title: 'Noir Matte', size: 'Medium', color: 'Noir', priceAdjustment: '1200.00', stock: 10 },
        ],
      },
      {
        title: 'Santal Impérial Extrait de Parfum 100ml',
        slug: 'santal-imperial-extrait-de-parfum-100ml',
        description:
          'A rich smoky sandalwood and ambergris composition infused with cardamom, smoked cedar, and rare bourbon vanilla.',
        price: '16500.00',
        discountPrice: '14800.00',
        stock: 40,
        images: [
          'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539',
        ],
        categorySlug: 'fine-fragrances',
        variants: [
          { sku: 'SANTAL-EXT-50', title: '50ml Flacon', size: '50ml', color: 'Clear', priceAdjustment: '-3500.00', stock: 20 },
          { sku: 'SANTAL-EXT-100', title: '100ml Flacon', size: '100ml', color: 'Clear', priceAdjustment: '0.00', stock: 20 },
        ],
      },
    ];

    for (const prod of productsData) {
      let product = await productRepo.findOneBy({ slug: prod.slug });
      const cat = categoryMap.get(prod.categorySlug);

      if (!product) {
        product = await productRepo.save(
          productRepo.create({
            title: prod.title,
            slug: prod.slug,
            description: prod.description,
            price: prod.price,
            discountPrice: prod.discountPrice,
            stock: prod.stock,
            images: prod.images,
            categoryId: cat?.id ?? null,
            isActive: true,
          }),
        );
      }

      for (const v of prod.variants) {
        const existingVariant = await variantRepo.findOneBy({ sku: v.sku });
        if (!existingVariant) {
          await variantRepo.save(
            variantRepo.create({
              ...v,
              productId: product.id,
            }),
          );
        }
      }
    }

    // 3. Coupons
    const defaultCoupons = [
      {
        code: 'LUXE10',
        type: CouponType.PERCENTAGE,
        value: '10.00',
        minSpend: '1000.00',
        usageLimit: 500,
        usedCount: 0,
        isActive: true,
      },
      {
        code: 'WELCOME500',
        type: CouponType.FIXED,
        value: '500.00',
        minSpend: '3000.00',
        usageLimit: 1000,
        usedCount: 0,
        isActive: true,
      },
    ];

    for (const coup of defaultCoupons) {
      const existing = await couponRepo.findOneBy({ code: coup.code });
      if (!existing) {
        await couponRepo.save(couponRepo.create(coup));
      }
    }

    // 4. Default Admin User
    const adminEmail = (process.env.ADMIN_EMAIL ?? 'admin@bazaarflow.com').toLowerCase();
    const existingAdmin = await adminRepo.findOneBy({ email: adminEmail });
    if (!existingAdmin) {
      const rawPassword = process.env.ADMIN_INITIAL_PASSWORD;
      if (!rawPassword) {
        console.warn(
          'ADMIN_INITIAL_PASSWORD is not set. Skipping initial admin user creation to avoid insecure defaults.',
        );
      } else {
        const hash = await bcrypt.hash(rawPassword, 10);
        await adminRepo.save(
          adminRepo.create({
            email: adminEmail,
            passwordHash: hash,
            name: 'BazaarFlow Executive',
            role: AdminRole.SUPERADMIN,
            isActive: true,
          }),
        );
      }
    }
  } finally {
    await queryRunner.release();
  }
}
