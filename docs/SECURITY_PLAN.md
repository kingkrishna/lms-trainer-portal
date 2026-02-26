# Security Plan – LMS + Trainer Marketplace + Job Portal

## 1. Principles

- **Zero trust on frontend:** Frontend never calculates prices, enforces access, or verifies payments.
- **Server as single authority:** Pricing, payments, roles, and access are enforced only on the backend.
- **Defense in depth:** HTTPS, validation, rate limiting, audit logging, secure dependencies.

---

## 2. Authentication & Session

| Control | Implementation |
|--------|-----------------|
| JWT | Signed with `JWT_SECRET` (min 32 chars); payload: `userId`, `role`, `email`, `iat`, `exp`. |
| Storage | HTTP-only, Secure, SameSite=Strict cookie. No token in localStorage for web. |
| Expiry | Configurable (e.g. 7d); refresh flow if needed. |
| Password | bcrypt (cost 12); never log or expose. |
| Role | Stored in DB and in JWT; middleware validates on every protected route. |

---

## 3. Authorization

| Control | Implementation |
|--------|-----------------|
| RBAC | Middleware: `requireRole('student'|'trainer'|'recruiter'|'super_admin')`. |
| Ownership | For enrollments, jobs, applications: verify `userId` or profile id matches resource owner. |
| Recruiter access | Job post / candidate search allowed only if `recruiters.has_paid_access === true`. |
| Trainer | No access to unpaid enrollments; no pricing endpoints. |
| Super Admin | Only role that can set course prices and platform settings. |

---

## 4. Pricing & Payment Security

| Rule | Implementation |
|------|-----------------|
| Price source | Course price read only from DB. Never from request body or query. |
| Order creation | `POST /payments/create-order` accepts only `courseId` + `trainerId`. Backend fetches price, creates gateway order, returns id + amount (display only). |
| Verification | Payment confirmed only after webhook (or server-side callback) with signature verification and amount match against DB. |
| Mismatch | If gateway amount ≠ DB price → reject, log, do not create enrollment. |
| Audit | All price changes logged in `pricing_log`; payments in `payments` and `audit_logs`. |
| Sync | Payment records synced to Zoho Books from backend; no client involvement. |

---

## 5. Input Validation & Injection

| Control | Implementation |
|--------|-----------------|
| Validation | express-validator on all inputs (body, query, params). |
| SQL | Parameterized queries only (e.g. mysql2 placeholders); no string concatenation. |
| XSS | Sanitize/escape output; Content-Security-Policy headers. |
| ID format | UUID/binary(16); validate format before use. |

---

## 6. HTTP & Infrastructure

| Control | Implementation |
|--------|-----------------|
| HTTPS | Enforced in production; redirect HTTP → HTTPS. |
| Headers | Helmet (CSP, X-Frame-Options, etc.). |
| CORS | Whitelist `FRONTEND_URL`; no wildcard in production. |
| Rate limiting | express-rate-limit per IP (e.g. 100 req/15min general, 5/15min auth). |
| Proxy | Nginx as reverse proxy; PM2 for process management. |

---

## 7. Secrets & Config

| Control | Implementation |
|--------|-----------------|
| Env | All secrets in environment variables; `.env` not committed. |
| DB | Credentials in env; least-privilege DB user. |
| Keys | JWT secret, payment gateway secrets, Zoho credentials from env. |

---

## 8. Audit & Compliance

| Control | Implementation |
|--------|-----------------|
| Audit log | Log auth, price changes, payment verification, role/access changes to `audit_logs`. |
| Immutability | Audit logs append-only; no delete/update. |
| Traceability | Payments and enrollments linked; pricing_log for course price history. |

---

## 9. Frontend Restrictions (Enforced by Process & Review)

- No calculation of course price or payment amount.
- No access control logic (e.g. “if paid then show” as sole gate); server must deny unauthorized API access.
- No storage of payment secrets or JWT in localStorage (use HTTP-only cookie).
- Display only data returned by API (e.g. price from `/courses/:slug` or order response).

---

## 10. Dependency & Deployment

- Regular updates for dependencies; run `npm audit`.
- Lockfile committed; CI runs audit.
- Database backups (e.g. daily); restore tested.
- No debug mode or verbose errors in production.

This plan is the reference for implementation and review; no shortcuts.
