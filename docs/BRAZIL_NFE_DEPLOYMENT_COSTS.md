# Brazil NFe Deployment: Complete Cost Analysis

**Last Updated:** February 2, 2026
**Target:** B2B Application with NFe Emission for 2 Tenants in Brazil

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Tech Stack](#current-tech-stack)
3. [Deployment Architecture Options](#deployment-architecture-options)
4. [Cost Breakdown](#cost-breakdown)
5. [Focus NFe Integration](#focus-nfe-integration)
6. [Recommendations](#recommendations)
7. [Scaling Projections](#scaling-projections)
8. [Alternatives Comparison](#alternatives-comparison)

---

## Executive Summary

### Minimum Monthly Cost for 2 Tenants

```
Infrastructure:      $15-27/month
External Services:   $25-65/month
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL:              $40-92/month (~R$240-550/month)
```

### Recommended Approach

**Single VPS Deployment** with Focus NFe API integration
- Most cost-effective for 2 tenants
- Complete control over infrastructure
- Easy to scale
- Predictable costs

---

## Current Tech Stack

### Frontend
- **Framework:** React 18 + Vite
- **UI Library:** Radix UI + Tailwind CSS
- **State Management:** TanStack Query (React Query)
- **Offline Support:** Dexie (IndexedDB)
- **API Client:** tRPC Client
- **Build Output:** Static files (~5-10MB)

### Backend
- **Runtime:** Node.js 20+
- **Framework:** Express + tRPC
- **Database ORM:** Prisma
- **Caching:** Redis
- **Authentication:** Supabase Auth
- **Notifications:** Twilio (WhatsApp/SMS)
- **PDF Generation:** PDFKit
- **API Type:** RESTful + tRPC

### Database
- **Primary:** PostgreSQL 16
- **Cache:** Redis 7
- **Storage Requirements:**
  - Initial: ~100MB
  - Per tenant/month: ~50-100MB
  - Estimated for 2 tenants (1 year): ~1.5GB

### External Services
- Supabase (Auth + optional PostgreSQL)
- Twilio (SMS/WhatsApp notifications)
- Focus NFe (NFe emission)

---

## Deployment Architecture Options

### Option 1: All-in-One VPS (Recommended) ⭐

**Why This is Best for 2 Tenants:**
- Single server handles everything
- No vendor lock-in
- Complete control
- Predictable costs
- Easy to set up with Docker

**Architecture:**
```
┌─────────────────────────────────────────┐
│         Brazil VPS ($12-20/mo)          │
├─────────────────────────────────────────┤
│  ┌──────────────────────────────────┐   │
│  │  Nginx (Port 80/443)             │   │
│  │  - Frontend static files         │   │
│  │  - SSL termination               │   │
│  │  - Reverse proxy                 │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │  Backend API (Port 3001)         │   │
│  │  - Node.js/Express + tRPC        │   │
│  │  - Focus NFe integration         │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │  PostgreSQL (Port 5432)          │   │
│  │  - Internal only                 │   │
│  └──────────────────────────────────┘   │
│  ┌──────────────────────────────────┐   │
│  │  Redis (Port 6379)               │   │
│  │  - Internal only                 │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Minimum VPS Specs:**
- 2 vCPU
- 4GB RAM
- 80GB SSD
- 2TB bandwidth/month
- Brazil datacenter (São Paulo preferred)

**Deployment Method:** Docker Compose

**Pros:**
- ✅ Lowest cost for 2-10 tenants
- ✅ Complete control
- ✅ Single server to manage
- ✅ Low latency in Brazil
- ✅ Easy backups (snapshot entire VPS)
- ✅ No cold starts
- ✅ Predictable performance

**Cons:**
- ❌ Single point of failure (mitigated with backups)
- ❌ Manual scaling (but easy with VPS upgrades)
- ❌ Requires basic DevOps knowledge

**Best For:**
- 2-10 tenants
- Predictable traffic
- Budget-conscious deployments
- Full control requirements

---

### Option 2: Cloud-Native Split

**Why Consider This:**
- Leverage free tiers
- Automatic scaling
- Managed services
- Less DevOps overhead

**Architecture:**
```
┌──────────────────────────────────────────┐
│  Frontend: Vercel/Netlify (FREE)         │
│  - CDN-distributed static files          │
│  - Automatic HTTPS                       │
│  - Global edge network                   │
└──────────────────────────────────────────┘
              ↓
┌──────────────────────────────────────────┐
│  Backend: Railway/Render ($10-15/mo)     │
│  - Auto-deploy from Git                  │
│  - Brazil or closest region              │
│  - Automatic HTTPS                       │
└──────────────────────────────────────────┘
              ↓
┌──────────────────────────────────────────┐
│  Database: Supabase PostgreSQL (FREE)    │
│  - 500MB storage (free tier)             │
│  - São Paulo region                      │
│  - Auto-backups (daily)                  │
└──────────────────────────────────────────┘
              ↓
┌──────────────────────────────────────────┐
│  Cache: Upstash Redis (FREE)             │
│  - 10K commands/day (free tier)          │
│  - Global replication                    │
└──────────────────────────────────────────┘
```

**Pros:**
- ✅ Can start completely FREE
- ✅ Automatic scaling
- ✅ Managed updates
- ✅ Built-in monitoring
- ✅ Zero DevOps
- ✅ Git-based deployments

**Cons:**
- ❌ Free tier limitations (500MB DB, 10K Redis ops/day)
- ❌ Vendor lock-in
- ❌ Costs increase rapidly after free tier
- ❌ Less control
- ❌ Cold starts on free tiers

**Best For:**
- MVP/testing phase
- Unpredictable scaling needs
- Teams without DevOps experience
- When you want to avoid infrastructure management

**Free Tier Limits:**
- Vercel: 100GB bandwidth/month, unlimited builds
- Supabase: 500MB database, 50K MAU auth, 2GB egress
- Upstash Redis: 10K commands/day, 256MB storage
- Railway/Render: 500 hours/month (free tier) OR $5-10/mo

---

### Option 3: Hybrid Approach

**Architecture:**
```
Frontend: Vercel (FREE)
Backend + DB + Redis: Brazil VPS ($12-20/mo)
```

**Why:**
- Get the best of both worlds
- Free global CDN for frontend
- Low-cost controlled backend

**Pros:**
- ✅ Free frontend hosting + CDN
- ✅ Backend control and low cost
- ✅ Good for serving global users with Brazil backend

**Cons:**
- ❌ More complex setup
- ❌ Two places to manage

**Best For:**
- Global B2B with Brazil operations
- When you want CDN benefits but backend control

---

## Cost Breakdown

### Option 1: All-in-One VPS (Recommended)

#### Infrastructure Costs

| Component | Provider | Monthly Cost | Notes |
|-----------|----------|--------------|-------|
| **VPS Hosting** | LightNode Brazil | $12-20 | 2-4GB RAM, 50-80GB SSD |
| | OVHcloud Brazil | $15-25 | 2-4GB RAM, 80GB SSD, better support |
| | Contabo Brazil | $8-15 | Cheapest, but mixed reviews |
| **Domain** | Registro.br (.com.br) | R$40/year (~$1/mo) | Brazilian domain |
| | Any registrar (.com) | $10-15/year (~$1/mo) | International domain |
| **SSL Certificate** | Let's Encrypt | FREE | Auto-renew with Certbot |
| **Backups** | VPS Snapshots | $2-5 | Weekly snapshots |
| | External (optional) | $5-10 | Backblaze B2, AWS S3 |
| | | | |
| **Subtotal** | | **$15-27/month** | |

#### External Services

| Service | Purpose | Monthly Cost | Notes |
|---------|---------|--------------|-------|
| **Supabase Auth** | User authentication | FREE | Up to 50K MAU |
| | | $25/mo (Pro) | When > 50K MAU |
| **Twilio** | SMS/WhatsApp | $5-20 | Pay-per-use (~$0.04/SMS) |
| | | | Estimate: 100-500 msgs/mo |
| **Focus NFe** | NFe emission | **R$100-300** | **NEEDS CONFIRMATION** |
| | | **($17-50)** | Depends on volume + CNPJs |
| | | | |
| **Subtotal** | | **$25-65/month** | |

#### Total Monthly Cost (Option 1)

```
Infrastructure:      $15-27
External Services:   $25-65
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL:              $40-92/month
                    (~R$240-550/month at R$6.00/USD)
```

---

### Option 2: Cloud-Native Split

#### Infrastructure Costs

| Component | Provider | Monthly Cost | Notes |
|-----------|----------|--------------|-------|
| **Frontend** | Vercel | FREE | 100GB bandwidth, unlimited builds |
| | | $20/mo (Pro) | When > 100GB bandwidth |
| **Backend** | Railway | $10-15 | 500h free OR $0.02/h ($10-15 typical) |
| | Render | FREE (500h) | Or $7/mo (Starter) |
| **Database** | Supabase | FREE | 500MB, 50K MAU, 2GB egress |
| | | $25/mo (Pro) | When > limits |
| **Redis** | Upstash | FREE | 10K commands/day |
| | | $10/mo | When > 10K/day |
| **Backups** | Included | FREE | Daily auto-backups |
| | | | |
| **Subtotal** | | **$10-15/month** | All free tiers |
| | | **$62-80/month** | All paid tiers |

#### External Services (Same as Option 1)

| Service | Monthly Cost |
|---------|--------------|
| Supabase Auth | FREE |
| Twilio | $5-20 |
| Focus NFe | $17-50 |
| **Subtotal** | **$25-70** |

#### Total Monthly Cost (Option 2)

**Using Free Tiers:**
```
Infrastructure:      $10-15
External Services:   $25-70
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL:              $35-85/month (~R$210-510/month)
```

**After Outgrowing Free Tiers:**
```
Infrastructure:      $62-80
External Services:   $25-70
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL:              $87-150/month (~R$520-900/month)
```

---

## Focus NFe Integration

### What is Focus NFe?

Focus NFe is a Brazilian SaaS platform providing REST APIs for automated issuance of Brazilian electronic fiscal documents:
- **NFe** (Nota Fiscal Eletrônica) - Electronic invoice
- **NFSe** (Nota Fiscal de Serviço Eletrônica) - Service invoice
- **NFCe** (Nota Fiscal ao Consumidor Eletrônica) - Consumer invoice
- **CTe** (Conhecimento de Transporte Eletrônico) - Transport document
- **MDFe** (Manifesto Eletrônico de Documentos Fiscais) - Fiscal manifest
- **NFCom** (Nota Fiscal de Comunicação) - Communication invoice

### Why Focus NFe?

**Alternatives:**
1. **Direct SEFAZ Integration** (State Tax Authority)
   - ❌ Extremely complex
   - ❌ Different APIs per state (27 states!)
   - ❌ Requires digital certificates
   - ❌ Heavy XML processing
   - ❌ Constant updates to comply with regulations

2. **Focus NFe (API Service)**
   - ✅ Single REST API for all states
   - ✅ Handles SEFAZ communication
   - ✅ Manages certificates
   - ✅ Automatic updates for regulatory changes
   - ✅ Great documentation
   - ✅ No minimum contract

3. **Other NFe API Services:**
   - eNotas.com.br
   - NFe.io
   - PlugNotas
   - Similar pricing, Focus has best docs

**Verdict:** Focus NFe is the best choice for developers

### Focus NFe Pricing

**Official Source:** https://focusnfe.com.br/precos/

**Known Information:**
- No setup fees (except R$199 for new municipality integrations)
- No minimum contract term
- Cancel anytime
- Monthly billing (25th to 24th)
- Pay-per-use model

**Pricing Plans (Need to Confirm on Website):**

| Plan | Best For | Estimated Cost |
|------|----------|----------------|
| **Solo** | 1 CNPJ, low volume | R$50-100/mo |
| **Start** | 2-5 CNPJs | R$100-200/mo |
| **Growth** | 5-20 CNPJs | R$200-400/mo |
| **Enterprise** | 20+ CNPJs | Custom pricing |

**For 2 Tenants:**
- Likely need **Start** or **Growth** plan
- Depends on number of CNPJs per tenant
- Depends on monthly document volume

**Action Required:**
🚨 **You MUST contact Focus NFe to get exact 2026 pricing**
- Visit: https://focusnfe.com.br/precos/
- Or contact sales: https://focusnfe.com.br/contato/
- Provide: number of tenants, CNPJs, expected monthly NFe volume

### Integration Effort

**API Documentation:** https://focusnfe.com.br/doc/

**Integration Complexity:** Medium (2-5 days)

**Required Backend Changes:**
1. Add Focus NFe API client
2. Create NFe issuance endpoint
3. Handle webhooks for status updates
4. Store NFe XML and PDF
5. Add retry logic for failed emissions

**Example Flow:**
```typescript
// POST /api/nfe/issue
1. Receive order data from frontend
2. Transform to Focus NFe format
3. Call Focus NFe API: POST /v2/nfe
4. Receive NFe key (chave de acesso)
5. Poll or webhook for SEFAZ authorization
6. Download XML + PDF from Focus NFe
7. Store in database or cloud storage
8. Return NFe URL to frontend
```

**Code Example:**
```typescript
// backend/src/lib/focusnfe.ts
import axios from 'axios';

const focusNFe = axios.create({
  baseURL: 'https://api.focusnfe.com.br/v2',
  headers: {
    'Authorization': `Basic ${Buffer.from(process.env.FOCUS_NFE_API_KEY + ':').toString('base64')}`,
  },
});

export async function issueNFe(order: Order) {
  const nfeData = {
    natureza_operacao: "Venda de mercadoria",
    data_emissao: new Date().toISOString(),
    tipo_documento: "1", // 0=entrada, 1=saída
    local_destino: "1", // 1=interna, 2=interestadual, 3=exterior
    finalidade_emissao: "1", // 1=normal
    // ... more NFe fields
    items: order.items.map(item => ({
      numero_item: item.id,
      codigo_produto: item.productOption.sku,
      descricao: item.productOption.name,
      quantidade_comercial: item.requestedQty,
      valor_unitario_comercial: item.finalPrice / 100,
      // ... more item fields
    })),
  };

  const response = await focusNFe.post('/nfe', nfeData);
  return response.data; // { chave_nfe, status, caminho_pdf, ... }
}
```

---

## Recommendations

### For 2 Tenants (Current State)

**🏆 Best Choice: Option 1 (All-in-One VPS)**

**Recommended Provider:** LightNode Brazil VPS

**Spec:**
- 2 vCPU, 4GB RAM, 50GB SSD
- $12/month
- São Paulo datacenter
- Deploy in < 60 seconds

**Why:**
1. **Cost-effective:** $40-90/month total (including Focus NFe)
2. **Simple:** One server, Docker Compose, easy to understand
3. **Control:** Full access, no vendor restrictions
4. **Performance:** Brazil datacenter = low latency for your users
5. **Scalable:** Easy to upgrade VPS when you grow

**Setup Time:** 2-4 hours

**Deployment Method:**
```bash
# 1. Provision VPS (LightNode/OVHcloud)
# 2. Install Docker + Docker Compose
# 3. Clone repo
# 4. Configure .env.production
# 5. Run: docker-compose -f docker-compose.prod.yml up -d
# 6. Configure Nginx + Let's Encrypt SSL
# 7. Done!
```

---

### When to Switch to Option 2 (Cloud-Native)

**Trigger Points:**
1. **Tenants > 10:** More complex infrastructure needs
2. **Traffic spikes:** Need auto-scaling
3. **Global expansion:** Need multi-region
4. **Zero DevOps:** Team has no infrastructure experience
5. **Database > 10GB:** Supabase becomes cost-effective
6. **High availability required:** Need multi-server redundancy

**Migration Path:**
```
Current: Single VPS ($40-90/mo)
   ↓
Upgrade VPS to 8GB RAM ($30-50/mo) - handles 10-20 tenants
   ↓
Add load balancer + 2 VPS ($80-120/mo) - handles 20-50 tenants
   ↓
Move to cloud-native ($150-300/mo) - handles 50+ tenants
```

---

## Scaling Projections

### Cost by Tenant Count

| Tenants | Architecture | Infrastructure | Total w/ Services | Notes |
|---------|--------------|----------------|-------------------|-------|
| **2** | Single VPS (2GB) | $12 | $40-90 | Recommended starting point |
| **5** | Single VPS (4GB) | $20 | $50-110 | Same VPS, upgraded |
| **10** | Single VPS (8GB) | $35 | $70-130 | May need database optimization |
| **20** | 2x VPS + LB | $80 | $110-180 | High availability setup |
| **50+** | Cloud-native | $150+ | $200-350 | Managed services pay off |

### Database Growth

| Tenants | Orders/Month | DB Size | PostgreSQL Host |
|---------|--------------|---------|-----------------|
| 2 | 200 | ~500MB | VPS (included) |
| 5 | 500 | ~1.5GB | VPS (included) |
| 10 | 1,000 | ~3GB | VPS (included) or Supabase Pro |
| 20 | 2,000 | ~6GB | Managed PostgreSQL recommended |
| 50+ | 5,000+ | ~15GB+ | Managed PostgreSQL required |

### Traffic Estimates

| Tenants | Users/Day | Requests/Day | Bandwidth/Month | VPS Tier Needed |
|---------|-----------|--------------|-----------------|-----------------|
| 2 | 20 | 2,000 | ~10GB | 2GB RAM |
| 5 | 50 | 5,000 | ~25GB | 4GB RAM |
| 10 | 100 | 10,000 | ~50GB | 8GB RAM |
| 20 | 200 | 20,000 | ~100GB | 16GB RAM or 2x 8GB |
| 50+ | 500+ | 50,000+ | ~250GB+ | Cloud load balancer |

---

## Alternatives Comparison

### VPS Providers (Brazil)

| Provider | Cost/Mo | Specs | Location | Deploy Time | Rating |
|----------|---------|-------|----------|-------------|--------|
| **LightNode** | $12 | 2GB/50GB | São Paulo | 60s | ⭐⭐⭐⭐ |
| **OVHcloud** | $15 | 2GB/80GB | São Paulo | 120s | ⭐⭐⭐⭐⭐ |
| **Contabo** | $8 | 4GB/100GB | São Paulo | 24h | ⭐⭐⭐ |
| **DigitalOcean** | $18 | 2GB/50GB | São Paulo | 60s | ⭐⭐⭐⭐ |
| **Linode/Akamai** | $18 | 2GB/50GB | São Paulo | 60s | ⭐⭐⭐⭐ |
| **Vultr** | $18 | 2GB/55GB | São Paulo | 60s | ⭐⭐⭐⭐ |

**Recommendation:** LightNode (cheapest) or OVHcloud (best support)

### NFe API Services

| Provider | Pricing | Docs Quality | Support | Integration |
|----------|---------|--------------|---------|-------------|
| **Focus NFe** | R$100-300/mo | ⭐⭐⭐⭐⭐ | Good | Easy REST API |
| **eNotas** | R$150-400/mo | ⭐⭐⭐⭐ | Good | REST API + SDK |
| **NFe.io** | R$120-350/mo | ⭐⭐⭐ | OK | REST API |
| **PlugNotas** | R$100-300/mo | ⭐⭐⭐ | OK | REST API |
| **Direct SEFAZ** | FREE | ⭐ | None | Extremely complex |

**Recommendation:** Focus NFe (best documentation, no lock-in)

### Frontend Hosting

| Provider | Free Tier | Cost After | Deploy | CDN | Rating |
|----------|-----------|------------|--------|-----|--------|
| **Vercel** | 100GB/mo | $20/mo | Git push | ✅ | ⭐⭐⭐⭐⭐ |
| **Netlify** | 100GB/mo | $19/mo | Git push | ✅ | ⭐⭐⭐⭐⭐ |
| **Cloudflare Pages** | Unlimited | FREE | Git push | ✅ | ⭐⭐⭐⭐ |
| **VPS + Nginx** | Unlimited | Included | Manual | ❌ | ⭐⭐⭐ |

**For Option 1 (VPS):** Use VPS + Nginx (no extra cost)
**For Option 2 (Cloud):** Use Vercel or Netlify (FREE)

### Backend Hosting (Cloud)

| Provider | Free Tier | Cost After | Region | Cold Start | Rating |
|----------|-----------|------------|--------|------------|--------|
| **Railway** | 500h/mo | $10-15/mo | Global | None | ⭐⭐⭐⭐⭐ |
| **Render** | 750h/mo | $7-21/mo | Global | 30-60s | ⭐⭐⭐⭐ |
| **Fly.io** | 3 VMs free | $5-15/mo | São Paulo | None | ⭐⭐⭐⭐ |
| **Heroku** | None | $25/mo | US only | 30s | ⭐⭐⭐ |

**Recommendation:** Railway (best DX) or Fly.io (São Paulo region)

### Database Hosting (Managed)

| Provider | Free Tier | Cost After | Location | Backups | Rating |
|----------|-----------|------------|----------|---------|--------|
| **Supabase** | 500MB | $25/mo | São Paulo | Daily | ⭐⭐⭐⭐⭐ |
| **Neon** | 0.5GB | $19/mo | US/EU | Daily | ⭐⭐⭐⭐ |
| **Railway** | None | $10-20/mo | Global | Manual | ⭐⭐⭐⭐ |
| **VPS PostgreSQL** | Unlimited | Included | Brazil | Manual | ⭐⭐⭐⭐ |

**For 2 tenants:** VPS PostgreSQL (no extra cost)
**For 10+ tenants:** Supabase (managed, scales easily)

---

## Action Items

### Immediate (This Week)

1. **Contact Focus NFe** for exact pricing
   - Visit: https://focusnfe.com.br/precos/
   - Provide: 2 tenants, ~2-10 CNPJs, estimated NFe volume/month

2. **Choose VPS provider**
   - Recommended: LightNode ($12/mo) or OVHcloud ($15/mo)
   - Sign up and provision São Paulo server

3. **Configure deployment**
   - Create `docker-compose.prod.yml`
   - Set up environment variables
   - Configure SSL with Let's Encrypt

### Short-term (This Month)

4. **Integrate Focus NFe API**
   - Add API client to backend
   - Create NFe issuance endpoint
   - Test with Focus NFe sandbox

5. **Set up monitoring**
   - Server monitoring (UptimeRobot - FREE)
   - Application logging
   - Database backups (weekly snapshots)

6. **Deploy to production**
   - Deploy backend + database
   - Deploy frontend
   - Test end-to-end with real NFe issuance

### Long-term (Next 3-6 Months)

7. **Monitor costs and usage**
   - Track actual Focus NFe costs
   - Monitor VPS resource usage
   - Optimize database queries if needed

8. **Plan for scale**
   - When to upgrade VPS?
   - When to split services?
   - When to add redundancy?

---

## Conclusion

For **2 tenants in Brazil in 2026**, the **absolute cheapest and most practical solution** is:

### Recommended Stack

```
┌─────────────────────────────────────────────────────────┐
│  LightNode Brazil VPS ($12/mo)                          │
│  - Frontend: Nginx + React static files                 │
│  - Backend: Node.js + Express + tRPC                    │
│  - Database: PostgreSQL 16                              │
│  - Cache: Redis 7                                       │
│  - SSL: Let's Encrypt (FREE)                            │
└─────────────────────────────────────────────────────────┘
              +
┌─────────────────────────────────────────────────────────┐
│  External Services                                       │
│  - Supabase Auth (FREE)                                 │
│  - Twilio ($5-20/mo)                                    │
│  - Focus NFe ($17-50/mo, needs confirmation)            │
└─────────────────────────────────────────────────────────┘
              =
┌─────────────────────────────────────────────────────────┐
│  TOTAL: $40-90/month (~R$240-540/month)                 │
└─────────────────────────────────────────────────────────┘
```

### Why This Works

1. **Cost-effective:** Under $100/month for everything
2. **Simple:** One server, Docker Compose, easy to manage
3. **Scalable:** Can grow to 10-20 tenants on same architecture
4. **Compliant:** Focus NFe handles all Brazilian tax requirements
5. **Low latency:** Brazil datacenter serves local users fast
6. **No vendor lock-in:** Standard PostgreSQL, can migrate anytime

### Next Step

🚨 **Get Focus NFe pricing** - this is your biggest unknown cost. Contact them today:
- Website: https://focusnfe.com.br/precos/
- Sales: https://focusnfe.com.br/contato/

Once you have Focus NFe pricing confirmed, your total costs will be fully predictable and you can proceed with deployment.

---

## Resources

- **Focus NFe:** https://focusnfe.com.br/
- **Focus NFe API Docs:** https://focusnfe.com.br/doc/
- **LightNode:** https://go.lightnode.com/brazil-vps
- **OVHcloud Brazil:** https://www.ovhcloud.com/en/vps/vps-brasil/
- **Supabase:** https://supabase.com/
- **Let's Encrypt:** https://letsencrypt.org/
- **Docker Compose:** https://docs.docker.com/compose/

---

**Document Version:** 1.0
**Last Updated:** February 2, 2026
**Author:** FreshFlow Development Team
