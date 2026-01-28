# FreshFlow

B2B fresh produce ordering and warehouse management system with catch-weight support, per-customer pricing, multi-tenant RBAC, PDF delivery statements, and offline-capable admin UI.

## Features

- **Multi-tenant Architecture**: Platform supports multiple distributors (tenants) and their restaurant customers (accounts)
- **Catch-Weight Support**: Handle both fixed-unit and weight-based products
- **Per-Customer Pricing**: Custom price lists with overrides
- **Role-Based Access Control**: 5-level hierarchy (Platform Admin, Tenant Owner, Tenant Admin, Account Owner, Account Buyer)
- **PDF Delivery Statements**: "Extrato de Conferência" format with subtotals
- **Offline-Capable Weighing**: Queue operations when offline, auto-sync when online (last-write-wins)
- **Order Lifecycle**: DRAFT → SENT → IN_SEPARATION → FINALIZED

## Tech Stack

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express + tRPC v11
- **Database**: PostgreSQL via Prisma v7
- **Auth**: Supabase JWT (JWKS verification)
- **PDF Generation**: pdfkit
- **Language**: TypeScript (strict mode)

### Frontend
- **Framework**: React 18 + Vite
- **Routing**: React Router v6
- **Styling**: Tailwind CSS
- **State**: React Query + tRPC React
- **Offline**: Dexie (IndexedDB)
- **Auth**: Supabase client
- **Language**: TypeScript (strict mode)

## Prerequisites

- Node.js 20+ and pnpm 8+
- Docker and Docker Compose (for local Postgres)
- Supabase account and project

Install pnpm if you don't have it:

```bash
npm install -g pnpm
```

## Quick Start

### 1. Clone and Install

```bash
git clone <repo-url> freshflow
cd freshflow
pnpm install
```

### 2. Setup Environment

```bash
cp .env.local.example .env
```

Edit `.env` with your Supabase credentials:

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/freshflow

# Supabase (get from https://app.supabase.com/project/_/settings/api)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJI...
SUPABASE_JWT_SECRET=your-jwt-secret-here

# Backend
PORT=3001
NODE_ENV=development

# Frontend
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJI...
VITE_API_URL=http://localhost:3001
```

### 3. Start Postgres

```bash
docker-compose up -d postgres
```

Wait for Postgres to be ready (check with `docker-compose logs postgres`).

### 4. Run Migrations and Seed

```bash
pnpm db:migrate
pnpm db:seed
```

This creates:
- 5 roles (PLATFORM_ADMIN, TENANT_OWNER, etc.)
- 3 test users (see Test Credentials below)
- 1 tenant: "FreshCo Distributors"
- 1 account: "Chef's Table Restaurant"
- 5 products (mix of FIXED and WEIGHT types)
- 3 customer price overrides
- 1 sample order in SENT status

### 5. Start Dev Servers

```bash
pnpm dev
```

This starts:
- Backend: http://localhost:3001
- Frontend: http://localhost:5173

## Test Credentials

After seeding, you can login with these users:

| Role | Email | Description |
|------|-------|-------------|
| Platform Admin | admin@freshflow.com | Full system access |
| Tenant Owner | owner@freshco.com | FreshCo distributor owner |
| Account Owner (Chef) | chef@chefstable.com | Chef's Table restaurant owner |

**Note**: Passwords are managed by Supabase. Create these users in your Supabase project Auth dashboard.

## Project Structure

```
freshflow/
├── backend/
│   ├── src/
│   │   ├── server.ts              # Express + tRPC server
│   │   ├── trpc.ts                # tRPC context & middleware
│   │   ├── auth.ts                # Supabase JWT verification
│   │   ├── rbac.ts                # Role-based access control
│   │   ├── router.ts              # Root tRPC router
│   │   ├── db/prisma.ts           # Prisma client singleton
│   │   ├── routers/               # Feature routers (auth, products, orders)
│   │   ├── lib/                   # Business logic (price engine, order state)
│   │   └── pdf/statement.ts       # PDF generator
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema
│   │   └── seed.ts                # Seed data
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx                # Root component + routing
│   │   ├── lib/                   # Core libraries (supabase, trpc, offline)
│   │   ├── hooks/                 # React hooks (auth, cart, offline)
│   │   ├── components/            # Shared components
│   │   └── pages/                 # Page components (chef, admin)
│   └── package.json
├── tests/                         # Unit, integration, E2E tests
├── docker-compose.yml             # Local dev stack
├── Dockerfile                     # Production build
└── .github/workflows/ci.yml       # CI pipeline
```

## API Endpoints

### tRPC (Primary API)

**Base URL**: `http://localhost:3001/trpc`

All tRPC procedures require authentication (JWT Bearer token) unless noted.

#### Auth
- `auth.session` - Get current user + memberships

#### Products
- `products.list({skip, take, search?, category?})` - List products (requires x-tenant-id header)
- `products.get({id, customerId?})` - Get product with resolved prices

