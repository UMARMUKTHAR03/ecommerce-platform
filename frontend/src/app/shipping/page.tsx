import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Shipping & Delivery Details — BazaarFlow LUXE',
  description: 'Fast, secure insured delivery across India with real-time tracking.',
};

export default function ShippingPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 lg:px-6">
      <div className="mb-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Fulfillment</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-fg md:text-4xl">
          Pan-India Shipping &amp; Delivery
        </h1>
        <p className="mt-3 text-sm text-muted">
          Insured transit, tamper-proof packaging, and guaranteed delivery timelines across India.
        </p>
      </div>

      <div className="space-y-8 rounded-3xl border border-outline bg-panel p-6 sm:p-10">
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-fg">Delivery Options &amp; Rates</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-outline bg-bg-elevated p-5">
              <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">Standard Delivery</span>
              <p className="mt-3 font-display text-2xl font-semibold text-fg">₹120</p>
              <p className="mt-1 text-xs text-muted">Complimentary on orders above ₹2,000</p>
              <ul className="mt-4 space-y-1.5 text-xs text-muted">
                <li>• Metro cities: 2–3 business days</li>
                <li>• Tier-2 &amp; Tier-3 cities: 3–5 business days</li>
                <li>• Insured packaging &amp; live SMS tracking</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-brand/40 bg-brand/5 p-5">
              <span className="rounded-full bg-fg px-3 py-1 text-xs font-semibold text-bg">Express Priority</span>
              <p className="mt-3 font-display text-2xl font-semibold text-fg">₹220</p>
              <p className="mt-1 text-xs text-muted">Expedited air-courier transit</p>
              <ul className="mt-4 space-y-1.5 text-xs text-fg">
                <li>• Next business day in Mumbai, Delhi NCR, Bengaluru</li>
                <li>• 24–48 hours in Chennai, Hyderabad, Kolkata</li>
                <li>• Priority dispatch &amp; dedicated courier line</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-fg">Packaging &amp; Security</h2>
          <p className="text-sm leading-relaxed text-muted">
            Every BazaarFlow LUXE order is handled with extreme care:
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
            <li>Packaged in double-walled, tamper-evident security cartons with individual barcode seals.</li>
            <li>Fully insured against transit damage, loss, or theft from dispatch until handover.</li>
            <li>One-Time Password (OTP) verification upon delivery ensures only the designated recipient receives the package.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-fg">Order Tracking</h2>
          <p className="text-sm leading-relaxed text-muted">
            As soon as your package leaves our fulfillment atelier, you will receive an SMS and email notification with an active tracking link. You can also view live delivery milestones directly in your{' '}
            <Link href="/account/orders" className="text-brand underline hover:text-fg">
              Order History
            </Link>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-fg">Service Coverage</h2>
          <p className="text-sm leading-relaxed text-muted">
            We deliver to over 19,000+ pin codes across all states and union territories in India via verified tier-1 logistics partners including Blue Dart, Delhivery, and DTDC.
          </p>
        </section>
      </div>
    </main>
  );
}
