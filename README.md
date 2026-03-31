# FreshFlow

B2B ordering and warehouse management platform for fresh produce distributors. Handles the full lifecycle from catalog browsing and order placement by restaurant buyers to warehouse picking, catch-weight measurement, and delivery note generation.

[![CI](https://github.com/BernardoMoschen/tcc-freshflow/actions/workflows/ci.yml/badge.svg)](https://github.com/BernardoMoschen/tcc-freshflow/actions/workflows/ci.yml)

---

## Features

- **Multi-tenant architecture** — each distributor (tenant) manages its own products, customers, and staff
- **Role-based access control** — five roles: Platform Admin, Tenant Owner, Tenant Admin, Account Owner, Account Buyer
- **Catch-weight support** — products sold by weight are priced after physical weighing at the warehouse
- **Buyer portal** — catalog with per-customer pricing, shopping cart with offline sync, order history
- **Warehouse operations** — order separation queue, weighing station, finalization, and delivery note (PDF) generation
- **Real-time updates** — order status changes pushed via Server-Sent Events
- **WhatsApp notifications** — automatic order confirmation via Twilio
- **Analytics dashboard** — revenue, order volume, average ticket, best-selling products, and stock alerts
- **Audit log** — every significant action is recorded with actor, timestamp, and context

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Backend | Node.js, Express, tRPC |
| Database | PostgreSQL 16, Prisma ORM |
| Auth | Supabase Auth (JWT) |
| Cache | Redis (in-memory fallback) |
| Testing | Vitest (unit + integration), Playwright (E2E) |
| CI/CD | GitHub Actions |
| Infra | Docker, Docker Compose |

---

## Project Structure

```text
tcc-freshflow/
├── backend/          # Express + tRPC API server
│   ├── prisma/       # Schema, migrations, seed
│   └── src/
│       ├── routers/  # tRPC procedure definitions
│       ├── services/ # Business logic
│       ├── lib/      # Utilities (cache, audit, events, PDF)
│       └── middleware/
├── frontend/         # React SPA
│   └── src/
│       ├── pages/    # Route-level components
│       ├── components/
│       └── hooks/
└── tests/
    └── e2e/          # Playwright test suite
```

---

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 10
- Docker (for PostgreSQL)

### Installation

```bash
git clone https://github.com/BernardoMoschen/tcc-freshflow.git
cd tcc-freshflow
pnpm install
```

### Environment

Copy the example file and fill in the required values:

```bash
cp .env.local.example .env
```

The minimum required variables for local development:

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5433/freshflow

# Backend
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173

# Auth (dev bypass works without these — see Dev Mode below)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_JWT_SECRET=...

# Frontend
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_API_URL=http://localhost:3001
```

See [`.env.local.example`](.env.local.example) for all available options including Redis and WhatsApp/Twilio.

### Database

Start PostgreSQL via Docker Compose (mapped to port **5433** to avoid conflicts):

```bash
docker-compose up -d postgres
```

Run migrations and seed the database with sample data:

```bash
pnpm db:migrate
pnpm db:seed
```

### Running

```bash
pnpm dev
```

This starts the backend on `http://localhost:3001` and the frontend on `http://localhost:5173` concurrently.

---

## Dev Mode

Supabase auth is skipped in development. Go to `http://localhost:5173/login` and use the **quick login buttons** at the bottom of the page — all 7 seeded users are listed, no password required.

To log out or check the current session from the browser console:

```js
window.devSetup.status() // who am I?
window.devSetup.clear()  // log out
```

---

## Testing

```bash
pnpm test:unit          # Unit tests (Vitest)
pnpm test:integration   # Integration tests against a real DB (Vitest)
pnpm test:e2e           # End-to-end tests (Playwright, seeds DB automatically)
pnpm test               # All of the above
pnpm test:coverage      # Unit tests with coverage report
```

The E2E suite seeds the database before running and covers:

- RBAC routing (all five roles)
- Buyer catalog → cart → order submission flow
- Admin weighing station flow
- PDF delivery note endpoint authentication

---

## CI/CD

GitHub Actions runs five jobs on every push and pull request to `main`/`master`:

| Job | What it checks |
| --- | --- |
| `lint` | ESLint across backend and frontend |
| `typecheck` | TypeScript strict mode compilation |
| `unit-tests` | Business logic, pricing engine, RBAC |
| `integration-tests` | tRPC API procedures against PostgreSQL 16 |
| `e2e-tests` | Full user journeys in Chromium via Playwright |

Test artifacts (coverage reports, screenshots, traces) are retained for 7 days.

---

## API

| Interface | URL |
| --- | --- |
| tRPC | `http://localhost:3001/trpc` |
| REST (PDF, SSE, webhooks) | `http://localhost:3001/api/v1` |
| Swagger UI | `http://localhost:3001/api/docs` |
| Health check | `http://localhost:3001/health` |

---

## Docker

Build and run the production image:

```bash
docker build -t freshflow .
docker run -p 3001:3001 --env-file .env freshflow
```

The image uses a multi-stage build: TypeScript is compiled in the builder stage; only the compiled output and production dependencies are included in the final image.
