# Production Deployment Guide

This guide describes how to deploy the production infrastructure for BazaarFlow LUXE.

## 1. Architecture Split

- **Frontend (Storefront & Admin Dashboard):** Deployed to **Vercel** as a high-performance Next.js 16 application.
- **Backend (API, Webhooks, Payments):** Deployed to **Render** as a Node.js web service running NestJS.
- **Database:** **Supabase PostgreSQL** or **Render PostgreSQL**.
- **Cache & Throttling:** **Upstash Redis**.

---

## 2. Deploying the Backend to Render

1. Log in to [Render](https://render.com) and click **New + > Blueprint**.
2. Connect your repository: `UMARMUKTHAR03/ecommerce-platform`.
3. Render will detect `render.yaml`.
4. Configure required production environment variables:
   - `DATABASE_URL`: Your production PostgreSQL connection string (`postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres`).
   - `FRONTEND_URL`: URL of the deployed Next.js frontend (e.g. `https://bazaarflow-luxe.vercel.app`).
   - `BACKEND_PUBLIC_URL`: URL of the Render web service (e.g. `https://bazaarflow-backend.onrender.com`).
   - `STRIPE_SECRET_KEY`: Live or test key starting with `sk_live_...` or `sk_test_...`.
   - `STRIPE_WEBHOOK_SECRET`: Stripe signing secret `whsec_...` obtained from the Stripe dashboard.
   - `ADMIN_EMAIL`: Email for administrative access (default `admin@bazaarflow.com`).
   - `ADMIN_PASSWORD_HASH`: Bcrypt hash of the initial administrative password (generated via `node -e "const bcrypt = require('bcrypt'); console.log(bcrypt.hashSync('YourSecurePassword', 10));"`).
   - `ADMIN_ALLOWED_IPS`: (Optional) Comma-separated list of IPv4/IPv6 addresses permitted to access admin routes (leave unset or empty on Render to allow remote administrative login).
   - `DATABASE_MIGRATION_URL`: (Optional) Direct external PostgreSQL URL used during build-time migrations if `DATABASE_URL` is pooled or internal.
   - `BKASH_*`: bKash credentials if utilizing tokenized bKash payments.
5. Click **Apply**. Render will run:
   ```bash
   npm ci && npm run build:backend && npm run migration:run
   npm run start:backend
   ```
6. Verify service health by navigating to `https://<backend-url>/health` which returns:
   ```json
   { "status": "ok", "service": "bazaarflow-backend", "timestamp": "..." }
   ```

---

## 3. Deploying the Frontend to Vercel

1. Log in to [Vercel](https://vercel.com) and click **Add New > Project**.
2. Select `UMARMUKTHAR03/ecommerce-platform`.
3. Set the **Root Directory** to `frontend`.
4. The build configuration automatically uses `next build`.
5. Configure Environment Variables:
   - `NEXT_PUBLIC_API_URL`: Your deployed Render backend URL (`https://bazaarflow-backend.onrender.com`).
   - `BACKEND_INTERNAL_URL`: URL of the deployed Render backend (used by Next.js rewrites at `/api/backend/:path*` to forward API requests).
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: `pk_test_...` or `pk_live_...`.
   - `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL (for media hosting).
6. Click **Deploy**.

---

## 4. Configuring Stripe Webhooks

1. Go to the [Stripe Dashboard > Developers > Webhooks](https://dashboard.stripe.com/webhooks).
2. Add an endpoint with the URL:
   `https://<your-backend-url>/store/payments/stripe/webhook`
3. Select events to listen to:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Copy the **Signing Secret** (`whsec_...`) and update `STRIPE_WEBHOOK_SECRET` on Render.
