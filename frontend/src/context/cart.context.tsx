'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Product, ProductVariant } from '@/lib/types';

export interface CartItem {
  cartItemId: string; // unique key combining productId and variantId
  productId: string;
  variantId?: string;
  variantTitle?: string;
  slug: string;
  title: string;
  image: string;
  price: number;
  discountPrice: number | null;
  quantity: number;
  stock: number;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (product: Product, quantity?: number, variant?: ProductVariant) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
  total: number;
}

const CART_KEY = 'commerce_cart_v3';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CartContext = createContext<CartContextValue | undefined>(undefined);

function normalizeCartItem(
  product: Product,
  quantity: number,
  variant?: ProductVariant,
): CartItem {
  const adjustment = variant ? Number(variant.priceAdjustment || 0) : 0;
  const basePrice = Number(product.price) + adjustment;
  const discountPrice = product.discountPrice ? Number(product.discountPrice) + adjustment : null;
  const stock = variant ? variant.stock : product.stock;
  const cartItemId = variant ? `${product.id}:${variant.id}` : product.id;

  return {
    cartItemId,
    productId: product.id,
    variantId: variant?.id,
    variantTitle: variant?.title || (variant?.size ? `${variant.size} / ${variant.color || ''}` : undefined),
    slug: product.slug,
    title: product.title,
    image: product.images[0] ?? '/images/placeholder-product.svg',
    price: basePrice,
    discountPrice,
    quantity,
    stock,
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      let stored = window.localStorage.getItem(CART_KEY);
      if (!stored) {
        stored = window.localStorage.getItem('commerce_cart_v2');
      }
      if (stored) {
        const parsed = JSON.parse(stored) as CartItem[];
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
    } catch {
      window.localStorage.removeItem(CART_KEY);
      window.localStorage.removeItem('commerce_cart_v2');
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items, isHydrated]);

  const value = useMemo<CartContextValue>(() => {
    const addItem = (product: Product, quantity = 1, variant?: ProductVariant) => {
      if (!product || !product.id) {
        return;
      }

      setItems((current) => {
        const targetId = variant ? `${product.id}:${variant.id}` : product.id;
        const existing = current.find((item) => (item.cartItemId || item.productId) === targetId);

        const availableStock = variant ? variant.stock : product.stock;

        if (!existing) {
          return [...current, normalizeCartItem(product, Math.max(1, quantity), variant)];
        }

        return current.map((item) => {
          if ((item.cartItemId || item.productId) !== targetId) {
            return item;
          }

          const nextQuantity = Math.min(item.quantity + quantity, Math.max(availableStock, 1));
          return {
            ...item,
            quantity: nextQuantity,
            stock: availableStock,
          };
        });
      });
    };

    const removeItem = (cartItemId: string) => {
      setItems((current) =>
        current.filter((item) => (item.cartItemId || item.productId) !== cartItemId),
      );
    };

    const updateQuantity = (cartItemId: string, quantity: number) => {
      setItems((current) =>
        current.map((item) => {
          if ((item.cartItemId || item.productId) !== cartItemId) {
            return item;
          }

          const nextQuantity = Math.min(Math.max(1, quantity), Math.max(item.stock, 1));
          return {
            ...item,
            quantity: nextQuantity,
          };
        }),
      );
    };

    const clearCart = () => {
      setItems([]);
    };

    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const total = items.reduce((sum, item) => {
      const unitPrice = item.discountPrice ?? item.price;
      return sum + unitPrice * item.quantity;
    }, 0);

    return {
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      itemCount,
      subtotal,
      total,
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used inside CartProvider');
  }

  return context;
}
