import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Return & Exchange Policy — BazaarFlow LUXE',
  description: 'Hassle-free 30-day returns and exchanges across India with complimentary white-glove pickup.',
};

export default function ReturnsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 lg:px-6">
      <div className="mb-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Client Care</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-fg md:text-4xl">
          Return &amp; Refund Policy
        </h1>
        <p className="mt-3 text-sm text-muted">
          Complimentary 30-day doorstep pickups across India for eligible luxury items.
        </p>
      </div>

      <div className="space-y-8 rounded-3xl border border-outline bg-panel p-6 sm:p-10">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-fg">1. 30-Day Luxury Guarantee</h2>
          <p className="text-sm leading-relaxed text-muted">
            At BazaarFlow LUXE, we take pride in delivering authenticated, pristine luxury merchandise. If your order does not meet your expectations, you may initiate a return or exchange within <strong className="text-fg">30 days</strong> of confirmed delivery across all pincodes in India.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-fg">2. Eligibility Conditions</h2>
          <p className="text-sm leading-relaxed text-muted">
            To ensure the integrity and provenance of our luxury catalog, items submitted for return must meet the following criteria:
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
            <li>Item must be in its original, unworn, and unblemished condition.</li>
            <li>All security tags, tamper-evident seals, and protective films must remain intact.</li>
            <li>Original packaging, authenticity cards, designer dust bags, and presentation boxes must be returned.</li>
            <li>Personalized or bespoke monogrammed orders are final sale and non-returnable.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-fg">3. Complimentary Doorstep Pickup</h2>
          <p className="text-sm leading-relaxed text-muted">
            We offer complimentary white-glove pickup across major metro areas (Mumbai, Delhi NCR, Bengaluru, Chennai, Hyderabad, Kolkata) and tier-1/tier-2 logistics hubs in India. Once your return request is logged, an authorized courier partner will collect the securely sealed parcel within 24 to 48 hours.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-fg">4. Inspection &amp; Refund Timelines</h2>
          <p className="text-sm leading-relaxed text-muted">
            Upon receipt at our fulfillment and verification center, our horology and leather specialists inspect the product within 48 business hours. Once verified:
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
            <li><strong className="text-fg">Credit/Debit Cards &amp; NetBanking:</strong> Refund settles in 3 to 5 business days via Stripe gateway.</li>
            <li><strong className="text-fg">UPI &amp; Mobile Payments:</strong> Instant to 24-hour reversal to the originating source account.</li>
            <li><strong className="text-fg">Store Credit:</strong> Instant credit credited to your account profile with a 10% bonus.</li>
          </ul>
        </section>

        <div className="rounded-2xl border border-brand/30 bg-brand/5 p-6">
          <h3 className="text-sm font-semibold text-fg">Need immediate assistance with a return?</h3>
          <p className="mt-1 text-sm text-muted">
            Our concierge team is available 7 days a week from 9:00 AM to 9:00 PM IST.
          </p>
          <div className="mt-4 flex flex-wrap gap-4">
            <Link
              href="/support"
              className="rounded-xl bg-fg px-4 py-2 text-sm font-semibold text-bg transition hover:opacity-90"
            >
              Contact Concierge
            </Link>
            <Link
              href="/account/orders"
              className="rounded-xl border border-outline bg-panel px-4 py-2 text-sm font-semibold text-fg transition hover:bg-bg-elevated"
            >
              Manage Orders
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
