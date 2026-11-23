'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiGet, apiPut } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

interface OrderDetail {
  id: string;
  status: string;
  total: string;
  paymentMethod: string | null;
  paymentReference: string | null;
  trackingNumber: string | null;
  createdAt: string;
  customer?: { name: string; email: string; phone: string | null };
  items: Array<{
    id: string;
    quantity: number;
    price: string;
    product?: { title: string };
  }>;
}

const STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'] as const;

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [trackingInput, setTrackingInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    apiGet<OrderDetail>(`/admin/orders/${orderId}`)
      .then((payload) => {
        setOrder(payload);
        setTrackingInput(payload.trackingNumber ?? '');
      })
      .finally(() => setLoading(false));
  }, [orderId]);

  async function updateStatus(nextStatus: string) {
    if (!orderId) return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await apiPut<OrderDetail>(`/admin/orders/${orderId}/status`, {
        status: nextStatus,
        trackingNumber: trackingInput.trim() || undefined,
      });
      setOrder(updated);
      setTrackingInput(updated.trackingNumber ?? '');
      setMessage('Status updated successfully.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function saveTracking() {
    if (!orderId || !order) return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await apiPut<OrderDetail>(`/admin/orders/${orderId}/status`, {
        status: order.status,
        trackingNumber: trackingInput.trim() || undefined,
      });
      setOrder(updated);
      setTrackingInput(updated.trackingNumber ?? '');
      setMessage('Tracking number saved.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-300">Loading order detail...</p>;
  }

  if (!order) {
    return <p className="rounded-lg bg-rose-900/40 px-3 py-2 text-sm text-rose-200">Order not found.</p>;
  }

  return (
    <div className="space-y-5">
      <Link href="/admin/orders" prefetch={true} className="text-sm text-sky-300 hover:underline">
        Back to orders
      </Link>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-lg font-semibold">Order #{order.id.slice(0, 8)}</h2>
        <p className="mt-1 text-sm text-slate-300">Status: {order.status}</p>
        <p className="text-sm text-slate-300">Total: {formatCurrency(order.total)}</p>
        <p className="text-sm text-slate-300">Payment Method: {order.paymentMethod ?? 'N/A'}</p>
        <p className="text-sm text-slate-300">Payment Reference: {order.paymentReference ?? 'N/A'}</p>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="text-base font-semibold">Customer</h3>
        <p className="mt-2 text-sm text-slate-300">{order.customer?.name || 'N/A'}</p>
        <p className="text-sm text-slate-300">{order.customer?.email || 'N/A'}</p>
        <p className="text-sm text-slate-300">{order.customer?.phone || 'N/A'}</p>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="text-base font-semibold">Items</h3>
        <div className="mt-3 space-y-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-md border border-slate-800 px-3 py-2 text-sm">
              <p>{item.product?.title || 'Product'}</p>
              <p>
                {item.quantity} x {formatCurrency(item.price)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="text-base font-semibold">Shipping & Tracking</h3>
        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor="tracking" className="text-xs text-slate-400">
              REDX Tracking Number
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="tracking"
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value)}
                placeholder="Enter REDX tracking number"
                className="h-9 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm"
              />
              <button
                type="button"
                onClick={saveTracking}
                disabled={saving}
                className="h-9 rounded-md bg-sky-600 px-4 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="text-base font-semibold">Update Status</h3>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {STATUSES.map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => updateStatus(entry)}
              disabled={saving || order.status === entry}
              className={[
                'rounded-md px-3 py-1.5 text-xs font-medium transition',
                order.status === entry
                  ? 'bg-sky-600 text-white'
                  : 'border border-slate-700 text-slate-300 hover:border-slate-500 disabled:opacity-50',
              ].join(' ')}
            >
              {entry}
            </button>
          ))}
        </div>
        {message ? (
          <p className="mt-3 rounded-md bg-slate-800 px-3 py-2 text-xs text-slate-300">{message}</p>
        ) : null}
      </section>
    </div>
  );
}
