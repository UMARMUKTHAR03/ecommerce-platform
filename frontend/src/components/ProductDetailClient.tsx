'use client';

import Image from 'next/image';
import { SideBySideMagnifier } from 'react-image-magnifiers';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiDelete, apiPost } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Product, ProductVariant, Review } from '@/lib/types';
import { useCart } from '@/context/cart.context';
import { EmptyState } from './EmptyState';
import { PriceDisplay } from './PriceDisplay';
import { RatingStars } from './RatingStars';
import { StockBadge } from './StockBadge';

const RECENT_KEY = 'recently_viewed_products';

interface ProductDetailClientProps {
  product: Product;
  relatedProducts: Product[];
}

function averageRating(reviews: Review[]) {
  if (!reviews.length) {
    return 0;
  }

  const sum = reviews.reduce((total, review) => total + Number(review.rating), 0);
  return sum / reviews.length;
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-full px-4 py-2 text-sm font-medium transition',
        active ? 'bg-fg text-bg' : 'bg-bg-elevated text-muted hover:text-fg',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export function ProductDetailClient({ product, relatedProducts }: ProductDetailClientProps) {
  const { addItem } = useCart();
  const [activeImage, setActiveImage] = useState(product.images[0] ?? '/images/placeholder-product.svg');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'description' | 'specs' | 'reviews'>('description');
  const [wishlistState, setWishlistState] = useState<'idle' | 'loading' | 'added'>('idle');

  const variants = useMemo(() => product.variants ?? [], [product.variants]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    variants.length ? variants[0].id : null,
  );

  const selectedVariant = useMemo(() => {
    return variants.find((v) => v.id === selectedVariantId) ?? null;
  }, [variants, selectedVariantId]);

  const effectivePrice = useMemo(() => {
    const base = Number(product.price);
    const adj = selectedVariant ? Number(selectedVariant.priceAdjustment || 0) : 0;
    return String(base + adj);
  }, [product.price, selectedVariant]);

  const effectiveDiscountPrice = useMemo(() => {
    if (!product.discountPrice) return null;
    const base = Number(product.discountPrice);
    const adj = selectedVariant ? Number(selectedVariant.priceAdjustment || 0) : 0;
    return String(base + adj);
  }, [product.discountPrice, selectedVariant]);

  const effectiveStock = useMemo(() => {
    return selectedVariant ? selectedVariant.stock : product.stock;
  }, [selectedVariant, product.stock]);

  const reviews = product.reviews ?? [];
  const rating = averageRating(reviews);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const raw = window.localStorage.getItem(RECENT_KEY);
      const existing = raw ? (JSON.parse(raw) as Product[]) : [];
      const merged = [product, ...existing.filter((item) => item.id !== product.id)].slice(0, 12);
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(merged));
    } catch {
      window.localStorage.removeItem(RECENT_KEY);
    }
  }, [product]);

  const ratingBreakdown = useMemo(() => {
    const map = new Map<number, number>();
    for (let level = 1; level <= 5; level += 1) {
      map.set(level, 0);
    }

    for (const review of reviews) {
      const score = Math.max(1, Math.min(5, Math.round(Number(review.rating))));
      map.set(score, (map.get(score) ?? 0) + 1);
    }

    return Array.from(map.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([score, count]) => ({
        score,
        count,
        percent: reviews.length ? (count / reviews.length) * 100 : 0,
      }));
  }, [reviews]);

  const maxQuantity = Math.max(1, effectiveStock);

  return (
    <div className="space-y-12">
      <section className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-3xl border border-outline bg-panel p-4">
            <SideBySideMagnifier
              imageSrc={activeImage}
              largeImageSrc={activeImage}
              alwaysInPlace={false}
              fillAvailableSpace
              overlayOpacity={0.2}
              className="max-h-[520px]"
            />
          </div>
          <div className="grid grid-cols-4 gap-3">
            {(product.images.length ? product.images : ['/images/placeholder-product.svg']).map((image) => (
              <button
                type="button"
                key={image}
                onClick={() => setActiveImage(image)}
                className={[
                  'overflow-hidden rounded-xl border bg-panel p-1 transition',
                  activeImage === image ? 'border-fg' : 'border-outline hover:border-fg/60',
                ].join(' ')}
              >
                <Image
                  src={image}
                  alt={product.title}
                  width={200}
                  height={160}
                  className="h-20 w-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <p className="text-xs uppercase tracking-[0.2em] text-brand">{product.category?.name ?? 'Featured Item'}</p>
          <h1 className="font-display text-3xl font-semibold text-fg lg:text-4xl">{product.title}</h1>

          <div className="flex items-center gap-4">
            <RatingStars rating={rating} count={reviews.length} />
            <StockBadge stock={effectiveStock} />
          </div>

          <PriceDisplay price={effectivePrice} discountPrice={effectiveDiscountPrice} className="text-2xl" />

          <p className="text-sm leading-7 text-muted">
            {product.description ?? 'Designed with premium materials for all-day comfort and consistent performance.'}
          </p>

          {/* Actual database variants selector */}
          {variants.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-wide text-muted">Edition / Variant</p>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => {
                  const label = v.title || `${v.size || ''} ${v.color || ''}`.trim() || v.sku;
                  const isSelected = v.id === selectedVariantId;
                  const isOutOfStock = v.stock <= 0;

                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={isOutOfStock}
                      onClick={() => {
                        setSelectedVariantId(v.id);
                        setQuantity(1);
                      }}
                      className={[
                        'rounded-xl border px-3 py-2 text-xs font-semibold transition',
                        isSelected
                          ? 'border-fg bg-fg text-bg'
                          : isOutOfStock
                            ? 'border-outline bg-panel/50 text-muted line-through opacity-50'
                            : 'border-outline bg-panel text-fg hover:border-fg/50',
                      ].join(' ')}
                    >
                      <span>{label}</span>
                      {Number(v.priceAdjustment) !== 0 ? (
                        <span className="ml-1.5 opacity-80">
                          ({Number(v.priceAdjustment) > 0 ? '+' : ''}{formatCurrency(Number(v.priceAdjustment))})
                        </span>
                      ) : null}
                      <span className="ml-1.5 text-[10px] opacity-70">({v.stock} in stock)</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <label htmlFor="quantity" className="text-sm text-muted">
              Qty
            </label>
            <input
              id="quantity"
              type="number"
              min={1}
              max={maxQuantity}
              value={quantity}
              onChange={(event) => {
                const raw = Number(event.target.value);
                setQuantity(Number.isFinite(raw) ? Math.min(Math.max(1, raw), maxQuantity) : 1);
              }}
              className="h-11 w-24 rounded-xl border border-outline bg-panel px-3 text-center text-sm text-fg"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => addItem(product, quantity, selectedVariant ?? undefined)}
              disabled={effectiveStock <= 0}
              className="rounded-xl bg-fg px-5 py-3 text-sm font-semibold text-bg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add to Cart
            </button>
            <button
              type="button"
              onClick={async () => {
                setWishlistState('loading');
                try {
                  if (wishlistState === 'added') {
                    await apiDelete(`/store/wishlist/${product.id}`);
                    setWishlistState('idle');
                    return;
                  }

                  await apiPost(`/store/wishlist/${product.id}`);
                  setWishlistState('added');
                } catch {
                  setWishlistState('idle');
                }
              }}
              className="rounded-xl border border-outline bg-panel px-5 py-3 text-sm font-semibold text-fg transition hover:border-fg/50"
            >
              {wishlistState === 'loading'
                ? 'Updating...'
                : wishlistState === 'added'
                  ? 'Added to Wishlist'
                  : 'Add to Wishlist'}
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-6 rounded-3xl border border-outline bg-panel p-6">
        <div className="flex flex-wrap gap-2">
          <TabButton active={activeTab === 'description'} onClick={() => setActiveTab('description')}>
            Description
          </TabButton>
          <TabButton active={activeTab === 'specs'} onClick={() => setActiveTab('specs')}>
            Specifications
          </TabButton>
          <TabButton active={activeTab === 'reviews'} onClick={() => setActiveTab('reviews')}>
            Reviews ({reviews.length})
          </TabButton>
        </div>

        {activeTab === 'description' ? (
          <div className="space-y-3 text-sm leading-7 text-muted">
            <p>{product.description ?? 'No extended description provided.'}</p>
          </div>
        ) : null}

        {activeTab === 'specs' ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-outline bg-bg-elevated p-3">
              <dt className="text-xs uppercase text-muted">SKU Reference</dt>
              <dd className="mt-1 font-semibold text-fg">{selectedVariant?.sku ?? product.slug}</dd>
            </div>
            <div className="rounded-xl border border-outline bg-bg-elevated p-3">
              <dt className="text-xs uppercase text-muted">Inventory Available</dt>
              <dd className="mt-1 font-semibold text-fg">{effectiveStock} units</dd>
            </div>
            <div className="rounded-xl border border-outline bg-bg-elevated p-3">
              <dt className="text-xs uppercase text-muted">Category</dt>
              <dd className="mt-1 font-semibold text-fg">{product.category?.name ?? 'Uncategorized'}</dd>
            </div>
            <div className="rounded-xl border border-outline bg-bg-elevated p-3">
              <dt className="text-xs uppercase text-muted">Selected Variant</dt>
              <dd className="mt-1 font-semibold text-fg">{selectedVariant?.title ?? 'Standard Edition'}</dd>
            </div>
          </dl>
        ) : null}

        {activeTab === 'reviews' ? (
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-[220px_1fr]">
              <div className="space-y-2 rounded-2xl border border-outline bg-bg-elevated p-4 text-center">
                <p className="font-display text-4xl font-bold text-fg">{rating.toFixed(1)}</p>
                <RatingStars rating={rating} />
                <p className="text-xs text-muted">Based on {reviews.length} reviews</p>
              </div>

              <div className="space-y-2">
                {ratingBreakdown.map((row) => (
                  <div key={row.score} className="flex items-center gap-3 text-xs text-muted">
                    <span className="w-8">{row.score}★</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-outline">
                      <div className="h-full bg-brand" style={{ width: `${row.percent}%` }} />
                    </div>
                    <span className="w-8 text-right">{row.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {reviews.length ? (
                reviews.map((review) => (
                  <article key={review.id} className="rounded-2xl border border-outline bg-bg-elevated p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-fg">{review.customer?.name ?? 'Verified Buyer'}</p>
                      <time className="text-xs text-muted">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </time>
                    </div>
                    <div className="mt-1">
                      <RatingStars rating={review.rating} />
                    </div>
                    <p className="mt-2 text-muted">{review.body ?? 'No review text provided.'}</p>
                  </article>
                ))
              ) : (
                <EmptyState
                  title="No reviews yet"
                  description="Be the first verified purchaser to leave feedback."
                />
              )}
            </div>
          </div>
        ) : null}
      </section>

      {relatedProducts.length ? (
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold text-fg">Complete the Look</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {relatedProducts.map((item) => (
              <article key={item.id} className="space-y-2 rounded-2xl border border-outline bg-panel p-4">
                <Image
                  src={item.images[0] ?? '/images/placeholder-product.svg'}
                  alt={item.title}
                  width={300}
                  height={220}
                  className="h-36 w-full rounded-xl object-cover"
                />
                <h3 className="line-clamp-1 font-semibold text-fg">{item.title}</h3>
                <PriceDisplay price={item.price} discountPrice={item.discountPrice} />
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
