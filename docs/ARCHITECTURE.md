# ReRail — System Architecture

> Gasless payout infrastructure on Stellar. Campaign → Claim Link → Paid.

---

## Overview

ReRail enables organizations to distribute USDC via Stellar native **Claimable Balances**, **Fee Bump Transactions**, and **Sponsored Account Reserves**. Recipients claim funds through a unique shareable link without needing XLM, gas fees, or prior blockchain knowledge.

```
┌──────────────────────────────────────────────────────────────┐
│                     ORGANIZER FLOW                           │
│                                                              │
│  Browser ──→ React App ──→ Supabase Auth (Google OAuth)     │
│                │                                             │
│                ├──→ Supabase PostgreSQL (campaigns, etc.)    │
│                │      (RLS: organizer_id = auth.uid())       │
│                │                                             │
│                └──→ Stellar SDK + Stellar Wallets Kit        │
│                       ├──→ createClaimableBalance (batch)    │
│                       └──→ Horizon API (submit TX)           │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                     RECIPIENT FLOW                           │
│                                                              │
│  Claim Link ──→ React Claim Page (/claim/:token)             │
│                   │                                          │
│                   ├──→ GET /api/claim/:token/resolve         │
│                   │                                          │
│                   ├──→ Wallet State Machine (1–5)            │
│                   │     - Sponsor Account (/api/account)     │
│                   │     - Enable Trustline (/api/trustline)  │
│                   │     - Sign Claim Inner TX                │
│                   │                                          │
│                   └──→ POST /api/claim/:token/execute        │
│                         (Vercel Serverless + Fee Payer)      │
└──────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite 8 | Fast HMR, strong typing, modern bundler |
| Styling | Tailwind CSS v4 + Liquid Glass CSS | Obsidian theme, glassmorphic card primitives |
| Typography | Geist (Google Fonts) | Modern, high-legibility geometric sans-serif |
| State | Zustand | Modular stores (`auth`, `campaign`, `wallet`) |
| Routing | React Router v7 | Single Page App routing with route guards |
| Database | Supabase (PostgreSQL 15) | RLS, real-time queries, Google OAuth |
| Wallet | `@creit.tech/stellar-wallets-kit` | Multi-wallet abstraction (Freighter, Albedo, etc.) |
| Blockchain | `@stellar/stellar-sdk` | Native Stellar protocol operations |
| Serverless | Vercel Serverless Functions | Fee bump execution, sponsorship, claim resolution |

---

## Core Data Models

### Campaigns (`public.campaigns`)
- `id` (UUID, Primary Key)
- `organizer_id` (UUID, references auth.users)
- `name` (TEXT)
- `token` (TEXT, e.g. "USDC")
- `issuer` (TEXT, Stellar Issuer Public Key)
- `amount_per_recipient` (NUMERIC)
- `total_pool` (NUMERIC)
- `deadline` (TIMESTAMPTZ)
- `status` (TEXT: `draft`, `active`, `completed`, `cancelled`)
- `treasury_address` (TEXT)

### Recipients (`public.recipients`)
- `id` (UUID, Primary Key)
- `campaign_id` (UUID, references campaigns)
- `name` (TEXT)
- `email` (TEXT)
- `wallet_address` (TEXT)
- `amount` (NUMERIC)
- `claimable_balance_id` (TEXT)
- `claim_link_token` (TEXT, UUID v4)
- `status` (TEXT: `pending`, `claimed`, `expired`)
- `sponsor_attempts` (INT)
- `trustline_attempts` (INT)
- `claimed_at` (TIMESTAMPTZ)

---

## Gasless State Machine

1. **`no-wallet`**: Recipient has no browser wallet installed. Prompted to install Freighter or supported wallet.
2. **`not-connected`**: Recipient clicks "Connect Wallet" via Stellar Wallets Kit.
3. **`wrong-wallet`**: Validates connected wallet matches recipient's designated address.
4. **`no-account`**: Recipient's account is not active on Stellar. ReRail calls `/api/account/:token/sponsor` to build and execute sponsored account creation + trustline setup.
5. **`no-trustline`**: Account exists but lacks USDC trustline. ReRail calls `/api/trustline/:token/execute` to fee-bump `changeTrust`.
6. **`ready`**: Recipient signs `claimClaimableBalance`. ReRail calls `/api/claim/:token/execute` to fee-bump and submit.

---

## Read-Only DeFi Integrations

- **Reflector Oracle (`reflector.ts`)**: Reads live price feeds directly from the Soroban Reflector contract on Testnet/Mainnet.
- **Blend Protocol (`blend.ts`)**: Queries Blend lending pool contracts to project supply APY on unclaimed campaign treasuries.
- **SoroSwap (`soroswap.ts`)**: Obtains real-time DEX swap quotes for organizers funding campaigns with XLM.
