# Deploy to Vercel (Direct Deploy)

## Option 1: Vercel CLI (Direct from your machine)

1. **Install Vercel CLI** (if not installed):
   ```bash
   npm i -g vercel
   ```

2. **Login** (first time only):
   ```bash
   vercel login
   ```

3. **Deploy from project root**:
   ```bash
   cd c:\Users\rk384\Desktop\LMS
   vercel
   ```
   - Follow prompts: link to existing project or create new
   - For production: `vercel --prod`

## Option 2: Vercel Dashboard (Import project)

1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project**
2. **Import Git Repository** (if connected) or **Deploy without Git**
3. If deploying without Git:
   - Install Vercel CLI and run `vercel` from the project folder
   - Or drag & drop the `public` folder (limited – rewrites won't apply)

## Vercel project settings

| Setting | Value |
|--------|-------|
| **Framework Preset** | Other |
| **Root Directory** | `./` (leave default) |
| **Build Command** | `echo 'Build OK'` (or leave empty) |
| **Output Directory** | `public` |
| **Install Command** | `npm install` (optional – not needed for static) |

## What gets deployed

- **Static frontend** only (HTML, CSS, JS from `public/`)
- **No backend** – API/Node server is not deployed; use demo mode for login/register
- **Clean URLs** – `/courses`, `/dashboard`, etc. work via rewrites

## After deploy

- Your site will be at `https://your-project.vercel.app`
- Use **demo credentials** on Login page (Student, Trainer, Recruiter, Admin) – no server required
