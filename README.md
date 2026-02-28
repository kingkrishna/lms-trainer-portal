# Secure LMS + Trainer Marketplace + Job Portal

Role-based web platform combining **Learning Management System**, **Trainer Marketplace**, and **Job Portal** with zero-trust frontend and server-side enforcement for pricing, payments, and access. Integrated with **Zoho** for operations and communication.

## Technology Stack

| Layer | Stack |
|-------|--------|
| Frontend | HTML5, CSS3, Vanilla JavaScript, Fetch API, Bootstrap (layout only) |
| Backend | Node.js, Express.js, REST API, JWT, RBAC middleware |
| Database | SQL (MySQL or PostgreSQL) |
| Payments | Razorpay or Stripe (server-side orders, webhook verification) |
| Operations | Zoho CRM, Mail, Desk, Books, Analytics |

**Rules:** Frontend does not calculate prices, control access, or verify payments. Backend is the sole authority.

## Project Structure

```
LMS/
├── database/
│   └── schema.sql          # Full DB schema (roles, users, courses, payments, jobs, audit_logs)
├── docs/
│   ├── API_CONTRACTS.md    # REST API endpoints and roles
│   └── SECURITY_PLAN.md    # Security architecture
├── public/                 # Frontend (HTML, CSS, JS)
│   ├── index.html
│   ├── login.html, register.html, dashboard.html
│   ├── courses.html, trainers.html, jobs.html
│   ├── css/style.css
│   └── js/api.js, app.js
├── server/
│   ├── index.js            # Express app, CORS, rate limit, static, routes
│   ├── config/index.js
│   ├── db/
│   │   ├── connection.js
│   │   └── migrate.js      # Run schema
│   ├── middleware/
│   │   ├── auth.js         # JWT + requireRole()
│   │   ├── validate.js
│   │   └── rateLimit.js
│   └── routes/
│       ├── index.js
│       └── auth.js         # Register, Login, Logout, Me
├── .env.example
├── package.json
└── README.md
```

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Database

- Create a MySQL (or compatible) database, e.g. `lms_platform`.
- Copy `.env.example` to `.env` and set `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `JWT_SECRET` (min 32 characters).
- Ensure `DB_*` values are valid before starting the server.

### 3. Run schema and seed

```bash
npm run db:migrate   # applies schema + migrations
npm run db:seed      # seeds demo users, courses, trainers, jobs
```

Seeded QA credentials: `admin@visionconnects.com`, `demo-student@visionconnects.com`, `demo-trainer@visionconnects.com`, `demo-recruiter@visionconnects.com` — password: `password123`

### 4. Start server

```bash
npm start
# or
npm run dev
```

- Backend + static frontend: **http://localhost:3000**
- API base: **http://localhost:3000/api**
- Health: **http://localhost:3000/health**

### 5. First Super Admin (optional)

Insert a super_admin user manually into `users` and corresponding role (e.g. create a profile table for super_admin or use `roles.id = 1`). Default roles in schema: 1=super_admin, 2=student, 3=trainer, 4=recruiter.

## Development Timeline (12 Weeks)

| Phase | Duration | Focus |
|-------|----------|--------|
| 1 | 1 week | Planning & design (this repo: schema, API contracts, security plan) ✅ |
| 2 | 1 week | Authentication & roles ✅ (skeleton in place) |
| 3 | 2 weeks | Course & trainer management |
| 4 | 2 weeks | Payment & enrollment (Razorpay/Stripe, webhooks) |
| 5 | 2 weeks | LMS (materials, progress, access control) |
| 6 | 2 weeks | Job portal (recruiter payment, jobs, applications) |
| 7 | 1 week | Zoho integration & admin dashboard |
| 8 | 1 week | Testing & deployment |

## Security Highlights

- **Pricing:** Stored only in DB; backend fetches for every order; frontend never sends amount.
- **Payment:** Order created with server-fetched price; verification via webhook only; enrollment only after verified payment.
- **Auth:** JWT in HTTP-only cookie; RBAC middleware on all protected routes.
- **Validation:** express-validator on inputs; parameterized SQL only.
- **Infrastructure:** HTTPS, Helmet, CORS whitelist, rate limiting, audit logs.

See `docs/SECURITY_PLAN.md` and `docs/API_CONTRACTS.md` for full details.

## Environment Variables

See `.env.example`. Required: `DB_*`, `JWT_SECRET`. For payments add Razorpay/Stripe keys and webhook secrets. For Zoho add client credentials and refresh token.

If payment gateway keys are not configured, payment APIs return `PAYMENT_NOT_CONFIGURED`. Super admins can settle pending payments manually via admin payment settlement endpoints.

Zoho sync currently runs from backend events:
- Auth register/login/profile update -> Zoho CRM contact upsert
- Payment verification/manual settlement -> Zoho Books invoice push (when `ZOHO_BOOKS_ORG_ID` and `ZOHO_BOOKS_CUSTOMER_ID` are configured)
- Admin trainer approval/payment settlement -> Zoho Cliq notifications (when `ZOHO_CLIQ_WEBHOOK_URL` is configured)

## Deploy to Render (one-click)

The repo includes `render.yaml` for one-click deployment.

1. Go to [render.com](https://render.com) and sign in with GitHub.
2. Click **New** → **Blueprint**.
3. Connect the `lms-trainer-portal` repo.
4. Render will use `render.yaml` — click **Apply**.
5. Add required env vars in Render (`DB_*`, `JWT_SECRET`, `FRONTEND_URL`, and optional `RAZORPAY_*`).

Live URL: `https://lms-trainer-portal.onrender.com` (or similar).

## Deploy on Windows (no Linux)

Use the Windows-first deployment guide in `DEPLOY.md` (PM2 + IIS ARR/Nginx for Windows).

## Deploy to Vercel

1. **Install Vercel CLI** (optional): `npm i -g vercel`

2. **Deploy:**
   ```bash
   vercel
   ```
   Or connect the repo at [vercel.com](https://vercel.com) and deploy from there.

3. **Environment variables** (Vercel Dashboard → Project → Settings → Environment Variables):
   - `JWT_SECRET` – required (min 32 characters)
   - `FRONTEND_URL` – optional; defaults to your Vercel URL
   - For MySQL: add `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
4. This app is database-backed only; configure DB vars before using protected features.

## License

MIT
