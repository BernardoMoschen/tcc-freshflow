# FreshFlow

Sistema B2B de pedidos e gestao de estoque para distribuidoras de hortifruti.

![CI](https://github.com/USERNAME/freshflow/actions/workflows/ci.yml/badge.svg)

## Sobre o Projeto

O FreshFlow e uma plataforma web completa para distribuidoras de hortifruti gerenciarem pedidos B2B com restaurantes, mercados e outros estabelecimentos. O sistema cobre todo o ciclo operacional: desde o catalogo de produtos e criacao de pedidos, passando pela separacao e pesagem (catch-weight), ate a finalizacao com geracao de romaneio em PDF.

**Principais funcionalidades:**

- **Pedidos B2B** — Clientes fazem pedidos online; operadores acompanham, separam e finalizam
- **Pesagem catch-weight** — Produtos vendidos por peso sao pesados na separacao, ajustando valores automaticamente
- **Gestao de estoque** — Movimentacoes automaticas na finalizacao, com ajustes manuais e rastreabilidade completa
- **Notificacoes WhatsApp** — Envio automatico de status de pedido via Twilio
- **Analytics** — Dashboard com metricas de vendas, produtos mais vendidos e desempenho por cliente
- **Multi-tenant** — Suporte a multiplas distribuidoras com contas e clientes independentes
- **RBAC** — Controle de acesso com 5 niveis de permissao
- **Suporte offline** — Pesagem funciona offline com sincronizacao automatica (IndexedDB)
- **Audit log** — Registro completo de todas as acoes para compliance

## Tech Stack

| Backend | Frontend | Infraestrutura |
|---------|----------|----------------|
| Node.js 20 | React 18 | Docker |
| Express | Vite | GitHub Actions CI |
| tRPC v11 | TypeScript | Vitest + v8 coverage |
| Prisma ORM | Tailwind CSS | pnpm monorepo |
| PostgreSQL 16 | Radix UI | ESLint + Prettier |
| Zod | TanStack React Query | |
| Redis | tRPC Client | |
| Twilio (WhatsApp) | Supabase Auth | |
| PDFKit | Dexie (IndexedDB/offline) | |
| Jose (JWT) | React Router v6 | |

## Arquitetura

```
freshflow/
├── backend/           # API (Express + tRPC), Prisma ORM, logica de negocio
├── frontend/          # SPA (React + Vite), Tailwind CSS, Radix UI
├── tests/             # Testes de integracao e E2E
├── docker-compose.yml # PostgreSQL local
├── Dockerfile         # Build multi-stage para producao
└── pnpm-workspace.yaml
```

### Ambiente de Desenvolvimento

```
┌─────────────────┐       ┌──────────────────┐
│   Frontend      │──────▶│    Backend       │
│   (React+Vite)  │       │   (Express+tRPC) │
│   :5173         │       │   :3001          │
└─────────────────┘       └──────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
              ┌─────▼─────┐             ┌──────▼──────┐
              │  Docker    │             │  Supabase   │
              │  Postgres  │             │  Auth       │
              │  :5432     │             │  (Cloud)    │
              └────────────┘             └─────────────┘
```

### Padroes Arquiteturais

- **Type safety end-to-end** — tRPC compartilha tipos entre backend e frontend sem code generation
- **State machine de pedidos** — `DRAFT` → `SENT` → `IN_SEPARATION` → `FINALIZED`
- **Multi-tenant** — Hierarquia Tenant → Account → Customer com isolamento de dados
- **Catch-weight** — Dois tipos de unidade (`FIXED` e `WEIGHT`) com fluxo de pesagem dedicado
- **RBAC hierarquico** — 5 niveis: Platform Admin → Tenant Owner → Tenant Admin → Account Owner → Account Buyer
- **Event-driven audit** — Todas as acoes criticas geram registros de auditoria
- **18 modelos Prisma** — Schema completo em [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma)

### Resolucao de Precos

Precos seguem esta hierarquia (maior prioridade primeiro):

1. **Override manual** — Definido durante pesagem
2. **Preco por cliente** — Override persistente por cliente (CustomerPrice)
3. **Preco base** — Preco padrao do ProductOption

## Pre-requisitos

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 8
- [Docker](https://www.docker.com/) (para PostgreSQL local)
- Conta no [Supabase](https://supabase.com/) (autenticacao)

```bash
# Instalar pnpm caso nao tenha
npm install -g pnpm
```

## Como Rodar

```bash
# 1. Clone o repositorio
git clone https://github.com/USERNAME/freshflow.git
cd freshflow

# 2. Instale as dependencias
pnpm install

# 3. Configure as variaveis de ambiente
cp .env.local.example .env
# Edite o .env com suas credenciais (Supabase, etc.)

# 4. Suba o PostgreSQL via Docker
docker-compose up -d

# 5. Gere o Prisma Client e execute migrations
cd backend && npx prisma generate && cd ..
pnpm db:migrate

# 6. Popule o banco com dados de exemplo
pnpm db:seed

# 7. Inicie o servidor de desenvolvimento
pnpm dev
# Backend: http://localhost:3001
# Frontend: http://localhost:5173
```

### Dados do Seed

O seed cria um ambiente completo para desenvolvimento:

- 1 tenant (Verde Campo Distribuidora) com configuracoes
- 3 contas/restaurantes com dados brasileiros (CNPJ, CEP, telefone)
- 7 usuarios com diferentes niveis de acesso
- 35 produtos em 7 categorias (Frutas, Hortalicas, Legumes, Ovos, Carnes, Queijos, Temperos)
- 8 pedidos em todos os status do ciclo de vida
- Pesagens, movimentacoes de estoque, atividades e notas de entrega

## Scripts Disponiveis

| Comando | Descricao |
|---------|-----------|
| `pnpm dev` | Inicia backend e frontend em modo desenvolvimento |
| `pnpm build` | Build de producao (backend + frontend) |
| `pnpm test:unit` | Executa testes unitarios |
| `pnpm test:coverage` | Testes com relatorio de cobertura HTML |
| `pnpm typecheck` | Verificacao de tipos TypeScript |
| `pnpm lint` | Linting com ESLint |
| `pnpm db:migrate` | Executa migrations do Prisma |
| `pnpm db:seed` | Popula o banco com dados de exemplo |

## Testes

O projeto possui **119 testes unitarios** distribuidos em 6 suites, com **~86% de cobertura** na logica de negocio:

| Suite | Modulo | Testes |
|-------|--------|--------|
| Price Engine | `lib/price-engine.ts` | 14 |
| RBAC | `rbac.ts` | 18 |
| Order State | `lib/order-state.ts` | 29 |
| CSV Export | `lib/csv-export.ts` | 10 |
| Errors | `lib/errors.ts` | 19 |
| Sanitize | `lib/sanitize.ts` | 29 |

```bash
# Rodar testes
pnpm test:unit

# Rodar com cobertura (gera relatorio HTML em backend/coverage/)
pnpm test:coverage
```

> Modulos de infraestrutura (banco de dados, Redis, Twilio) sao excluidos da cobertura por design — requerem testes de integracao com servicos reais, e mocka-los criaria falsos positivos.

## Documentacao da API

Com o servidor rodando, acesse a documentacao interativa:

- **Swagger UI**: [http://localhost:3001/docs](http://localhost:3001/docs)
- **OpenAPI spec**: [`backend/src/docs/openapi.yaml`](backend/src/docs/openapi.yaml)

### Endpoints Principais (tRPC)

| Procedimento | Descricao |
|-------------|-----------|
| `auth.session` | Sessao do usuario atual + memberships |
| `products.list` | Listar produtos (filtro por categoria, busca) |
| `products.get` | Produto com precos resolvidos por cliente |
| `orders.getDraft` | Obter ou criar rascunho de pedido |
| `orders.submitDraft` | Enviar pedido (DRAFT → SENT) |
| `orders.list` | Listar pedidos (filtro por status) |
| `orders.weigh` | Pesar item (catch-weight) |
| `orders.finalize` | Finalizar pedido (valida pesagens) |
| `stock.movements` | Movimentacoes de estoque |
| `analytics.dashboard` | Metricas e KPIs |

### Endpoints HTTP

| Rota | Descricao |
|------|-----------|
| `GET /health` | Health check |
| `GET /docs` | Swagger UI |
| `GET /api/delivery-note/:orderId.pdf` | Download do romaneio PDF |

## Banco de Dados

O schema Prisma define **18 modelos** que cobrem todo o dominio:

| Dominio | Modelos |
|---------|---------|
| Organizacao | Tenant, Account, User, Membership, Role |
| Catalogo | Product, ProductOption, CustomerPrice |
| Pedidos | Order, OrderItem, OrderActivity, DeliveryNote |
| Estoque | StockMovement, Weighing |
| Configuracao | TenantSettings, UserPreferences |
| Auditoria | AuditLog |

Schema completo: [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma)

## RBAC (Controle de Acesso)

| Role | Permissoes |
|------|------------|
| `PLATFORM_ADMIN` | Acesso total a todos os tenants e contas |
| `TENANT_OWNER` | Acesso total ao tenant e todas as contas |
| `TENANT_ADMIN` | Administracao do tenant e contas |
| `ACCOUNT_OWNER` | Gerenciar conta, criar pedidos |
| `ACCOUNT_BUYER` | Criar e visualizar pedidos |

Enforcement via middleware tRPC:
- `protectedProcedure` — Requer JWT valido
- `tenantProcedure` — Requer JWT + `x-tenant-id` + membership
- `accountProcedure` — Requer JWT + `x-account-id` + membership

## Deploy em Producao

### Docker

```bash
docker build -t freshflow:latest .
docker run -p 3001:3001 --env-file .env freshflow:latest
```

### Variaveis de Ambiente (Producao)

```env
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ...
SUPABASE_JWT_SECRET=your-jwt-secret
PORT=3001
NODE_ENV=production
```

## Estrutura do Projeto

```
backend/src/
├── server.ts              # Express + tRPC server setup
├── trpc.ts                # tRPC context e middleware
├── auth.ts                # Verificacao JWT (Supabase)
├── rbac.ts                # Controle de acesso por roles
├── router.ts              # Root tRPC router
├── routers/               # Feature routers (auth, products, orders, stock, analytics)
├── lib/                   # Logica de negocio (price-engine, order-state, csv-export)
├── repositories/          # Camada de acesso a dados
├── services/              # Servicos de negocio
├── middleware/             # Middleware Express
├── pdf/                   # Geracao de PDF (romaneio)
├── db/                    # Prisma client singleton
├── docs/                  # OpenAPI/Swagger
└── __tests__/             # Testes unitarios

frontend/src/
├── App.tsx                # Componente raiz + rotas
├── pages/                 # Paginas (admin/, chef/, public/)
├── components/            # Componentes compartilhados + UI library (Radix)
├── hooks/                 # React hooks (auth, cart, offline, favorites)
└── lib/                   # Utilitarios (supabase, trpc, sanitize, offline)
```

## Licenca

MIT
