# ⚡ BazaarFlow API Engine — NestJS Enterprise Microservices

> **Core API & Gateway for BazaarFlow Luxe E-Commerce Platform**  
> **Architected & Maintained by [UMAR MUKTHAR](https://github.com/UMARMUKTHAR03)** ([@UMARMUKTHAR03](https://github.com/UMARMUKTHAR03))

---

## Overview

The BazaarFlow Backend is a high-throughput, modular NestJS REST API and event pipeline built with TypeScript, TypeORM/Prisma, PostgreSQL (Supabase), Upstash Redis, and Meilisearch.

### Key Capabilities
- **Storefront Endpoints**: Product catalog, multi-category tree hierarchy, search fallback, inventory counters.
- **Cart & Checkout Gateway**: Stripe Payment Intents, Stripe Webhooks, bKash Create/Execute payment flow.
- **Security & Guards**: Helmet HTTP security headers, Winston structured log rotation, throttled rate limiting, JWT + HTTP-only cookies.
- **Admin Management**: TOTP 2FA admin authentication, order status mutation, inventory restocking triggers.

---

## 🚀 Setup & Execution

```bash
# 1. Install dependencies
npm install

# 2. Start in watch mode
npm run start:dev

# 3. Production build
npm run build
npm run start:prod
```

---

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E test suite
npm run test:e2e

# Test coverage
npm run test:cov
```

---

## 📄 License & Attribution

Licensed under the **MIT License** — Copyright (c) 2026 **UMAR MUKTHAR**.
