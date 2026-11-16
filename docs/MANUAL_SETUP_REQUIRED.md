# Manual Setup & External Credentials Guide

Certain integrations require private credentials or one-time configuration in external provider dashboards. This document outlines exactly what is needed for full production functionality.

---

## 1. Database (PostgreSQL / Supabase)

- **Provider:** [Supabase](https://supabase.com) or [Render PostgreSQL](https://render.com).
- **Environment Variable:** `DATABASE_URL` (and optional `DATABASE_MIGRATION_URL` for external direct migration connections).
- **Actions Required:**
  1. Create a PostgreSQL project.
  2. Copy the connection URI into `DATABASE_URL` on Render.
  3. Schema tables and indexes are executed via TypeORM migrations during the build phase (`npm run migration:run`).

---

## 2. Admin Account Provisioning & Two-Factor Authentication

- **Environment Variables:**
  - `ADMIN_EMAIL`: Email for administrative access (e.g. `admin@bazaarflow.com`).
  - `ADMIN_PASSWORD_HASH`: Bcrypt hash of the initial administrative password.
  - `ADMIN_ALLOWED_IPS`: (Optional) Comma-separated list of IP addresses allowed to access `/admin` and administrative APIs. Leave unset or empty to allow remote administrative login.
- **Actions Required:**
  1. Generate a bcrypt hash for your desired administrator password using Node.js:
     ```bash
     node -e "const bcrypt = require('bcrypt'); console.log(bcrypt.hashSync('YourSecurePassword', 10));"
     ```
  2. Set `ADMIN_PASSWORD_HASH` on Render with the output string.
  3. On first login via `/admin/login`, the system auto-provisions the administrator account and presents a standard RFC 6238 TOTP QR code for 2FA setup in Google Authenticator or 1Password.
  4. Subsequent logins require the password and a 6-digit TOTP code.

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

## 5. Brevo Transactional Email

- **Provider:** [Brevo (formerly Sendinblue)](https://www.brevo.com)
- **Environment Variables:**
  - `BREVO_API_KEY`: API Key generated from Brevo SMTP & API settings.
  - `SENDER_EMAIL`: Verified sender address (e.g. `orders@bazaarflow.com`).
  - `SENDER_NAME`: Sender display name (e.g. `BazaarFlow LUXE`).

---

## 6. Upstash Redis (Caching & Rate Limiting)

- **Provider:** [Upstash](https://upstash.com)
- **Environment Variables:**
  - `UPSTASH_REDIS_URL`: `rediss://default:...@...upstash.io:6379`
  - `UPSTASH_REDIS_TOKEN`: Redis authentication password.
