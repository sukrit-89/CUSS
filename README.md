# ReRail

> Gasless payout infrastructure on Stellar. Campaign → Claim Link → Paid.

[![Stellar](https://img.shields.io/badge/Stellar-Testnet-blue)](https://stellar.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## What is ReRail?

ReRail enables organisations to distribute USDC rewards, hackathon prizes, scholarships, and grants through secure, shareable claim links on Stellar.

**Recipients claim funds without ever holding XLM.** Organizers manage campaigns through a clean dashboard. Every distribution is on-chain, transparent, and auditable.

### How It Works

1. **Create a campaign** — set pool size, per-recipient amount, and optional deadline
2. **Upload recipients** — CSV with name, email, and wallet address (wallet optional)
3. **Send claim links** — each recipient gets a unique URL; they claim gaslessly

### Stellar Primitives Used

| Primitive | Purpose |
|---|---|
| **Claimable Balances** | Lock USDC per recipient with time-gated access |
| **Fee Bump Transactions** | Sponsor every claim — recipients pay zero gas |
| **Sponsored Accounts** | Create Stellar accounts for non-crypto users (L6) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + TypeScript |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| Routing | React Router v7 |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth (Google OAuth) |
| Wallet | @stellar/freighter-api |
| Blockchain | @stellar/stellar-sdk v16 |
| Serverless | Vercel Functions |
| Hosting | Vercel |

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- [Freighter Wallet](https://freighter.app/) browser extension
- Supabase project (free tier works)

### Setup

```bash
# Clone
git clone https://github.com/your-org/rerail.git
cd rerail

# Install dependencies
npm install

# Copy env template
cp .env.example .env.local
# Fill in your Supabase URL and keys

# Generate testnet accounts
npx tsx scripts/generate-testnet-accounts.ts

# Set up USDC trustlines
npx tsx scripts/setup-usdc-trustline.ts

# Run E2E test
npx tsx scripts/test-claim-flow.ts

# Start dev server
npm run dev
```

### Environment Variables

See [.env.example](.env.example) for all required variables.

---

## Project Structure

```
rerail/
├── api/                     Vercel serverless functions
│   └── claim/[token]/       Claim resolution + execution
├── docs/                    Architecture documentation
├── scripts/                 Developer tooling
├── src/
│   ├── app/                 App shell, router, providers
│   ├── config/              Constants, env, Stellar config
│   ├── features/            Domain modules
│   │   ├── auth/            Authentication
│   │   ├── campaigns/       Campaign management
│   │   ├── claims/          Claim flow
│   │   └── dashboard/       Dashboard & analytics
│   ├── lib/                 Shared infrastructure
│   │   ├── stellar/         Stellar SDK wrappers
│   │   ├── supabase/        Database client + queries
│   │   └── utils/           Validation, formatting, UUID
│   ├── shared/              Shared UI components
│   ├── stores/              Zustand state management
│   └── styles/              Global CSS + design tokens
└── supabase/                Database migrations
```

---

## Documentation

| Document | Description |
|---|---|
| [Architecture](docs/ARCHITECTURE.md) | System design, data flows, deployment |
| [Security](docs/SECURITY.md) | Threat model, key management, RLS |
| [Stellar Integration](docs/STELLAR_INTEGRATION.md) | Claimable Balances, Fee Bumps, batching |
| [API Reference](docs/API.md) | Serverless endpoint specs |

---

## Security Highlights

- **No custodial keys** — organiser and recipient keys never touch ReRail servers
- **Fee payer isolation** — holds only XLM for fees, never USDC
- **Row Level Security** — every database query scoped to the authenticated organiser
- **Protocol-level guarantees** — Stellar enforces claim predicates, prevents double-claims
- **CSV sanitisation** — injection protection on all uploaded data

---

## Stellar Rise In Belt Program

This project is built for the Stellar Rise In Belt Program:

- **L5 (MVP)**: Fully functional on testnet with 5+ users
- **L6 (Production)**: 30+ active users, metrics dashboard, monitoring

---

## License

MIT
