# ReRail — System Architecture

> Gasless payout infrastructure on Stellar. Campaign → Claim Link → Paid.

---

## Table of Contents

- [Overview](#overview)
- [System Design](#system-design)
- [Technology Stack](#technology-stack)
- [Data Flow](#data-flow)
- [Stellar Primitives](#stellar-primitives)
- [Directory Structure](#directory-structure)
- [Deployment](#deployment)

---

## Overview

ReRail enables organisations to distribute USDC via Stellar's native **Claimable Balances** and **Fee Bump Transactions**. Recipients claim funds through a unique shareable link — no wallet setup, no XLM gas fees, no blockchain knowledge required.

### Why Stellar?

| Requirement | Stellar Solution |
|---|---|
| Gasless recipient UX | Fee Bump Transactions — payer covers all fees |
| Trustless fund reservation | Claimable Balances — funds locked on-chain per recipient |
| Deadline enforcement | Time predicates — built into the protocol |
| Low cost | ~0.00001 XLM per operation (~$0.000003) |
| Fast finality | 5-second ledger close time |
| No smart contract needed | First-class protocol primitives, not Soroban |

---

## System Design

```
┌──────────────────────────────────────────────────────────────┐
│                     ORGANISER FLOW                           │
│                                                              │
│  Browser ──→ React App ──→ Supabase Auth (Google OAuth)     │
│                │                                             │
│                ├──→ Supabase PostgreSQL (campaigns, etc.)    │
│                │      (RLS: organizer_id = auth.uid())       │
│                │                                             │
│                └──→ Stellar SDK (browser-side)               │
│                       │                                      │
│                       ├──→ createClaimableBalance (batch)    │
│                       │     Signed via Freighter in-browser  │
│                       │                                      │
│                       └──→ Horizon API (submit TX)           │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                     RECIPIENT FLOW                            │
│                                                              │
│  Claim Link ──→ React Claim Page                             │
│                   │                                          │
│                   ├──→ GET /api/claim/:token/resolve          │
│                   │     (Vercel serverless → Supabase)       │
│                   │                                          │
│                   ├──→ Freighter: sign inner TX              │
│                   │                                          │
│                   └──→ POST /api/claim/:token/execute         │
│                         (Vercel serverless)                  │
│                         │                                    │
│                         ├──→ Wrap in Fee Bump TX             │
│                         ├──→ Sign with Fee Payer key         │
│                         ├──→ Submit to Stellar               │
│                         └──→ Update Supabase status          │
└──────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

1. **No custodial keys** — Organiser signs via Freighter in-browser. Recipient signs via Freighter. ReRail only holds the fee payer key.

2. **Fee payer isolation** — The fee payer account holds minimal XLM (~5 XLM at a time) and only signs fee bump envelopes. It never touches USDC or recipient funds.

3. **Supabase as source of truth** — Campaign metadata, recipient lists, and transaction logs live in PostgreSQL with RLS. The on-chain claimable balance is the authoritative record for fund reservation.

4. **Vercel serverless for secrets** — The fee payer secret key lives in Vercel environment variables. The `/api/claim/execute` endpoint is the only code path that touches it.

---

## Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React 19 + Vite + TypeScript | Fast HMR, strong typing, modern tooling |
| Styling | Tailwind CSS v4 | Utility-first, design token support |
| State | Zustand | Minimal boilerplate, TypeScript-first |
| Routing | React Router v7 | Standard, lazy loading support |
| Database | Supabase (PostgreSQL) | Auth, RLS, real-time, no backend server |
| Auth | Supabase Auth (Google OAuth) | Zero custom auth code |
| Wallet | @stellar/freighter-api | Standard Stellar browser wallet |
| Blockchain | @stellar/stellar-sdk v16 | Claimable Balances, Fee Bumps |
| Serverless | Vercel Functions (Node.js) | Fee bump execution, claim resolution |
| Hosting | Vercel | Edge network, serverless functions |

---

## Data Flow

### Campaign Creation

```
1. Organiser logs in (Google OAuth → Supabase)
2. Creates campaign (name, token, amount, deadline)  → INSERT campaigns
3. Uploads CSV (name, email, wallet_address)          → INSERT recipients[]
4. Previews: total USDC needed + XLM reserve
5. Funds campaign: transfers USDC to treasury address
6. Activates: for each recipient with wallet_address:
   a. createClaimableBalance on Stellar (2 claimants: recipient + organiser)
   b. Store balance_id on recipient row
   c. Log transaction
7. Downloads CSV with claim links
```

### Claim Execution

```
1. Recipient opens claim link: /claim/:token
2. Frontend calls GET /api/claim/:token/resolve
3. Resolve returns: amount, status, campaign name, balance_id
4. Recipient connects Freighter wallet
5. Frontend builds inner TX: claimClaimableBalance(balance_id)
6. Freighter signs inner TX (recipient signature)
7. Frontend sends signed TX XDR to POST /api/claim/:token/execute
8. Server wraps in fee bump, signs with fee payer, submits to Stellar
9. Server updates recipient status to 'claimed' + logs transaction
10. Frontend shows success + transaction hash link
```

### Expired Balance Reclaim

```
1. Organiser views campaign dashboard
2. Sees recipients with status 'expired' (past deadline)
3. Clicks reclaim: builds claimClaimableBalance for organiser
4. Signs via Freighter
5. Submits to Stellar
6. USDC returns to organiser's account
```

---

## Stellar Primitives

### Claimable Balances

A claimable balance is an amount of a specific asset that is "hanging in the air" on the Stellar network, waiting for an authorised claimant to claim it. Key properties:

- **Two claimants**: Recipient (before deadline) + Organiser (after deadline)
- **Time predicates**: Enforce when each claimant can act
- **Atomic**: Either the full amount is claimed or nothing happens
- **Idempotent**: Second claim attempt fails safely (protocol-level protection)

### Fee Bump Transactions

A fee bump wraps an existing signed transaction with a new fee source:

- **Inner TX**: Built and signed by the recipient (claimClaimableBalance)
- **Outer TX**: Wraps inner TX, signed by the fee payer
- **Result**: Recipient pays zero XLM — fee payer covers everything

### Sponsored Account Creation (L6)

For recipients without any Stellar account:

```
beginSponsoringFutureReserves(sponsor → new account)
createAccount(new account, balance: 0)
changeTrust(USDC, source: new account)
endSponsoringFutureReserves(source: new account)
```

Net cost to recipient: **0 XLM**. All reserves sponsored.

---

## Directory Structure

```
rerail/
├── api/                     Vercel serverless functions
│   └── claim/[token]/       Claim resolution + execution
├── docs/                    Architecture documentation
├── scripts/                 Developer tooling (testnet setup, E2E)
├── src/
│   ├── app/                 App shell, router, providers
│   ├── config/              Constants, env, Stellar config
│   ├── features/            Domain modules (auth, campaigns, claims, dashboard)
│   ├── lib/                 Shared infrastructure (stellar, supabase, utils)
│   ├── shared/              Shared UI components
│   ├── stores/              Zustand state management
│   ├── styles/              Global CSS + design tokens
│   └── types/               Global TypeScript types
└── supabase/                Migrations, seed, config
```

---

## Deployment

### Environment Setup

1. Create Supabase project → get URL + keys
2. Run migrations: `npx supabase db push`
3. Generate testnet accounts: `npx tsx scripts/generate-testnet-accounts.ts`
4. Set up USDC trustlines: `npx tsx scripts/setup-usdc-trustline.ts`
5. Configure Vercel env vars (FEE_PAYER_SECRET, SUPABASE_URL, SERVICE_ROLE_KEY)
6. Deploy: `vercel --prod`

### Testnet → Mainnet Migration

When moving to production:

1. Update `NETWORK_PASSPHRASE` to `'Public Global Stellar Network ; September 2015'`
2. Update `HORIZON_URL` to `'https://horizon.stellar.org'`
3. Update `USDC_ISSUER` to Circle's mainnet issuer
4. Fund fee payer with real XLM
5. Enable Supabase production security settings
