# FreshFlow Deployment Guide

This guide covers deploying FreshFlow to production using Supabase for database and authentication.

## Architecture Overview

```
Development:
├── Docker Compose PostgreSQL (local)
└── Supabase Auth (cloud)

Production:
├── Supabase PostgreSQL (São Paulo region)
├── Supabase Auth (included)
└── Backend deployed to Render/Railway/Fly.io
```

## Prerequisites

- Supabase account (free tier works)
- Deployment platform account (Render/Railway/Fly.io)
- Domain name (optional)

---

## Step 1: Setup Supabase Project

### 1.1 Create Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Configure:
   - **Name**: FreshFlow
   - **Database Password**: Generate strong password (save it!)
   - **Region**: São Paulo (sa-east-1) - lowest latency for Brazil
   - **Pricing**: Free tier (500MB database, 50K MAU)
4. Wait ~2 minutes for provisioning

### 1.2 Get Connection Credentials

#### Database Connection String

1. Go to **Project Settings** → **Database**
2. Scroll to **Connection String** → **URI**
3. Copy the connection string (pooler mode for Prisma):

```
postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Important**: Replace `[YOUR-PASSWORD]` with your actual database password.

#### Auth Credentials

1. Go to **Project Settings** → **API**
2. Copy these values:
   - **URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: `eyJhbGciOiJI...` (long JWT token)
   - **service_role key**: `eyJhbGciOiJI...` (keep secret!)

3. Get JWT Secret:
   - Still in **API** settings
   - Scroll to **JWT Settings**
   - Copy **JWT Secret**: `your-super-secret-jwt-token`

---

## Step 2: Configure Production Environment

Create `.env.production` file:

```env
# =============================================================================
# PRODUCTION ENVIRONMENT
# =============================================================================

# Supabase Database (replace with your actual values)
DATABASE_URL=postgresql://postgres.[ref]:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true

# Supabase Auth
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_JWT_SECRET=your-jwt-secret-here

# Backend
PORT=3001
NODE_ENV=production
API_BASE_URL=https://your-backend-url.com

# WhatsApp (Optional)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
WHATSAPP_DEFAULT_PHONE=+5511999999999

# Frontend
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_API_URL=https://your-backend-url.com
```

---

## Step 3: Run Database Migrations

### 3.1 Update DATABASE_URL Locally

Temporarily update your local `.env` with Supabase connection string:

```bash
# Backup your local .env
cp .env .env.local.backup

# Update DATABASE_URL in .env to point to Supabase
# DATABASE_URL=postgresql://postgres.[ref]:[PASSWORD]@aws-0-sa-east-1.pooler...
```

### 3.2 Run Migrations

```bash
# Run migrations against Supabase database
pnpm db:migrate

