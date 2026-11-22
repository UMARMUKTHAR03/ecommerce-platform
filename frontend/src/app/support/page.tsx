'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function SupportPage() {
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 600);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 lg:px-6">
      <div className="mb-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Customer Care</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-fg md:text-4xl">
          BazaarFlow Concierge &amp; Support
        </h1>
        <p className="mt-3 text-sm text-muted">
          Dedicated assistance for product inquiries, bespoke orders, and pan-India shipping.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Contact Info Cards */}
        <div className="space-y-4 lg:col-span-1">
          <div className="rounded-3xl border border-outline bg-panel p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="mt-4 font-semibold text-fg">Direct Concierge Email</h3>
            <p className="mt-1 text-xs text-muted">Response within 2 hours</p>
            <a href="mailto:support@bazaarflow.com" className="mt-3 block text-sm font-medium text-brand hover:underline">
              support@bazaarflow.com
            </a>
          </div>

          <div className="rounded-3xl border border-outline bg-panel p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <h3 className="mt-4 font-semibold text-fg">Toll-Free Client Line</h3>
            <p className="mt-1 text-xs text-muted">Mon–Sat: 9 AM to 9 PM IST</p>
            <p className="mt-3 text-sm font-medium text-fg">+91 1800 200 4889</p>
          </div>

          <div className="rounded-3xl border border-outline bg-panel p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="mt-4 font-semibold text-fg">Experience Atelier</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Level 4, Maker Maxity, Bandra Kurla Complex (BKC), Mumbai, Maharashtra 400051, India
            </p>
          </div>
        </div>

        {/* Message Form */}
        <div className="rounded-3xl border border-outline bg-panel p-6 sm:p-10 lg:col-span-2">
          {submitted ? (
            <div className="flex min-h-[350px] flex-col items-center justify-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="mt-4 font-display text-2xl font-semibold text-fg">Message Received</h2>
              <p className="mt-2 max-w-md text-sm text-muted">
                Thank you for reaching out to BazaarFlow LUXE. Our concierge specialist has received your inquiry and will respond within 2 hours.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setFormState({ name: '', email: '', subject: '', message: '' });
                }}
                className="mt-6 rounded-xl bg-fg px-5 py-2.5 text-sm font-semibold text-bg transition hover:opacity-90"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <div>
              <h2 className="text-xl font-semibold text-fg">Send a Message</h2>
              <p className="mt-1 text-sm text-muted">
                Fill in the details below and our team will get back to you promptly.
              </p>
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted">Your Name</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Aarav Sharma"
                      value={formState.name}
                      onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                      className="mt-1.5 h-11 w-full rounded-xl border border-outline bg-bg-elevated px-3 text-sm text-fg outline-none ring-brand/20 focus:ring"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted">Email Address</label>
                    <input
                      required
                      type="email"
                      placeholder="aarav@example.com"
                      value={formState.email}
                      onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                      className="mt-1.5 h-11 w-full rounded-xl border border-outline bg-bg-elevated px-3 text-sm text-fg outline-none ring-brand/20 focus:ring"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted">Subject</label>
                  <input
                    required
                    type="text"
                    placeholder="Order query, product authenticity, or styling consultation"
                    value={formState.subject}
                    onChange={(e) => setFormState({ ...formState, subject: e.target.value })}
                    className="mt-1.5 h-11 w-full rounded-xl border border-outline bg-bg-elevated px-3 text-sm text-fg outline-none ring-brand/20 focus:ring"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted">Message</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="How can we assist you today?"
                    value={formState.message}
                    onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-outline bg-bg-elevated p-3 text-sm text-fg outline-none ring-brand/20 focus:ring"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-fg px-6 py-3 text-sm font-semibold text-bg transition hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? 'Transmitting...' : 'Send Inquiry'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
