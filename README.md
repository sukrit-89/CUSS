# ReRail ⚡

> **Gasless payout infrastructure built on Stellar.**  
> Set up a grant. Send a link. Get paid — no XLM or wallet friction required.

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Stellar](https://img.shields.io/badge/Stellar-Testnet-black?logo=stellar)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)

---

## ⚡ What is ReRail?

ReRail is an end-to-end gasless distribution platform on Stellar that allows organizations, hackathons, DAO organizers, and grant managers to send USDC payouts through shareable claim links.

Recipients can claim funds without holding XLM or paying gas fees. ReRail sponsors account reserves, trustline creation, and balance execution through Stellar native protocol primitives.

---

## ✨ Key Features

- 💸 **Gasless Claims:** Recipients pay **0 XLM**. All transaction fees are covered via native Fee-Bump transactions.
- 🔗 **Shareable Claim Links:** Unique, secure UUID v4 claim URLs for every recipient.
- 🔒 **Native Protocol Primitives:** Native Stellar Claimable Balances with time predicates — no complex smart contract risks.
- ⚡ **Sponsored Reserves:** ReRail sponsors account activation and USDC trustlines for brand-new crypto users.
- 🎨 **Liquid Glass UI:** Modern obsidian design system built with Geist typography and subtle glassmorphic styling.
- 📊 **DeFi Intelligence:** Live Reflector Oracle USD prices, Blend Protocol APY yield projections, and SoroSwap DEX swap quotes.
- 🛡️ **Gasless Security:** Atomic attempt caps (`begin_gasless_op`), SHA-256 token hashing, and strict Supabase Row Level Security (RLS).

---

## 🏗️ Architecture & Stack

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS v4, Zustand.
- **Wallet Support:** `@creit.tech/stellar-wallets-kit` (Freighter, Albedo, Hana, xBull, Lobstr).
- **Backend API:** Vercel Serverless Functions (`/api/*`).
- **Database & Auth:** Supabase PostgreSQL with RLS + Google OAuth authentication.
- **Stellar Network:** `@stellar/stellar-sdk` connecting to SDF Testnet / Mainnet.

```
Organizers ──→ ReRail Dashboard ──→ Funding Batch (Stellar SDK) ──→ Claimable Balances
                                                                             │
Recipients ──→ Claim Link (/claim/:token) ──→ Serverless Fee-Bump ───────────┘
```

---

## 📚 Documentation

Detailed technical documentation is available both in the web application at `/docs` and in the repository:

- 📖 [Product Requirements Document (PRD)](./prd.md)
- 🔌 [API Reference](./docs/API.md)
- 🏗️ [System Architecture](./docs/ARCHITECTURE.md)
- 🛡️ [Security Model](./docs/SECURITY.md)
- ⚡ [Stellar Integration Guide](./docs/STELLAR_INTEGRATION.md)

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js v20+ or Bun
- Git
- Supabase account or CLI

### 2. Environment Setup
Clone the repository and create `.env` from template:

```bash
git clone https://github.com/sukrit-89/CUSS.git rerail
cd rerail
bun install
```

Configure your `.env` file:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FEE_PAYER_SECRET=your-stellar-fee-payer-secret
VITE_HORIZON_URL=https://horizon-testnet.stellar.org
VITE_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
VITE_USDC_ISSUER=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
VITE_CLAIM_LINK_BASE_URL=http://localhost:5173
```

### 3. Run Development Server
```bash
bun run dev
```

Open `http://localhost:5173` in your browser.

---

## 🧪 Testing & Verification

Build validation:
```bash
bun run build
```

Database migrations push:
```bash
npx supabase db push
```

---

## 📜 License

MIT License © 2026 ReRail
