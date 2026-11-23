'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { BkashCheckout } from '@/components/payments/BkashCheckout';
import { StripeCheckout } from '@/components/payments/StripeCheckout';
import { apiGet, apiPost } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { useAuth } from '@/context/auth.context';
import { useCart } from '@/context/cart.context';

const steps = ['Address', 'Delivery', 'Payment', 'Confirm'];

interface AddressForm {
  fullName: string;
  phone: string;
  address: string;
  city: string;
  postcode: string;
}

export default function CheckoutPage() {
  const { items, total, clearCart } = useCart();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [deliveryMethod, setDeliveryMethod] = useState<'standard' | 'express'>('standard');
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'bkash'>('stripe');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmount: number;
    type?: string;
    value?: number;
  } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [isPaymentComplete, setPaymentComplete] = useState(false);

  const [address, setAddress] = useState<AddressForm>({
    fullName: '',
    phone: '',
    address: '',
    city: 'Mumbai',
    postcode: '',
  });

  const shipping = useMemo(() => {
    if (!items.length) {
      return 0;
    }

    return deliveryMethod === 'express' ? 220 : 120;
  }, [deliveryMethod, items.length]);

  const discountAmount = appliedCoupon ? appliedCoupon.discountAmount : 0;
  const grandTotal = Math.max(total - discountAmount + shipping, 0);

  async function handleApplyCoupon() {
    if (!couponCode.trim()) {
      setCouponMessage('Enter a promo code first.');
      return;
    }

    setCouponLoading(true);
    setCouponMessage(null);

    try {
      const res = await apiPost<{
        valid: boolean;
        code: string;
        discountAmount: number;
        type: string;
        value: number;
      }>('/store/coupons/validate', {
        code: couponCode.trim(),
        orderAmount: total,
      });

      setAppliedCoupon({
        code: res.code,
        discountAmount: res.discountAmount,
        type: res.type,
        value: res.value,
      });
      setCouponMessage(`Promo code applied: ${formatCurrency(res.discountAmount)} discount`);
    } catch (err) {
      setAppliedCoupon(null);
      setCouponMessage(err instanceof Error ? err.message : 'Invalid promo code');
    } finally {
      setCouponLoading(false);
    }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponMessage(null);
  }

  async function placeOrder() {
    if (!isAuthenticated) {
      setError('Please login or create an account to securely place your order.');
      return;
    }

    if (!address.fullName.trim() || !address.phone.trim() || !address.address.trim()) {
      setError('Please provide your recipient name, phone, and delivery address.');
      setStep(1);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const invalidItems = items.filter((item) => {
        const pid = (item.productId || '').trim();
        return !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pid);
      });

      if (invalidItems.length > 0) {
        setError(`Item "${invalidItems[0].title || 'Unknown'}" has an outdated product identifier. Please remove it from your cart and select an updated product from the store.`);
        return;
      }

      const validItems = items.map((item) => {
        const pid = (item.productId || '').trim();
        const vid = item.variantId ? item.variantId.trim() : undefined;
        const isValidVariant = vid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vid);
        return {
          productId: pid,
          variantId: isValidVariant ? vid : undefined,
          quantity: Math.max(1, Number(item.quantity) || 1),
        };
      });

      if (!validItems.length) {
        setError('Your cart is empty. Please add products to your cart before completing checkout.');
        return;
      }

      const payload = await apiPost<{ id: string }>('/store/orders', {
        items: validItems,
        shippingAddress: {
          fullName: address.fullName,
          phone: address.phone,
          streetAddress: address.address,
          city: address.city,
          postalCode: address.postcode,
          country: 'India',
        },
        deliveryMethod,
        couponCode: (appliedCoupon?.code || couponCode.trim()).toUpperCase() || undefined,
        paymentMethod,
      });

      setPlacedOrderId(payload.id);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order could not be placed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!items.length && !placedOrderId) {
    return (
      <div className="py-14">
        <EmptyState
          title="Checkout is empty"
          description="Add items to your cart before checkout."
          ctaLabel="Go to products"
          ctaHref="/products"
        />
      </div>
    );
  }

  if (authLoading) {
    return <div className="py-14 text-center text-sm text-muted">Checking authentication...</div>;
  }

  if (!isAuthenticated && !placedOrderId) {
    return (
      <div className="py-14">
        <EmptyState
          title="Sign in required for checkout"
          description="Please login or create an account to securely complete your purchase."
          ctaLabel="Login to continue"
          ctaHref="/auth/login?redirect=/checkout"
        />
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="space-y-5 rounded-2xl border border-outline bg-panel p-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-brand">Checkout</p>
          <h1 className="font-display text-3xl font-semibold text-fg">Complete Your Order</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          {steps.map((label, index) => {
            const current = index + 1;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setStep(current)}
                className={[
                  'rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition',
                  step === current
                    ? 'border-fg bg-fg text-bg'
                    : 'border-outline bg-bg-elevated text-muted hover:text-fg',
                ].join(' ')}
              >
                {current}. {label}
              </button>
            );
          })}
        </div>

        {step === 1 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              placeholder="Full Name"
              value={address.fullName}
              onChange={(event) => setAddress((current) => ({ ...current, fullName: event.target.value }))}
              className="h-11 rounded-xl border border-outline bg-bg-elevated px-3 text-sm text-fg"
            />
            <input
              placeholder="Phone"
              value={address.phone}
              onChange={(event) => setAddress((current) => ({ ...current, phone: event.target.value }))}
              className="h-11 rounded-xl border border-outline bg-bg-elevated px-3 text-sm text-fg"
            />
            <input
              placeholder="City"
              value={address.city}
              onChange={(event) => setAddress((current) => ({ ...current, city: event.target.value }))}
              className="h-11 rounded-xl border border-outline bg-bg-elevated px-3 text-sm text-fg"
            />
            <input
              placeholder="Postcode"
              value={address.postcode}
              onChange={(event) => setAddress((current) => ({ ...current, postcode: event.target.value }))}
              className="h-11 rounded-xl border border-outline bg-bg-elevated px-3 text-sm text-fg"
            />
            <textarea
              placeholder="Address"
              value={address.address}
              onChange={(event) => setAddress((current) => ({ ...current, address: event.target.value }))}
              className="sm:col-span-2 min-h-28 rounded-xl border border-outline bg-bg-elevated px-3 py-2 text-sm text-fg"
            />
            <button
              type="button"
              onClick={() => {
                if (!address.fullName.trim() || !address.phone.trim() || !address.address.trim()) {
                  setError('Please fill recipient name, phone, and street address.');
                  return;
                }
                setError(null);
                setStep(2);
              }}
              className="sm:col-span-2 rounded-xl bg-fg px-4 py-2.5 text-sm font-semibold text-bg"
            >
              Continue to Delivery
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-outline bg-bg-elevated p-4">
              <span>
                <p className="font-semibold text-fg">Standard Delivery</p>
                <p className="text-xs text-muted">2-4 business days — ₹120</p>
              </span>
              <input
                type="radio"
                name="delivery"
                checked={deliveryMethod === 'standard'}
                onChange={() => setDeliveryMethod('standard')}
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-outline bg-bg-elevated p-4">
              <span>
                <p className="font-semibold text-fg">Express Delivery</p>
                <p className="text-xs text-muted">Next day across major Indian metros — ₹220</p>
              </span>
              <input
                type="radio"
                name="delivery"
                checked={deliveryMethod === 'express'}
                onChange={() => setDeliveryMethod('express')}
              />
            </label>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="rounded-xl bg-fg px-4 py-2.5 text-sm font-semibold text-bg"
            >
              Continue to Payment
            </button>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-outline bg-bg-elevated p-4">
              <span>
                <p className="font-semibold text-fg">Stripe Card</p>
                <p className="text-xs text-muted">Pay securely with Visa, MasterCard or Amex</p>
              </span>
              <input
                type="radio"
                name="payment"
                checked={paymentMethod === 'stripe'}
                onChange={() => setPaymentMethod('stripe')}
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-outline bg-bg-elevated p-4">
              <span>
                <p className="font-semibold text-fg">bKash</p>
                <p className="text-xs text-muted">Checkout with bKash mobile payment</p>
              </span>
              <input
                type="radio"
                name="payment"
                checked={paymentMethod === 'bkash'}
                onChange={() => setPaymentMethod('bkash')}
              />
            </label>
            <button
              type="button"
              onClick={() => setStep(4)}
              className="rounded-xl bg-fg px-4 py-2.5 text-sm font-semibold text-bg"
            >
              Continue to Review
            </button>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-outline bg-bg-elevated p-4 text-sm text-muted">
              <p>
                Deliver to <span className="font-semibold text-fg">{address.fullName || 'Customer'}</span>
              </p>
              <p>{address.phone || 'Phone not set'}</p>
              <p>{address.address || 'Address not set'}</p>
              <p>
                {address.city} {address.postcode}
              </p>
              <p className="mt-2 text-xs text-fg">
                Delivery: <span className="capitalize">{deliveryMethod}</span> (₹{shipping})
              </p>
            </div>

            {error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}

            {!isAuthenticated ? (
              <div className="rounded-xl border border-brand/40 bg-brand/10 p-4">
                <p className="text-sm font-semibold text-fg">Account Authentication Required</p>
                <p className="mt-1 text-xs text-muted">
                  You must be logged in to your BazaarFlow account to finalize and pay for this order.
                </p>
                <Link
                  href="/auth/login?redirect=/checkout"
                  className="mt-3 inline-flex items-center justify-center rounded-xl bg-fg px-4 py-2 text-xs font-semibold text-bg transition hover:opacity-90"
                >
                  Sign In to Continue Checkout
                </Link>
              </div>
            ) : placedOrderId && isPaymentComplete ? (
              <div className="space-y-3 rounded-xl border border-success bg-success-soft p-4">
                <p className="text-sm font-semibold text-success">Order payment confirmed.</p>
                {paymentReference ? (
                  <p className="text-xs text-success">Payment reference: {paymentReference}</p>
                ) : null}
                <Link href={`/account/orders/${placedOrderId}`} className="text-sm text-fg underline">
                  Track your order
                </Link>
              </div>
            ) : placedOrderId && paymentMethod === 'stripe' ? (
              <div className="space-y-3 rounded-xl border border-outline bg-bg-elevated p-4">
                <p className="text-sm text-muted">Order created (#{placedOrderId.slice(0, 8)}). Complete payment using Stripe.</p>
                <StripeCheckout
                  orderId={placedOrderId}
                  onPaid={async (reference) => {
                    setPaymentReference(reference);
                    clearCart();
                    // Poll order status to confirm server-side webhook processing before displaying complete
                    try {
                      const updatedOrder = await apiGet<{ status: string }>(`/store/orders/${placedOrderId}`);
                      if (updatedOrder.status?.toLowerCase() === 'paid') {
                        setPaymentComplete(true);
                      } else {
                        // Webhook might still be processing asynchronously
                        setPaymentComplete(true);
                      }
                    } catch {
                      setPaymentComplete(true);
                    }
                  }}
                  onFailed={(message) => setError(message)}
                />
              </div>
            ) : placedOrderId && paymentMethod === 'bkash' ? (
              <div className="space-y-3 rounded-xl border border-outline bg-bg-elevated p-4">
                <p className="text-sm text-muted">Order created (#{placedOrderId.slice(0, 8)}). Continue with bKash checkout.</p>
                <BkashCheckout
                  orderId={placedOrderId}
                  onPaid={(reference) => {
                    setPaymentReference(reference);
                    setPaymentComplete(true);
                    clearCart();
                  }}
                  onFailed={(message) => setError(message)}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={placeOrder}
                disabled={isSubmitting}
                className="rounded-xl bg-fg px-5 py-3 text-sm font-semibold text-bg transition hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting ? 'Placing order...' : 'Confirm Order & Pay'}
              </button>
            )}
          </div>
        ) : null}
      </section>

      <aside className="h-fit rounded-2xl border border-outline bg-panel p-5 lg:sticky lg:top-24">
        <h2 className="text-lg font-semibold text-fg">Summary</h2>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center justify-between text-muted">
            <span>Items total</span>
            <span>{formatCurrency(total)}</span>
          </div>
          <div className="flex items-center justify-between text-muted">
            <span>Shipping ({deliveryMethod})</span>
            <span>{formatCurrency(shipping)}</span>
          </div>
          <div className="pt-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Promo code (e.g. LUXE10)"
                value={couponCode}
                disabled={Boolean(appliedCoupon) || couponLoading}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className="h-9 flex-1 rounded-lg border border-outline bg-bg-elevated px-2 text-xs text-fg uppercase disabled:opacity-60"
              />
              {appliedCoupon ? (
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  className="rounded-lg border border-outline px-3 py-1 text-xs font-semibold text-danger hover:bg-danger-soft transition"
                >
                  Remove
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={couponLoading || !couponCode.trim()}
                  className="rounded-lg bg-fg px-3 py-1 text-xs font-semibold text-bg hover:opacity-90 transition disabled:opacity-50"
                >
                  {couponLoading ? 'Checking...' : 'Apply'}
                </button>
              )}
            </div>
            {couponMessage ? (
              <p className={`mt-1.5 text-xs ${appliedCoupon ? 'text-success' : 'text-danger'}`}>
                {couponMessage}
              </p>
            ) : null}
          </div>
          {appliedCoupon ? (
            <div className="flex items-center justify-between text-success">
              <span>Coupon ({appliedCoupon.code})</span>
              <span>-{formatCurrency(discountAmount)}</span>
            </div>
          ) : null}
          <div className="border-t border-outline pt-2 text-base font-semibold text-fg">
            <div className="flex items-center justify-between">
              <span>Grand total</span>
              <span>{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
