# ReRail ⚡

<div align="center">

> **Gasless USDC payout infrastructure built on Stellar.**  
> Set up a grant. Send a link. Get paid — no XLM or wallet friction required.

[![CI Pipeline](https://github.com/sukrit-89/CUSS/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/sukrit-89/CUSS/actions/workflows/ci.yml)
[![Vercel Status](https://img.shields.io/badge/Vercel-Production%20Ready-black?logo=vercel&logoColor=white)](https://vercel.com)
[![Stellar Protocol](https://img.shields.io/badge/Stellar-Protocol%2021%2F22-08B5E5?logo=stellar&logoColor=white)](https://stellar.org)
[![Gasless](https://img.shields.io/badge/Gasless-0%20XLM%20Claim-22c55e?logo=lightning&logoColor=white)](https://stellar.org)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20RLS-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

---

## ⚡ What is ReRail?

**ReRail** is an enterprise-grade, gasless payout and grant distribution platform built on the Stellar network. Designed specifically for hackathons, DAO grants, ecosystem funds, and bounty distributions, ReRail removes crypto onboarding friction entirely.

Organizers deposit USDC into native Stellar Claimable Balances and generate secure, unique claim links. Recipients claim their funds directly into any Stellar wallet without ever needing to purchase or hold XLM for transaction fees or account reserves.

---

## 🏗️ Architecture & System Design

ReRail operates via a hybrid non-custodial model:
1. **Organizers** retain 100% control of funds via native Stellar Claimable Balances with reclaim time predicates.
2. **The Serverless Backend** acts strictly as a fee sponsor and atomic registry — it never custodies user keys or private funds.

```
┌─────────────────┐       Create Campaign        ┌────────────────────────────┐
│    ORGANIZER    │ ───────────────────────────> │      Stellar Testnet       │
│ (Freighter/Kit) │                              │ (Native Claimable Balance) │
└─────────────────┘                              └─────────────┬──────────────┘
         │                                                     │
         │ Shares Claim Link (/claim/:token)                   │ Non-Custodial
         ▼                                                     │ Claim (0 Gas)
┌─────────────────┐       Execute Claim          ┌─────────────▼──────────────┐
│    RECIPIENT    │ ───────────────────────────> │    Vercel Serverless API   │
│  (Brand New or  │                              │    (Fee-Bump Envelope)     │
│ Existing Wallet)│                              └────────────────────────────┘
```

---

## ✨ Key Features

- 💸 **100% Gasless Claims:** All transaction fees are sponsored via native Stellar **Fee-Bump Envelopes**. Recipients pay **0 XLM**.
- 🛡️ **Non-Custodial Claimable Balances:** Funds are locked directly in Stellar ledger state with an automatic reclaim deadline for organizers.
- ⚡ **Automated Account Sponsorship:** Brand-new recipient wallets have their **1.5 XLM account reserve** and USDC trustline sponsored on demand.
- 🎨 **Obsidian Liquid Glass Design:** State-of-the-art UI system with Geist typography, micro-interactions, and responsive layout.
- 📊 **DeFi Intelligence Integrations:**
  - **Reflector Oracle:** Live decentralized USD pricing and asset valuation.
  - **Blend Protocol:** Projected yield earnings on pending/unclaimed balances.
  - **SoroSwap:** Direct XLM → USDC swap routing quotes for funding campaigns.
- 🔒 **Enterprise Security Architecture:**
  - SHA-256 token hashing for all claim links stored at rest.
  - Supabase Row Level Security (RLS) isolating organizer campaigns.
  - Atomic serverless execution locks (`begin_gasless_op`) preventing race conditions and double-claims.
  - Global liquid-glass Toast notification system.

---

## 🔄 5-State Recipient Claim Flow

```
[1. Open Claim Link] ──> [2. Connect Stellar Wallet]
                                │
       ┌────────────────────────┴────────────────────────┐
       ▼                                                 ▼
[Wallet Not Activated]                         [Wallet Active, No Trustline]
       │                                                 │
[Sponsored Account Creation (0 XLM)]           [Sponsored USDC Trustline (0 XLM)]
       │                                                 │
       └────────────────────────┬────────────────────────┘
                                ▼
                       [3. Ready to Claim]
                                │ (1-Click Claim)
                                ▼
                   [4. Serverless Fee-Bump Tx]
                                │
                                ▼
                 [5. Payout Received on Stellar]
```

---

## 💻 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4, Zustand |
| **Design System** | Custom Liquid Glass Obsidian (`.liquid-glass`, Geist Font) |
| **Wallets** | `@creit.tech/stellar-wallets-kit` (Freighter, Albedo, Hana, xBull, Lobstr) |
| **Stellar SDK** | `@stellar/stellar-sdk` v16 (Protocol 21/22 Primitives) |
| **Backend / API** | Vercel Serverless Functions (`/api/*` running on Node.js 22) |
| **Database & Auth** | Supabase PostgreSQL with strict RLS & Email/OAuth Auth |
| **DeFi Integrations** | Blend SDK, Reflector Oracle, SoroSwap API |
| **CI/CD** | GitHub Actions (`.github/workflows/ci.yml`), `oxlint`, TypeScript |

---

## 🚀 Local Development Setup

### 1. Prerequisites
- **Node.js** v20+ or **Bun** v1.2+
- **Git**
- **Freighter Wallet** browser extension ([freighter.app](https://www.freighter.app/))

### 2. Clone & Install
```bash
git clone https://github.com/sukrit-89/CUSS.git rerail
cd rerail
bun install
```

### 3. Configure Environment Variables
Copy the example environment configuration:
```bash
cp .env.example .env
```

Fill in the required keys:
```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Stellar Network Configuration
VITE_NETWORK=TESTNET
VITE_HORIZON_URL=https://horizon-testnet.stellar.org
VITE_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
VITE_USDC_ISSUER=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
VITE_CLAIM_LINK_BASE_URL=http://localhost:5173

# Gasless Fee Payer Secret (SDF Testnet Funded)
FEE_PAYER_SECRET=SD6X...your-stellar-secret-key
```

### 4. Start Development Server
```bash
bun run dev
```
Visit `http://localhost:5173` in your browser.

---

## 🌐 Vercel Production Deployment Guide

Deploying ReRail to Vercel takes under 3 minutes:

### Step 1: Push Repository to GitHub
Ensure all code and CI workflows are committed and pushed to your GitHub repository:
```bash
git push origin main
```

### Step 2: Import Project on Vercel
1. Log into your [Vercel Dashboard](https://vercel.com).
2. Click **"Add New..."** → **"Project"**.
3. Select your GitHub repository (`sukrit-89/CUSS` or your fork).
4. **Framework Preset**: Select `Vite`.
5. **Root Directory**: `./` (default).
6. **Build Command**: `bun run build` (or `npm run build`).
7. **Output Directory**: `dist`.

### Step 3: Configure Environment Variables in Vercel
Add the following environment variables in the Vercel project settings (**Settings** → **Environment Variables**):

| Variable Name | Description | Environment |
|---|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Production, Preview, Dev |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase public anonymous key | Production, Preview, Dev |
| `SUPABASE_URL` | Your Supabase project URL (Serverless API) | Production, Preview, Dev |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role secret (Serverless API) | Production, Preview, Dev |
| `FEE_PAYER_SECRET` | Stellar secret key for the gasless sponsor account | Production, Preview, Dev |
| `VITE_NETWORK` | `TESTNET` (or `PUBLIC` for mainnet) | Production, Preview, Dev |
| `VITE_HORIZON_URL` | `https://horizon-testnet.stellar.org` | Production, Preview, Dev |
| `VITE_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` | Production, Preview, Dev |
| `VITE_USDC_ISSUER` | Circle Testnet USDC Issuer `GBBD47...` | Production, Preview, Dev |
| `VITE_CLAIM_LINK_BASE_URL` | Your production domain (e.g. `https://rerail.vercel.app`) | Production, Preview, Dev |

### Step 4: Deploy & Verify
Click **"Deploy"**. Vercel will automatically build the React 19 frontend and deploy the serverless functions under `/api/*` defined in [`vercel.json`](./vercel.json).

---

## 🧪 Verification & Quality Checks

Run the full automated test and lint suite locally before committing:

```bash
# Fast linting across the entire codebase
bun run lint

# TypeScript verification for frontend & serverless API
bun run build
bun run typecheck:api

# Run the complete test & verification suite
bun run verify
```

---

## 🛡️ Security & Privacy

- **No Private Keys Stored**: ReRail never asks for, manages, or stores organizer or recipient private keys.
- **SHA-256 Hashing**: Claim link tokens are hashed with SHA-256 before being stored in Supabase. A database leak cannot expose active claim links.
- **Row Level Security (RLS)**: Organizers can only read, create, and update campaigns and recipients associated with their authenticated UUID.
- **Atomic Concurrency Protection**: The serverless claim endpoint utilizes database-level row locks to eliminate double-spend and race-condition attacks.

---

## 📜 License

Distributed under the MIT License. See [LICENSE](./LICENSE) for more information.

---

<div align="center">
Built with ⚡ on Stellar.
</div>
