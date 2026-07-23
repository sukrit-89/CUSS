# ReRail — Gasless Payout Infrastructure on Stellar

> **Set up a grant. Send a link. Get paid — no wallet setup or XLM required.**

ReRail is a gasless payout infrastructure platform built on Stellar that enables organizations to distribute USDC rewards, hackathon prizes, scholarships, and community grants through secure, shareable claim links.

Recipients claim funds without ever holding XLM or needing gas tokens. Organizers manage campaigns through an intuitive, real-time dashboard. Every distribution is verifiable, transparent, and auditable on-chain.

---

## 🌟 Key Features

* **Gasless Payout Links:** Every claim link is powered by Stellar native **Claimable Balances** and wrapped in **Fee Bump Transactions**. Recipients pay zero gas fees.
* **Bulk CSV Upload & Parsing:** Upload hundreds of payout recipients in seconds with automatic address validation, injection protection, and error reporting.
* **Organizer Dashboard:** Track real-time distribution progress, claim rates, active links, and recipient statuses (`Pending`, `Claimed`, `Expired`).
* **Non-Crypto Friendly:** Send claim URLs over email, Slack, Discord, or Telegram. Recipients connect a wallet or create one when claiming.
* **Soroban Contract Registry:** Optional on-chain campaign registry contract (`rerail_registry`) for immutable audit trails and contract-level campaign verification.
* **Automated Expiry & Reclaim:** Organizers can enforce deadline predicates so unclaimed balances auto-expire and return to the organization's treasury after a set period.

---

## 🏗️ Technical Architecture

```
[Organizer Browser]
        ↓
[React + Vite + TypeScript Frontend]  ←──→  [Supabase (Auth + PostgreSQL + RLS)]
        ↓
[Stellar SDK (JS) + Horizon API]
        ↓
[Stellar Network — Testnet]
        ↙                      ↘
[Claimable Balances]    [Fee Bump Transactions]
                                ↑
                    [ReRail Fee Payer Account]

[Recipient Browser]
        ↓
[Claim Page (React)]
        ↓
[Freighter Wallet / Sponsored New Account]
        ↓
[Fee Bump Transaction → Stellar Network]
```

### Stack Overview
* **Frontend:** React 19, Vite, TypeScript, Tailwind CSS
* **Blockchain:** `@stellar/stellar-sdk`, `@stellar/freighter-api`, Soroban Smart Contracts (Rust)
* **Backend / Database:** Supabase (PostgreSQL, Row Level Security, Auth)
* **Serverless Functions:** Vercel API routes for server-side fee-bump wrapping

---

## 🚀 Getting Started

### Prerequisites

* Node.js v20+ or Bun v1.3+
* Freighter Wallet extension installed in browser
* Supabase project (for database & auth)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/sukrit-89/CUSS.git rerail
   cd rerail
   ```

2. Install dependencies:
   ```bash
   npm install
   # or with bun:
   bun install
   ```

3. Environment Setup:
   Copy `.env.example` to `.env.local` and configure your environment variables:
   ```bash
   cp .env.example .env.local
   ```

   ```env
   VITE_SUPABASE_URL=https://your-supabase-url.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   VITE_HORIZON_URL=https://horizon-testnet.stellar.org
   VITE_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
   VITE_USDC_ISSUER=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
   VITE_CLAIM_LINK_BASE_URL=http://localhost:5173
   ```

4. Run local development server:
   ```bash
   npm run dev
   # or with bun:
   bun dev
   ```

---

## 📜 Soroban Smart Contract (`rerail_registry`)

The repository includes a Soroban smart contract written in Rust under `contracts/rerail_registry`.

### Build Contract
```bash
npm run contracts:build
```

### Run Contract Tests
```bash
npm run contracts:test
```

### Contract Functions Summary
* `create_campaign`: Initializes a campaign on-chain with default amounts and deadlines.
* `register_recipient`: Links a recipient address and claim token hash to a campaign.
* `activate_campaign`: Transitions campaign status from `Draft` to `Active`.
* `mark_balance_created`: Binds an on-chain Stellar claimable balance ID to a recipient record.
* `record_claim`: Records an executed claim on-chain.
* `expire_campaign`: Marks a campaign expired after the deadline.

---

## 🔐 Security & Key Management

* **No Custodial Keys:** Organizers sign campaign creation transactions directly using Freighter in their browser.
* **Server-Side Fee Payer:** Fee payer secret keys live exclusively as server-side environment variables (`FEE_PAYER_SECRET`) in serverless handlers and are never exposed to the client.
* **Un-guessable Claim Links:** Claim URLs use UUID v4 tokens with 128-bit entropy.
* **Row Level Security (RLS):** Supabase RLS guarantees organizers can only access their own campaign data.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
