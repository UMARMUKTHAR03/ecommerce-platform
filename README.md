# 🛍️ BazaarFlow LUXE — Next-Gen Full-Stack E-Commerce Monorepo & Luxury Commerce

[![CI/CD Status](https://github.com/UMARMUKTHAR03/ecommerce-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/UMARMUKTHAR03/ecommerce-platform/actions)
[![Live Vercel Storefront](https://img.shields.io/badge/Live%20Storefront-Vercel-black?style=for-the-badge&logo=vercel&logoColor=white)](https://bazaarflow-luxe.vercel.app/)
[![Live Prototype Preview](https://img.shields.io/badge/Live%20Prototype-GitHub%20Pages-6366f1?style=for-the-badge&logo=githubpages&logoColor=white)](https://umarmukthar03.github.io/ecommerce-platform/)
[![Backend API](https://img.shields.io/badge/Backend%20API-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://bazaarflow-backend.onrender.com/health)
[![Next.js](https://img.shields.io/badge/Next.js-16.2.1-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11.x-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Stripe](https://img.shields.io/badge/Stripe-Payment%20Intents-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://stripe.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-TypeORM-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://supabase.com/)
[![Redis](https://img.shields.io/badge/Redis-Upstash%20Cache-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![License](https://img.shields.io/badge/License-MIT-10b981?style=for-the-badge)](./LICENSE)
[![Author](https://img.shields.io/badge/Architect-UMAR%20MUKTHAR-8b5cf6?style=for-the-badge&logo=github)](https://github.com/UMARMUKTHAR03)

> 🛍️ **Production Vercel Storefront:** **[https://bazaarflow-luxe.vercel.app/](https://bazaarflow-luxe.vercel.app/)**  
> 🌐 **Interactive Showcase Prototype:** **[https://umarmukthar03.github.io/ecommerce-platform/](https://umarmukthar03.github.io/ecommerce-platform/)**  
> ⚙️ **Production NestJS API on Render:** **[https://bazaarflow-backend.onrender.com/health](https://bazaarflow-backend.onrender.com/health)**  

---

## 🖼️ Platform Preview

<div align="center">
  <img src="https://raw.githubusercontent.com/UMARMUKTHAR03/ecommerce-platform/main/docs/preview.svg" alt="BazaarFlow LUXE Platform Architecture and Storefront" width="100%" />
</div>

---

## ⚡ Overview

**BazaarFlow LUXE — Next-Gen Full-Stack E-Commerce Monorepo & Luxury Commerce** is an enterprise-grade full-stack commerce platform engineered for high-concurrency luxury commerce, authoritative financial calculations, transactional row locking, and omnichannel payments.

Built to mirror production architectures seen across industrial fintech, predictive systems, and real-time platforms, BazaarFlow LUXE coordinates:

- 🛍️ **Customer Storefront & Admin Portal**: Built with Next.js 16 (App Router, Turbopack, React 19, Tailwind CSS v4) featuring responsive catalog discovery, variant selectors, multi-step checkout, authenticated customer profile/orders, and real-time order tracking.
- ⚙️ **Core Backend API Gateway**: Enterprise NestJS microservices architecture with Helmet security headers, CORS origin whitelisting, Winston daily-rotate logging, class-validator sanitization, and TOTP two-factor authentication for administrators.
- 💳 **Omnichannel Payment Engine**: Stripe Payment Intents with raw webhook signature validation and idempotent processing, alongside tokenized bKash checkout support.
- 🔒 **Database Integrity & Concurrency**: PostgreSQL managed with TypeORM migrations, foreign keys, cascade constraints, and row-level pessimistic locking (`pessimistic_write`) to guarantee zero overselling.
- ⚡ **Caching & Search**: Sub-10ms catalog querying via Meilisearch and distributed rate limiting with Upstash Redis.
- 📧 **Transactional Notifications**: Automated order confirmations and tracking updates via Brevo transactional email engine.

---

## 🔄 End-to-End Workflow & Pipeline Architecture

```mermaid
flowchart TD
    subgraph ClientLayer ["1. Client & Presentation Layer (Next.js 16 + React 19)"]
        UI["Customer Storefront (/products, /cart, /checkout)"]
        AuthUI["Auth Portal (/auth/login, /auth/register)"]
        AdminUI["Admin Control Center (/admin/* with TOTP 2FA)"]
    end

    subgraph SecurityGateway ["2. Security & Gateway Layer (NestJS)"]
        Sanitize["SanitizeGuard (XSS & Getter Protection)"]
        Throttler["Rate Limiter (Upstash Redis Throttling)"]
        AuthGuard["JWT & IP Whitelist Guards"]
    end

    subgraph CoreServices ["3. Business Logic & Transaction Services"]
        ProductSvc["Products & Categories Engine"]
        CouponSvc["Coupon Validation & Discount Engine"]
        OrderSvc["Orders Service (Pessimistic Row Locking)"]
        PaymentSvc["Payment Controller (Stripe & bKash)"]
    end

    subgraph DataPersistence ["4. Data & State Tier"]
        DB[(Supabase PostgreSQL Pooler)]
        Search[(Meilisearch Vector Index)]
        Cache[(Redis Cache Cluster)]
    end

    subgraph ExternalServices ["5. External Gateways & Webhooks"]
        StripeGW["Stripe Payment Gateway (Webhook whsec_*)"]
        BkashGW["bKash Tokenized Gateway (Msisdn / Callback)"]
        BrevoGW["Brevo Mailer (Order Invoices & Tracking)"]
    end

    UI --> Sanitize
    AuthUI --> Sanitize
    AdminUI --> Sanitize
    Sanitize --> Throttler --> AuthGuard
    AuthGuard --> ProductSvc & CouponSvc & OrderSvc & PaymentSvc
    ProductSvc --> Search & DB & Cache
    CouponSvc --> DB
    OrderSvc -->|Pessimistic Write Lock| DB
    PaymentSvc --> StripeGW & BkashGW
    StripeGW -->|Signed Webhook| PaymentSvc
    OrderSvc --> BrevoGW
```

### High-Integrity Workflow Lifecycle

1. **Customer Registration & Session Establishment**:
   - Customer submits details via `/auth/register` or `/auth/login`.
   - Passwords hashed via bcrypt (`cost=10`). Sessions issue signed JWT access tokens with rotating HTTP-only refresh cookies.
   - Session restoration seamlessly re-authenticates expired sessions across both client and server components.

2. **Catalog Browsing, Dynamic Filtering & Live Cart**:
   - Products retrieved via `/store/products` and `/store/categories` with sub-10ms cached responses.
   - Client manages optimistic cart updates with synchronized local storage and variant-level pricing adjustments.

3. **Authoritative Server-Side Checkout & Coupon Calculation**:
   - Cart subtotal and delivery rates calculated dynamically.
   - Coupons validated server-side for expiry, usage limits, and minimum spend requirements (`POST /store/coupons/validate`).
   - Client-submitted totals are strictly un-trusted; discounts and grand totals are verified and recalculated within the backend order transaction.

4. **Transactional Order Placement & Race-Condition Prevention**:
   - `OrdersService.createOrder()` initiates an atomic PostgreSQL transaction.
   - `pessimistic_write` locks are acquired on product and variant records to prevent concurrent overselling.
   - Stock decrements atomically; if inventory is insufficient, the transaction rolls back immediately with zero state pollution.

5. **Payment Processing & Idempotent Webhook Reconciliation**:
   - **Stripe**: Client completes charge using Stripe Elements. Backend Stripe Webhook (`POST /store/payments/stripe/webhook`) verifies HMAC SHA256 signatures using raw request buffers.
   - **Order State Transition**: Orders transition from `PENDING` to `PAID` exclusively after server-side payment confirmation. Duplicate webhook events are handled idempotently without re-triggering fulfillment or double-charging.
   - **Failure & Cancellation Resilience**: If a payment fails or an order is cancelled, stock restoration triggers automatically and atomically restores item inventory once.

6. **Order Fulfillment & Live Tracking**:
   - Customers review real-time order history and shipment dispatch status via `/account/orders/:id`.

---

## 🏗️ System Architecture

```mermaid
graph TD
    A["Storefront (Next.js 16 + Tailwind CSS)"] -->|HTTPS / Next.js Proxy| B["API Gateway (NestJS REST API)"]
    C["Admin Control Panel (Next.js)"] -->|JWT + TOTP 2FA| B
    B -->|Pessimistic Row Lock| D["PostgreSQL Database (Supabase / Render)"]
    B -->|Sub-10ms Catalog Search| E["Meilisearch Vector & Keyword Index"]
    B -->|Distributed Cache & Throttling| F["Upstash Redis Cluster"]
    B -->|Idempotent Webhooks| G["Stripe & bKash Payment Gateways"]
    B -->|Transactional Order Emails| H["Brevo Mailer Engine"]
```

---

## 📚 Technical Documentation

Complete architectural, operational, and deployment specifications:

| Guide | Description |
| :--- | :--- |
| 📐 [Architecture Specification](docs/ARCHITECTURE.md) | In-depth system design, database ER diagrams, and order lifecycle state machine. |
| 🚀 [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) | Step-by-step deployment instructions for Vercel, Render, and Supabase. |
| 🔑 [Manual Setup & Credentials](docs/MANUAL_SETUP_REQUIRED.md) | Guide to external API keys, webhooks, and environment configuration. |
| 🧪 [Testing Guide](docs/TESTING.md) | Details on backend unit testing, frontend RTL tests, and CI/CD verification. |
| 🛡️ [Security Hardening](docs/SECURITY.md) | Cryptographic safeguards, TOTP 2FA, rate limiting, and row locking. |

---

## 🚀 Quickstart & Local Development

### Prerequisites
- Node.js 22.x or later
- npm 10.x or later
- PostgreSQL database instance

### 1. Installation
Clone the repository and install all monorepo dependencies:
```bash
git clone https://github.com/UMARMUKTHAR03/ecommerce-platform.git
cd ecommerce-platform
npm ci
```

### 2. Environment Configuration
Copy `.env.example` to `.env` in both `backend` and `frontend`:
```bash
cp .env.example backend/.env
cp .env.example frontend/.env.local
```

#### Key Frontend Environment Variables
| Variable | Description | Default / Example |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the NestJS backend API | `https://bazaarflow-backend.onrender.com` (prod) or `http://localhost:3001` (dev) |
| `BACKEND_INTERNAL_URL` | Direct backend internal network URL for server-side Next.js data fetching | `http://localhost:3001` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL for remote image domain verification | `https://*.supabase.co` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key for client-side payment elements | `pk_test_...` |

### 3. Run Automated Tests
```bash
# Run backend test suite (OrdersService, StripeService, AppController)
npm run test:backend

# Run frontend test suite (ProductCard, SearchBar, CartSummary)
npm run test --workspace frontend
```

### 4. Build Applications
```bash
# Compile NestJS backend
npm run build:backend

# Compile Next.js 16 frontend
npm run build:frontend
```

### 5. Launch Development Servers
```bash
# Start backend on http://localhost:3001
npm run start:dev --workspace backend

# Start frontend on http://localhost:3000
npm run dev --workspace frontend
```

---

## 🛡️ Order Lifecycle & Stock Protection

```
  [ Customer Cart ]
         │
         ▼ (Atomic Row-Locked Transaction)
    ┌─────────┐
    │ PENDING │ ◄─── (Stock decremented atomically; fails if stock < requested)
    └────┬────┘
         │
         ├───────────────────────────────────────┐
         │ (Stripe Webhook: payment_intent.succeeded)
         ▼                                       ▼ (Payment failed or Admin Cancelled)
     ┌──────┐                               ┌───────────┐
     │ PAID │                               │ CANCELLED │
     └───┬──┘                               └─────┬─────┘
         │                                        │
         ▼ (Fulfillment: RedX dispatch)           └───► (Stock automatically restored to catalog)
   ┌───────────┐
   │  SHIPPED  │
   └─────┬─────┘
         │
         ▼ (Delivered to customer)
   ┌───────────┐
   │ DELIVERED │
   └───────────┘
```

---

## 👤 Author

**Umar Mukthar**  
- GitHub: [@UMARMUKTHAR03](https://github.com/UMARMUKTHAR03)  
- Portfolio Projects: [ChurnIQ](https://github.com/UMARMUKTHAR03/churn-prediction), [OmniMind AI](https://github.com/UMARMUKTHAR03/rag-ai-chatbot), [Image Recognition Platform](https://github.com/UMARMUKTHAR03/image-recognition-app)

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