#### Orders
- `orders.create({notes?, items})` - Create order (SENT status, requires x-account-id header)
- `orders.list({status?, skip, take})` - List orders (filtered by account context)
- `orders.get({id})` - Get order details
- `orders.weigh({orderItemId, actualWeight, finalPrice?, notes?, photoUrl?, persistPrice?})` - Weigh item
- `orders.addItem({orderId, productOptionId, requestedQty})` - Add extra item (admin)
- `orders.finalize({id})` - Finalize order (validates all weights)

### HTTP Endpoints

- `GET /health` - Health check
- `GET /api/delivery-note/:orderId.pdf` - Generate and download PDF (requires auth)

## Development

### Available Scripts

```bash
# Root
npm run dev              # Start backend + frontend
npm run build            # Build both workspaces
npm run db:migrate       # Run Prisma migrations
npm run db:seed          # Seed database
pnpm typecheck           # TypeScript check all workspaces
pnpm lint                # Lint all workspaces
pnpm test                # Run all tests

# Backend only
pnpm --filter backend dev
pnpm --filter backend build
pnpm --filter backend start

# Frontend only
pnpm --filter frontend dev
pnpm --filter frontend build
```

### Database Migrations

```bash
# Create a new migration
cd backend
pnpm prisma migrate dev --name add_something

# Apply migrations (production)
pnpm db:migrate

# Reset database (careful!)
cd backend
pnpm prisma migrate reset
```

### Testing

```bash
# Unit tests (backend business logic)
pnpm test:unit

# Integration tests (tRPC procedures)
pnpm test:integration

# E2E tests (Playwright)
pnpm test:e2e
```

## User Flows

### Chef Flow (Order Creation)

1. Login at `/login` with chef credentials
2. Browse catalog at `/chef/catalog`
3. Add products to cart (FIXED or WEIGHT types)
4. Review cart at `/chef/cart`
5. Submit order (creates order with status SENT, immutable)
6. View orders at `/chef/orders`

### Admin Flow (Warehouse Processing)

1. Login with admin/tenant credentials
2. Navigate to `/admin/weighing/:orderId`
3. Weigh WEIGHT items:
   - Enter actual weight (large numeric input for tablet)
   - Optional: override price
   - Optional: check "persist price" to save as customer override
4. Operations queue offline, sync when online
5. Navigate to `/admin/finalize/:orderId`
6. Review totals (fixed + weighable subtotals)
7. Finalize order (status → FINALIZED)
8. Download PDF delivery statement

## Offline Capabilities

The admin weighing UI supports offline operation:

- **Queue**: Weighing operations saved to IndexedDB when offline
- **Auto-Sync**: Queue syncs automatically when connection restored
- **Conflict Resolution**: Last-write-wins strategy (no conflict UI)
- **Status Indicator**: Shows pending sync count and online/offline status

## Price Resolution

Prices follow this hierarchy (highest priority first):

1. **Manual Override**: Set during weighing (optional)
2. **Customer Price**: Per-customer override (persistent)
3. **Base Price**: Product option default price

## Order Lifecycle

```
DRAFT → SENT → IN_SEPARATION → FINALIZED
```

- **DRAFT**: Editable (not implemented in current UI)
- **SENT**: Immutable, ready for separation
- **IN_SEPARATION**: Weighing in progress
- **FINALIZED**: Complete, PDF available (terminal state)

## RBAC (Role-Based Access Control)

| Role | Permissions |
|------|-------------|
| PLATFORM_ADMIN | Access to all tenants and accounts |
| TENANT_OWNER | Full access to tenant and all accounts |
| TENANT_ADMIN | Admin access to tenant and accounts |
| ACCOUNT_OWNER | Manage account, create orders |
| ACCOUNT_BUYER | Create and view orders |

Enforce via tRPC middleware:
- `protectedProcedure` - Requires valid JWT
- `tenantProcedure` - Requires JWT + x-tenant-id + membership
- `accountProcedure` - Requires JWT + x-account-id + membership

## Production Deployment

### Build

```bash
npm run build
```

This creates:
- `backend/dist/` - Compiled backend
- `frontend/dist/` - Static frontend assets

### Docker

```bash
# Build production image
docker build -t freshflow:latest .

# Run
docker run -p 3001:3001 --env-file .env freshflow:latest
```

### Environment Variables (Production)

Ensure these are set in production:

```env
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_JWT_SECRET=...
PORT=3001
NODE_ENV=production
```

## Troubleshooting

### Backend won't start

- Check Postgres is running: `docker-compose ps`
- Check DATABASE_URL in `.env`
- Check Prisma client generated: `cd backend && npx prisma generate`

### Frontend build errors

- Check Node version: `node --version` (should be 20+)
- Clear node_modules and reinstall: `rm -rf node_modules && npm ci`

### Auth errors

- Verify Supabase credentials in `.env`
- Check JWT_SECRET matches your Supabase project
- Ensure users exist in Supabase Auth dashboard

### PDF generation fails

- Check order is FINALIZED
- Check all WEIGHT items have actualWeight set
- Check user has access to the order's account

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development workflow, code style, and PR guidelines.

## License

Proprietary - All rights reserved

## Support

For issues and questions, contact: support@freshflow.com

---

Built with by Claude Sonnet 4.5
