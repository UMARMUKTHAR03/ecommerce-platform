# Testing Strategy & Execution Guide

## Overview

BazaarFlow LUXE contains automated test suites spanning backend services, state management, and frontend presentation components.

---

## 1. Backend Testing (NestJS + Jest)

The backend suite tests:
- **Health Checks & Root Controller:** Verifies system liveness and readiness endpoints.
- **OrdersService:**
  - Empty cart validation (HTTP 400).
  - Pessimistic write locks with stock checks.
  - Transaction rollbacks when stock is insufficient.
  - Multi-item subtotal, delivery charges, and coupon discounts.
  - Atomic inventory decrement and restoration on order cancellation.
- **StripeService:**
  - Safe handling when Stripe webhook secret is unconfigured.
  - Webhook signature construction and validation.
  - Idempotent processing of `payment_intent.succeeded`.
  - Duplicate webhook delivery deduplication.

### Running Backend Tests
```bash
npm run test:backend
```

---

## 2. Frontend Testing (Next.js + Jest + React Testing Library)

The frontend test suite tests:
- **ProductCard:** Rendering pricing, discount badges, stock warnings, image fallbacks, and quick-add actions.
- **CartSummary:** Real-time quantity adjustments, price recalculations, and checkout handoff.
- **SearchBar:** Real-time debounced search input, results filtering, and keyboard navigation.

### Running Frontend Tests
```bash
npm run test --workspace frontend
```

---

## 3. End-to-End Type Safety & Production Build Verification

Verify that all TypeScript code passes strict type checking and builds into production assets:
```bash
# Verify backend build
npm run build:backend

# Verify frontend build
npm run build:frontend
```
Both builds are automatically validated in GitHub Actions on every pull request and push to `main`.
