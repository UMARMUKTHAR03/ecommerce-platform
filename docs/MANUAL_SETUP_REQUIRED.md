# Manual Setup & External Credentials Guide

Certain integrations require private credentials or one-time configuration in external provider dashboards. This document outlines exactly what is needed for full production functionality.

---

## 1. Database (PostgreSQL / Supabase)

- **Provider:** [Supabase](https://supabase.com) or [Render PostgreSQL](https://render.com).
- **Environment Variable:** `DATABASE_URL`
- **Actions Required:**
  1. Create a PostgreSQL project.
  2. Copy the connection URI into `DATABASE_URL` on Render.
  3. Schema tables (`000_initial_schema.ts`) and indexes are executed via TypeORM migrations on first boot or deployment script.

---

## 2. Stripe Payments

- **Provider:** [Stripe](https://stripe.com)
- **Environment Variables:**
  - `STRIPE_SECRET_KEY`: `sk_test_...` (backend)
  - `STRIPE_WEBHOOK_SECRET`: `whsec_...` (backend)
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: `pk_test_...` (frontend)
- **Actions Required:**
  1. Retrieve Publishable Key and Secret Key from Stripe API Keys dashboard.
  2. Register Webhook endpoint: `https://<backend-domain>/store/payments/stripe/webhook`.
  3. Subscribe to `payment_intent.succeeded` and `payment_intent.payment_failed`.

---

## 3. bKash Tokenized Checkout

- **Provider:** [bKash Merchant Portal](https://developer.bka.sh)
- **Environment Variables:**
  - `BKASH_USERNAME`
  - `BKASH_PASSWORD`
  - `BKASH_APP_KEY`
  - `BKASH_APP_SECRET`
  - `BKASH_BASE_URL`: Defaults to sandbox `https://tokenized.sandbox.bka.sh/v1.2.0-beta`.
- **Note:** If left unconfigured, Stripe card payments remain fully operational.

---

## 4. Brevo Transactional Email

- **Provider:** [Brevo (formerly Sendinblue)](https://www.brevo.com)
- **Environment Variables:**
  - `BREVO_API_KEY`: API Key generated from Brevo SMTP & API settings.
  - `EMAIL_FROM`: Verified sender address (e.g. `orders@bazaarflow.com`).

---

## 5. Upstash Redis (Caching & Rate Limiting)

- **Provider:** [Upstash](https://upstash.com)
- **Environment Variables:**
  - `UPSTASH_REDIS_URL`: `rediss://default:...@...upstash.io:6379`
  - `UPSTASH_REDIS_TOKEN`: Redis authentication password.
