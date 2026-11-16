# BazaarFlow LUXE — Architectural Design & Specification

## 1. System Overview

BazaarFlow LUXE is an enterprise-grade, high-performance omnichannel luxury e-commerce platform built on a decoupled, modular modern stack:
- **Customer Storefront & Admin Portal:** Next.js 16 (App Router, Turbopack, React 19, Tailwind CSS, TypeScript).
- **Core Backend Services:** NestJS 11 (Express platform, TypeORM, class-validator, Winston structured logging, Helmet security headers, rate-limiting via throttler).
- **Persistent Data Store:** Managed PostgreSQL (Supabase / Render PostgreSQL) with transactional row-level pessimistic locking (`pessimistic_write`) to prevent overselling.
- **Cache & Rate-Limit Store:** Upstash Redis with distributed key TTL.
- **Search Engine:** Meilisearch for typo-tolerant fast catalog queries.
- **Payment Processing:** Multi-rail payment gateways (Stripe Card Checkout with verified webhook signature handling and idempotent settlement; bKash tokenized payment checkout).
- **Transactional Notifications:** Brevo transactional email engine for order placements and dispatch status updates.

```
                      +-----------------------------+
                      |   Client Browsers & Apps   |
                      +--------------+--------------+
                                     |
               HTTPS (CORS / SameSite Cookies / API Proxy)
                                     v
       +-----------------------------+-----------------------------+
       |                                                           |
       v                                                           v
+-------------------------------+             +-------------------------------+
|  Next.js 16 Storefront/Admin  |             |      NestJS Core Backend      |
|  (Vercel Edge Deployment)     |             |      (Render Node Engine)     |
|  - SSR / SSG Product Catalog  |             |  - Global Validation Pipes    |
|  - Client State & Cart Context|             |  - JWT & TOTP 2FA Security    |
|  - Next.js API Proxy Rewrites |<----------->|  - Pessimistic Row Locking    |
+-------------------------------+             |  - Authoritative Pricing Calc |
                                              +---------------+---------------+
                                                              |
                  +---------------------+---------------------+---------------------+
                  |                     |                     |                     |
                  v                     v                     v                     v
         +-----------------+   +-----------------+   +-----------------+   +-----------------+
         | PostgreSQL DB   |   |  Upstash Redis  |   | Stripe / bKash  |   |  Brevo Mailer   |
         | TypeORM Schema  |   |  Cache / TTL    |   | Webhook Verif.  |   |  Notifications  |
         +-----------------+   +-----------------+   +-----------------+   +-----------------+
```

## 2. Order Lifecycle State Machine

Orders transition through strict state validation:
```
  [ Customer Cart ]
         |
         v (Checkout submission)
    +---------+
    | PENDING | <---- (Inventory decremented atomically inside DB transaction)
    +----+----+
         |
         +---------------------------------------+
         |                                       |
         v (Stripe / bKash Webhook Success)      v (Payment failure / Admin cancel)
     +------+                               +-----------+
     | PAID |                               | CANCELLED |
     +---+--+                               +-----+-----+
         |                                        |
         v (Fulfillment start)                    +---> (Inventory automatically restored)
   +------------+
   | PROCESSING |
   +-----+------+
         |
         v (Dispatched with tracking URL)
    +---------+
    | SHIPPED |
    +----+----+
         |
         v (Customer receipt confirmed)
   +-----------+
   | DELIVERED |
   +-----------+
```

## 3. Financial & Monetary Calculation Integrity

Monetary safety is guaranteed by centralizing all arithmetic on the server:
1. **Subtotal:** Server retrieves active database price (or discount price) for each SKU, ignoring client cart numbers.
2. **Coupons:** Looked up against `coupons` table with active validity, expiration timestamp, usage count vs. limit, and minimum cart spend.
3. **Delivery Fee:** Server-controlled (`standard` = 120 BDT, `express` = 220 BDT).
4. **Grand Total:** $\text{Max}(0, \text{Subtotal} - \text{Discount} + \text{Shipping})$.
5. **Stripe Charge:** Amount passed to Stripe PaymentIntent is calculated directly from the server order total converted to integer cents (`Math.round(total * 100)`).
