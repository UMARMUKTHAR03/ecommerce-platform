# Manual Setup & External Credentials Guide

Certain integrations require private credentials or one-time configuration in external provider dashboards. This document outlines exactly what is needed for full production functionality.

---

## 1. Database (Supabase PostgreSQL — Singapore)

- **Provider:** [Supabase](https://supabase.com) (Region: `ap-southeast-1` Singapore)
- **Connection Mode:** **Session Pooler (port 5432)**
- **Environment Variables:**
  - `DATABASE_URL`: Session pooler connection string:
    `postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`
  - `DATABASE_MIGRATION_URL`: Direct database connection (or port 5432 session pooler):
    `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`
  - `DATABASE_SSL`: Set to `true`
- **Actions Required in Supabase Dashboard:**
  1. Open project settings: **Settings > Database > Connection pooling configuration**.
  2. Choose **Session** pool mode on port **5432**.
  3. Copy the URI and replace `[YOUR-PASSWORD]` with your actual Supabase database password.
  4. Paste into `DATABASE_URL` in the Render service environment settings.
- **Local Testing Command:**
  ```bash
  # Test connection without exposing secrets in logs
  npm run db:test
  ```
- **Troubleshooting:**
  - If migrations report prepared statement errors, ensure you connect to the **Session Pooler (port 5432)** or direct connection, not Transaction Pooler (port 6543).
  - If connection times out, verify that your IP or cloud provider has IPv4 connectivity and that `DATABASE_SSL=true`.

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
