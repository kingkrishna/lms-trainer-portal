# Windows + Zoho Deployment

## 1) Prerequisites (Windows only)

- Node.js 18+
- MySQL or PostgreSQL on Windows
- PM2 (`npm i -g pm2`)
- Optional reverse proxy:
  - IIS ARR (recommended on Windows), or
  - Nginx for Windows

## 2) Configure environment

Copy `.env.example` to `.env` and set:

- `DB_*`
- `JWT_SECRET`
- `FRONTEND_URL`
- `RAZORPAY_*` (if using Razorpay)
- `ZOHO_*` (CRM/Books/Cliq and OAuth)

## 3) Migrate + seed

```bash
npm install
npm run db:migrate
npm run db:seed
```

## 4) Start with PM2

```bash
pm2 start server/index.js --name lms
pm2 save
```

To restart after changes:

```bash
pm2 restart lms
```

## 5) Reverse proxy (Windows)

- Configure IIS ARR (or Nginx for Windows) to proxy:
  - `/` -> static + Node app
  - `/api/*` -> `http://localhost:3000/api/*`
- Enable HTTPS on your public domain.

## 6) Smoke test

```bash
node test-smoke.js
```

If all tests pass, your Windows-hosted backend and frontend are live with Zoho-integrated operational sync.
