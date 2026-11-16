# Security Architecture & Hardening

BazaarFlow LUXE enforces defensive in-depth security controls across the application, network, authentication, and database tiers.

---

## 1. Authentication & Session Management

- **Password Hashing:** Passwords are never stored in plaintext; salted with bcrypt using a work factor of 10.
- **JWT Authentication:** Access tokens are cryptographically signed using HS256 with short lifespans (15 minutes).
- **Two-Factor Authentication (TOTP):** Admin logins enforce RFC 6238 Time-based One-Time Passwords via `otplib`. Secrets are stored with user accounts in PostgreSQL.
- **Account Lockout:** Customer accounts are locked after repeated failed login attempts to protect against brute-force attacks.

---

## 2. Network & Header Security

- **Helmet:** Configures HTTP security headers including X-Content-Type-Options, X-Frame-Options (DENY), Strict-Transport-Security, and Content Security Policy (CSP).
- **CORS Policy:** Strict CORS origin whitelisting allowing only authorized storefront domains, preventing cross-site scripting abuses.
- **Rate Limiting:** Throttling via `@nestjs/throttler` (default: 200 requests/minute per IP) prevents credential stuffing and denial of service attacks.
- **Proxy Trust:** Configured `app.set('trust proxy', 1)` enables accurate client IP resolution behind load balancers and CDNs.

---

## 3. Data Integrity & Payment Protection

- **Pessimistic Database Locking:** Database transactions lock target rows (`pessimistic_write`) to prevent double-spending and overselling under concurrent checkout traffic.
- **Idempotent Webhooks:** Payment webhooks check previous transaction IDs in the `payments` table before mutating order state.
- **Authoritative Server Pricing:** Client carts cannot dictate item prices, delivery fees, or discount amounts.
- **Input Sanitization:** Global validation pipes with `class-validator` strip unexpected payload properties (`whitelist: true`) and reject forbidden parameters (`forbidNonWhitelisted: true`).