# Seed initial data (optional for production)
pnpm db:seed
```

### 3.3 Restore Local .env

```bash
# Restore local development config
mv .env.local.backup .env
```

---

## Step 4: Setup Supabase Authentication

### 4.1 Create Test Users

1. Go to **Authentication** → **Users** in Supabase Dashboard
2. Click **Add User** → **Create new user**
3. Create test accounts:

**Platform Admin**:
- Email: `admin@freshflow.com`
- Password: `AdminPassword123!`
- Send email confirmation: NO (for testing)

**Tenant Owner**:
- Email: `owner@freshco.com`
- Password: `OwnerPassword123!`

**Account Owner (Chef)**:
- Email: `chef@chefstable.com`
- Password: `ChefPassword123!`

### 4.2 Configure Email Settings (Optional)

For production with real users:

1. Go to **Authentication** → **Email Templates**
2. Customize confirmation and password reset emails
3. Configure SMTP (or use Supabase's built-in email)

---

## Step 5: Deploy Backend

### Option A: Deploy to Render (Recommended)

#### 5.1 Create Web Service

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **New** → **Web Service**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `freshflow-backend`
   - **Environment**: `Node`
   - **Region**: `Oregon (US West)` or `Frankfurt (EU)` (closest to São Paulo)
   - **Branch**: `master`
   - **Build Command**: `pnpm install && pnpm --filter backend build`
   - **Start Command**: `pnpm start`
   - **Instance Type**: Free or Starter ($7/mo)

#### 5.2 Add Environment Variables

In Render dashboard, add all variables from `.env.production`:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_JWT_SECRET`
- `NODE_ENV=production`
- `API_BASE_URL` (use Render's provided URL)
- (Optional) Twilio variables

#### 5.3 Deploy

Click **Create Web Service** - Render will automatically build and deploy.

**Your backend URL**: `https://freshflow-backend.onrender.com`

### Option B: Deploy to Railway

1. Go to [Railway](https://railway.app/)
2. Click **New Project** → **Deploy from GitHub**
3. Select your repository
4. Configure service:
   - **Root Directory**: Leave empty (monorepo detected)
   - **Build Command**: `pnpm install && pnpm --filter backend build`
   - **Start Command**: `cd backend && pnpm start`
5. Add environment variables (same as Render)
6. Deploy

**Your backend URL**: `https://freshflow-backend.up.railway.app`

---

## Step 6: Deploy Frontend

### Option A: Deploy to Vercel (Recommended)

#### 6.1 Install Vercel CLI

```bash
npm install -g vercel
```

#### 6.2 Configure Vercel

Create `vercel.json` in project root:

```json
{
  "buildCommand": "cd frontend && pnpm install && pnpm build",
  "outputDirectory": "frontend/dist",
  "framework": "vite",
  "env": {
    "VITE_SUPABASE_URL": "https://xxxxx.supabase.co",
    "VITE_SUPABASE_ANON_KEY": "eyJhbGciOiJI...",
    "VITE_API_URL": "https://freshflow-backend.onrender.com"
  }
}
```

#### 6.3 Deploy

```bash
cd freshflow
vercel --prod
```

**Your frontend URL**: `https://freshflow.vercel.app`

### Option B: Deploy to Netlify

1. Go to [Netlify Dashboard](https://app.netlify.com/)
2. Click **Add new site** → **Import from Git**
3. Select your repository
4. Configure:
   - **Base directory**: `frontend`
   - **Build command**: `pnpm install && pnpm build`
   - **Publish directory**: `frontend/dist`
5. Add environment variables in **Site settings** → **Environment variables**
6. Deploy

---

## Step 7: Configure CORS

Update backend `server.ts` CORS origin to include your frontend URL:

```typescript
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? 'https://freshflow.vercel.app'
    : 'http://localhost:5173',
  credentials: true,
}));
```

Commit and redeploy backend.

---

## Step 8: Verify Production Deployment

### 8.1 Test Backend

```bash
curl https://freshflow-backend.onrender.com/health
# Expected: {"status":"ok","timestamp":"2026-01-27T..."}
```

### 8.2 Test Frontend

1. Visit `https://freshflow.vercel.app`
2. Login with test user: `chef@chefstable.com`
3. Try creating an order
4. Verify database updated in Supabase Dashboard

### 8.3 Test PDF Generation

1. Create and finalize an order
2. Click "Download PDF"
3. Verify PDF contains correct data

---

## Cost Estimate (Brazil, 2026)

| Service | Tier | Monthly Cost (BRL) | Monthly Cost (USD) |
|---------|------|-------------------|-------------------|
| **Supabase** | Free | R$ 0 | $0 |
| **Render (Backend)** | Free | R$ 0 | $0 |
| **Vercel (Frontend)** | Free | R$ 0 | $0 |
| **Total (Free Tier)** | | **R$ 0** | **$0** |

**Paid tiers (when you outgrow free)**:
- Supabase Pro: R$ 150/mo ($25)
- Render Starter: R$ 42/mo ($7)
- Vercel Pro: R$ 120/mo ($20)
- **Total**: R$ 312/mo ($52)

---

## Production Monitoring

### Supabase Dashboard

- **Database**: Monitor storage, queries, performance
- **Auth**: Track user signups, active users
- **Logs**: View auth and database logs

### Render Dashboard

- **Metrics**: CPU, memory, response times
- **Logs**: Real-time application logs
- **Deploy History**: Rollback if needed

### Application Logs

Backend logs include:
- Order creation
- WhatsApp notifications
- PDF generation
- Database queries

---

## Scaling Considerations

### When to Upgrade Supabase (Free → Pro)

- Database size > 500MB (~50,000 orders)
- Monthly active users > 50,000
- Need more than 2GB egress bandwidth/month
- Need point-in-time recovery (PITR) backups

### When to Upgrade Backend Hosting

- Response times > 1 second
- Memory usage consistently > 512MB
- CPU usage consistently > 80%
- Need zero-downtime deployments

---

## Troubleshooting

### "Connection timeout" errors

**Cause**: Supabase connection pooler issues

**Fix**: Use direct connection (port 5432) instead of pooler (6543):
```
DATABASE_URL=postgresql://postgres.[ref]:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

### "JWT verification failed"

**Cause**: Wrong JWT secret or Supabase URL

**Fix**:
1. Verify `SUPABASE_JWT_SECRET` matches Supabase dashboard
2. Ensure `SUPABASE_URL` is correct
3. Check user created in Supabase Auth dashboard

### "Prisma Client not generated"

**Cause**: Missing Prisma generation in build

**Fix**: Add to build command:
```bash
pnpm prisma generate && pnpm build
```

---

## Rollback Procedure

### Backend Rollback

**Render**: Go to Deploy History → Click "Rollback" on previous deploy

**Railway**: Go to Deployments → Click "Redeploy" on previous version

### Database Rollback

**Supabase**: Use point-in-time recovery (Pro plan only)

**Manual**: Restore from backup:
1. Go to **Database** → **Backups**
2. Download most recent backup
3. Restore using `psql`

---

## Security Checklist

- [ ] All environment variables configured
- [ ] `SUPABASE_JWT_SECRET` kept secret (never commit to git)
- [ ] CORS configured to allow only your frontend domain
- [ ] HTTPS enabled on all services (automatic on Render/Vercel)
- [ ] Supabase RLS (Row Level Security) policies configured (optional)
- [ ] Rate limiting enabled on API routes (optional)
- [ ] Webhook signature verification for WhatsApp (optional)

---

## Next Steps

1. **Custom Domain**: Configure custom domain on Vercel/Render
2. **Email Alerts**: Setup monitoring alerts (UptimeRobot, BetterStack)
3. **Analytics**: Add analytics (Plausible, Google Analytics)
4. **Error Tracking**: Setup Sentry for error monitoring
5. **Backups**: Schedule regular database backups (Supabase Pro has automatic daily backups)

---

## Support

- **Supabase Docs**: https://supabase.com/docs
- **Render Docs**: https://render.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **FreshFlow Issues**: https://github.com/your-org/freshflow/issues
