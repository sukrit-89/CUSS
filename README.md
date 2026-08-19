# ReRail

<div align="center">

**Gasless USDC payouts on Stellar.**
Set up a grant. Send a link. Get paid — zero XLM required.

[![CI](https://github.com/sukrit-89/CUSS/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/sukrit-89/CUSS/actions/workflows/ci.yml)
[![Vercel](https://img.shields.io/badge/Vercel-Production%20Ready-black?logo=vercel&logoColor=white)](https://vercel.com)
[![Stellar](https://img.shields.io/badge/Stellar-Protocol%2021%2F22-08B5E5?logo=stellar&logoColor=white)](https://stellar.org)
[![Soroban](https://img.shields.io/badge/Soroban-SDK%2026.1-7C3AED?logo=webassembly&logoColor=white)](https://soroban.stellar.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

---

## What it does

ReRail distributes USDC to a list of recipients without requiring any of them to hold XLM. An organizer deposits funds into native Stellar **Claimable Balances**, generates unique claim links, and shares them. When a recipient opens a link and connects a wallet, ReRail sponsors every prerequisite on their behalf — account creation, USDC trustline, and the claim transaction itself — all via **Fee-Bump Envelopes** paid by a server-side fee payer. An optional Soroban smart contract (`rerail_registry`) mirrors the full campaign lifecycle on-chain for auditability.

---

## Architecture

```
Organizer (Freighter / WalletKit)
     │
     ├── 1. Creates campaign in Supabase + signs createClaimableBalance batch
     │      └── On-chain: Claimable Balances with time-predicate reclaim
     │
     ├── 2. POST /api/campaign/sync  (reconciles balance IDs from Horizon effects)
     │      └── Optional: mark_balance_created on rerail_registry contract
     │
     └── 3. Shares claim links:  https://<host>/claim/<uuid-v4-token>

Recipient (any Stellar wallet)
     │
     ├── GET  /api/claim/:token/resolve       → looks up claim metadata
     ├── POST /api/account/:token/sponsor     → creates + sponsors account + trustline
     ├── POST /api/trustline/:token/execute   → fee-bumps a changeTrust tx
     └── POST /api/claim/:token/execute       → fee-bumps the claimClaimableBalance tx
            └── Optional: record_claim on rerail_registry contract
```

The backend is a set of **Vercel Serverless Functions** under `/api`. They hold a single Stellar keypair (`FEE_PAYER_SECRET`) whose only privilege is to pay transaction fees and sponsor reserves. It never signs anything that could move organizer or recipient funds.

---

## Claim flow states

A recipient progresses through up to five states, each handled by a dedicated serverless endpoint:

| # | State | What happens | Endpoint |
|---|---|---|---|
| 1 | **Link opened** | Resolve the claim token against Supabase. Return amount, asset, campaign name, deadline, and current status. | `GET /api/claim/:token/resolve` |
| 2 | **No Stellar account** | Build a sponsored `createAccount` + `changeTrust` transaction. Recipient signs the inner tx; server co-signs and submits. | `POST /api/account/:token/sponsor` |
| 3 | **Account exists, no USDC trustline** | Fee-bump a `changeTrust` inner tx signed by the recipient. | `POST /api/trustline/:token/execute` |
| 4 | **Ready to claim** | Fee-bump a `claimClaimableBalance` inner tx. Supabase marks the recipient as `claimed`. | `POST /api/claim/:token/execute` |
| 5 | **Claimed** | Resolve returns `410` with the claim tx hash so the recipient can verify on-chain. | `GET /api/claim/:token/resolve` |

All fee-consuming endpoints use a database-level atomic lock (`begin_claim` / `begin_gasless_op` RPCs) with a capped attempt budget to prevent replay and race conditions.

---

## Contracts

### `rerail_registry` (Soroban / Rust)

An on-chain state mirror for campaigns and recipients. Not required for payouts to work — claimable balances are native Stellar primitives and operate independently. The registry adds verifiable proof that a specific campaign existed, who was registered, and whether they claimed.

**Source:** `contracts/rerail_registry/src/lib.rs` (718 lines)
**SDK:** Soroban SDK `26.1.1` · Rust edition 2021
**Tests:** 21 unit tests in `contracts/rerail_registry/src/test.rs`

#### Public methods

| Method | Auth | Description |
|---|---|---|
| `__constructor(admin)` | Deploy | Sets the admin address and initialises the campaign counter at 0. |
| `admin()` | None | Returns the admin address. |
| `campaign_count()` | None | Returns the total number of campaigns created. |
| `create_campaign(organizer, name, asset, default_amount, total_pool, deadline)` | Organizer | Creates a new campaign in `Draft` status. Validates amount > 0, pool ≥ amount, deadline in the future. |
| `create_and_register(organizer, name, asset, default_amount, total_pool, deadline, recipients[])` | Organizer | Atomic: creates campaign + registers up to 20 recipients + activates, all in one signature. |
| `register_recipient(organizer, campaign_id, recipient, amount, claim_token_hash)` | Organizer | Registers a single recipient against a `Draft` campaign. Rejects duplicates. |
| `register_recipients(organizer, campaign_id, recipients[])` | Organizer | Batch registers 1–20 recipients against a `Draft` campaign. Returns updated count. |
| `activate_campaign(organizer, campaign_id)` | Organizer | Transitions campaign from `Draft` to `Active`. |
| `mark_balance_created(caller, campaign_id, recipient, balance_id)` | Organizer or Admin | Records that a claimable balance was created for a recipient. Transitions recipient to `Funded`. |
| `record_claim(caller, campaign_id, recipient, tx_hash)` | Organizer or Admin | Records that a recipient claimed. Transitions to `Claimed`. Auto-completes campaign when all recipients have claimed. |
| `expire_campaign(organizer, campaign_id)` | Organizer | Transitions `Active` → `Expired` once the deadline has passed. |
| `get_campaign(campaign_id)` | None | Returns full campaign struct. |
| `get_recipient(campaign_id, recipient)` | None | Returns a recipient's registration record. |
| `get_balance_id(campaign_id, recipient)` | None | Returns the 32-byte balance hash recorded for a recipient. |
| `has_claim_token(campaign_id, claim_token_hash)` | None | Checks whether a claim token hash is already registered. |

#### Data model

```
Campaign {
  id: u64, organizer: Address, name: String, asset: Address,
  default_amount: i128, total_pool: i128, deadline: u64,
  status: Draft | Active | Completed | Expired,
  recipient_count: u32, claimed_count: u32,
}

RecipientRecord {
  campaign_id: u64, recipient: Address, amount: i128,
  claim_token_hash: BytesN<32>,
  status: Pending | Funded | Claimed,
  registered_at: u64,
}
```

Storage keys: `Campaign(u64)`, `Recipient(u64, Address)`, `BalanceId(u64, Address)`, `ClaimTx(u64, Address)`, `ClaimToken(u64, BytesN<32>)`, `Admin`, `NextCampaignId`.

TTL management: instance storage extends to 120 days on every write; persistent storage extends to 120 days per key access (threshold at 30 days).

#### Batch limits

`MAX_BATCH_RECIPIENTS = 20`. Each recipient writes two persistent ledger entries against a network cap of ~50 per transaction. Payouts larger than 20 are chunked client-side.

#### Error codes

| Code | Name | Meaning |
|---|---|---|
| 1 | `NotInitialized` | Contract not constructed |
| 2 | `InvalidAmount` | Amount ≤ 0 |
| 3 | `InvalidPool` | Pool < default amount |
| 4 | `InvalidDeadline` | Deadline in the past |
| 5 | `CampaignNotFound` | No campaign with that ID |
| 6 | `RecipientNotFound` | No recipient registered at that address |
| 7 | `NotOrganizer` | Caller is not the campaign organizer or admin |
| 8 | `InvalidStatus` | Operation not allowed in current campaign/recipient state |
| 9 | `DuplicateRecipient` | Address already registered for this campaign |
| 10 | `DuplicateClaimToken` | Claim token hash already used |
| 11 | `BalanceAlreadyRecorded` | Balance ID already written for this recipient |
| 12 | `ClaimAlreadyRecorded` | Claim tx already recorded |
| 13 | `DeadlineNotReached` | Cannot expire before deadline |
| 14 | `Overflow` | Arithmetic overflow |
| 15 | `EmptyBatch` | Batch has zero recipients |
| 16 | `BatchTooLarge` | Batch exceeds 20 recipients |

#### Contract events

| Event | Topics | Data |
|---|---|---|
| `CampaignCreated` | `campaign_id`, `organizer` | — |
| `RecipientRegistered` | `campaign_id`, `recipient` | — |
| `BalanceRecorded` | `campaign_id`, `recipient` | `balance_id: BytesN<32>` |
| `ClaimRecorded` | `campaign_id`, `recipient` | `tx_hash: BytesN<32>` |
| `CampaignExpired` | `campaign_id` | — |

#### Build & test

```bash
# Build optimised WASM (release profile: opt-level=z, LTO, panic=abort)
bun run contracts:build

# Run all 21 unit tests
bun run contracts:test
```

### Claimable Balances (native Stellar)

The actual fund movement uses native Stellar Claimable Balances, not the Soroban contract. The contract is an optional verification layer.

**Predicates** (`src/lib/stellar/predicates.ts`):
- `recipientPredicate(deadlineSeconds)` — claimable before the relative deadline
- `organizerReclaimPredicate(deadlineSeconds)` — reclaimable after the deadline (NOT before)
- `unconditionalPredicate()` — no deadline, claim anytime

**Batching:** up to `MAX_OPS_PER_TX = 100` `createClaimableBalance` operations per Stellar transaction. Larger payouts are split into multiple transactions automatically.

---

## Serverless API

All endpoints live under `api/` and run as Vercel Serverless Functions (Node.js). They share a `_lib/registry.ts` helper for optional Soroban bookkeeping.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/claim/:token/resolve` | Look up a claim link. Returns amount, asset, campaign name, deadline, and balance ID. Returns `410` with proof if already claimed or expired. |
| `POST` | `/api/claim/:token/execute` | Fee-bumps a signed `claimClaimableBalance` inner tx. Validates: exactly one op, correct balance ID, source matches wallet. Records tx in Supabase. Optionally calls `record_claim` on the registry. |
| `POST` | `/api/account/:token/sponsor` | Two-phase account activation. Phase 1 (no body): returns unsigned `beginSponsoringFutureReserves` → `createAccount` → `changeTrust` → `endSponsoringFutureReserves` XDR. Phase 2 (`signed_tx_xdr`): validates the signed tx field-by-field, co-signs, submits. |
| `POST` | `/api/trustline/:token/execute` | Fee-bumps a signed `changeTrust` inner tx. Validates: exactly one `changeTrust` op, asset matches campaign USDC, source matches recipient. |
| `POST` | `/api/campaign/sync` | Reconciles on-chain claimable balance IDs back into Supabase by reading Horizon transaction effects. Matches recipients by claimant address. Requires bearer auth (organizer session). |

Every endpoint that spends the fee payer's XLM calls a Supabase RPC (`begin_claim` or `begin_gasless_op`) to atomically lock the row and decrement an attempt counter before submitting any transaction.

---

## DeFi integrations

All three are **read-only** and degrade silently to `null` when not configured. The UI hides the corresponding cards.

| Integration | What it provides | Config var |
|---|---|---|
| **Reflector Oracle** | Live USD price for any asset ticker via Soroban simulation. Used for at-a-glance portfolio valuation. 30s cache. | `VITE_REFLECTOR_ORACLE_CONTRACT_ID` |
| **Blend Protocol** | USDC supply APY from a Blend lending pool. Shows projected yield on unclaimed balances. 60s cache. ReRail never deposits. | `VITE_BLEND_USDC_POOL_ID` |
| **SoroSwap** | XLM → USDC swap quote via the SoroSwap aggregator API. Shown in the funding step. Swap execution is not implemented (testnet has no indexed liquidity). | `VITE_SOROSWAP_API_URL` + `VITE_SOROSWAP_API_KEY` |

---

## Project layout

```
├── api/                              # Vercel Serverless Functions
│   ├── _lib/registry.ts              # Shared Soroban registry invocation helper
│   ├── account/[token]/sponsor.ts    # Account creation + trustline sponsorship
│   ├── campaign/sync.ts              # Horizon effect → Supabase reconciliation
│   ├── claim/[token]/execute.ts      # Fee-bump claim execution
│   ├── claim/[token]/resolve.ts      # Claim link resolution
│   └── trustline/[token]/execute.ts  # Fee-bump trustline setup
│
├── contracts/
│   ├── Cargo.toml                    # Workspace root
│   └── rerail_registry/
│       ├── Cargo.toml                # soroban-sdk 26.1.1
│       └── src/
│           ├── lib.rs                # Contract: 15 public methods, 16 error codes, 5 events
│           └── test.rs               # 21 unit tests
│
├── src/
│   ├── config/
│   │   ├── constants.ts              # Network, asset, fee, and status enums
│   │   ├── contracts.ts              # Registry contract ID + feature flag
│   │   ├── env.ts                    # Typed client/server env access
│   │   └── stellar.ts               # Pre-configured USDC Asset + SAC contract ID
│   │
│   ├── lib/
│   │   ├── stellar/
│   │   │   ├── claimable-balance.ts  # Build createClaimableBalance batches
│   │   │   ├── client.ts             # Horizon server singleton
│   │   │   ├── fee-bump.ts           # Build inner claimClaimableBalance tx
│   │   │   ├── predicates.ts         # Time-predicate builders (recipient/organizer/unconditional)
│   │   │   ├── registry-contract.ts  # Soroban contract invocation (client-side)
│   │   │   ├── trustline.ts          # Trustline check + build changeTrust tx
│   │   │   ├── account.ts            # Account existence checks
│   │   │   ├── wallet-kit.ts         # WalletKit initialisation
│   │   │   └── types.ts              # Shared Stellar type definitions
│   │   │
│   │   ├── defi/
│   │   │   ├── blend.ts              # Blend Protocol APY reader (read-only)
│   │   │   ├── reflector.ts          # Reflector Oracle price reader (read-only)
│   │   │   └── soroswap.ts           # SoroSwap quote fetcher (read-only)
│   │   │
│   │   ├── supabase/
│   │   │   ├── client.ts             # Supabase browser client singleton
│   │   │   ├── database.types.ts     # Generated Supabase types
│   │   │   └── queries/              # campaigns.ts, recipients.ts, transactions.ts
│   │   │
│   │   └── utils/
│   │       └── validation.ts         # Stellar amount normalisation, input validation
│   │
│   ├── features/
│   │   ├── auth/services/            # Supabase auth service
│   │   ├── campaigns/
│   │   │   ├── services/             # campaign, activation, reclaim, registry services
│   │   │   ├── types/                # Campaign TypeScript types
│   │   │   └── utils/                # CSV parser + CSV export
│   │   └── claims/services/          # Claim execution service
│   │
│   ├── stores/                       # Zustand stores: auth, campaign, wallet, toast
│   ├── components/                   # Sidebar, WalletButton, NetworkBadge, StatusBadge, etc.
│   ├── pages/                        # Hero, Login, Dashboard, NewPayout, CampaignDetail, Claim, Settings, Docs
│   ├── App.tsx                       # React Router setup
│   └── main.tsx                      # Entry point
│
├── docs/
│   ├── API.md                        # API endpoint documentation
│   ├── ARCHITECTURE.md               # System design details
│   ├── SECURITY.md                   # Security model documentation
│   └── STELLAR_INTEGRATION.md        # Stellar-specific integration notes
│
├── .github/workflows/ci.yml         # GitHub Actions: lint + build + typecheck
├── vercel.json                       # Serverless function config + SPA rewrites + CORS headers
├── .env.example                      # All environment variables with inline docs
└── package.json                      # bun, vite 8, react 19, stellar-sdk 16, soroban
```

---

## Tech stack

| Layer | Technology | Version |
|---|---|---|
| Runtime | Bun | 1.3+ |
| Frontend | React, TypeScript, Vite | 19, ~6.0, 8.1 |
| Styling | Tailwind CSS | v4 |
| State | Zustand | 5.0 |
| Routing | React Router DOM | 7.18 |
| Animation | Motion (Framer) | 12.42 |
| Icons | Lucide React | 1.26 |
| Validation | Zod | 4.4 |
| CSV | PapaParse | 5.5 |
| Wallets | `@creit.tech/stellar-wallets-kit` | 2.5 |
| Stellar SDK | `@stellar/stellar-sdk` | 16.0 |
| DeFi | `@blend-capital/blend-sdk` | 3.3 |
| Auth + DB | Supabase (`@supabase/supabase-js`) | 2.112 |
| Backend | Vercel Serverless Functions | Node.js 22 |
| Contract | Soroban SDK (Rust) | 26.1.1 |
| Linter | oxlint | 1.71 |
| CI | GitHub Actions | — |

---

## Local development

### Prerequisites

- **Bun** 1.2+ (or Node.js 20+)
- **Rust** toolchain with `wasm32-unknown-unknown` target (for contract builds)
- **Stellar CLI** (`stellar`) for contract deployment
- **Freighter** browser extension

### Setup

```bash
git clone https://github.com/sukrit-89/CUSS.git rerail
cd rerail
bun install
cp .env.example .env.local
```

Edit `.env.local` with your Supabase project URL and anon key at minimum.

### Run

```bash
bun run dev
```

Open `http://localhost:5173`. The Vite dev server proxies nothing — serverless functions only run in Vercel or with `vercel dev`.

### Verify

```bash
bun run verify    # lint + build + typecheck:api + contracts:test
```

---

## Environment variables

### Client-side (VITE_ prefix, bundled into the browser)

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Yes | — | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | — | Supabase public anon key |
| `VITE_NETWORK` | No | `TESTNET` | `TESTNET` or `PUBLIC` |
| `VITE_HORIZON_URL` | No | `https://horizon-testnet.stellar.org` | Horizon endpoint |
| `VITE_SOROBAN_RPC_URL` | No | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint |
| `VITE_NETWORK_PASSPHRASE` | No | `Test SDF Network ; September 2015` | Network passphrase |
| `VITE_USDC_ISSUER` | No | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` | USDC issuer (Circle testnet) |
| `VITE_USDC_ASSET_CODE` | No | `USDC` | Asset code |
| `VITE_CLAIM_LINK_BASE_URL` | No | `window.location.origin` | Base URL for generated claim links |
| `VITE_EXPLORER_TX_BASE_URL` | No | `https://stellar.expert/explorer/testnet/tx` | Explorer link prefix |
| `VITE_RERAIL_REGISTRY_CONTRACT_ID` | No | — | Soroban registry contract ID. Omit to run without on-chain mirroring. |
| `VITE_REFLECTOR_ORACLE_CONTRACT_ID` | No | — | Reflector oracle contract for live USD prices |
| `VITE_BLEND_USDC_POOL_ID` | No | — | Blend pool ID for USDC supply APY |
| `VITE_SOROSWAP_API_URL` | No | `https://api.soroswap.finance` | SoroSwap aggregator API |
| `VITE_SOROSWAP_API_KEY` | No | — | SoroSwap API key for quoting |

### Server-side (Vercel environment variables, never bundled)

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role secret (bypasses RLS) |
| `FEE_PAYER_SECRET` | Yes | Stellar secret key for the gasless fee sponsor |
| `STELLAR_HORIZON_URL` | No | Horizon endpoint (defaults to testnet) |
| `STELLAR_SOROBAN_RPC_URL` | No | Soroban RPC endpoint (defaults to testnet) |
| `STELLAR_NETWORK_PASSPHRASE` | No | Network passphrase (defaults to testnet) |
| `STELLAR_USDC_ISSUER` | No | USDC issuer (defaults to Circle testnet) |
| `STELLAR_USDC_CODE` | No | Asset code (defaults to `USDC`) |
| `RERAIL_REGISTRY_CONTRACT_ID` | No | Registry contract ID for server-side bookkeeping |
| `REGISTRY_ADMIN_SECRET` | No | Stellar secret for the registry admin keypair |

---

## Deployment (Vercel)

1. Push to GitHub.
2. Import the repo in the Vercel dashboard.
3. Set framework preset to **Vite**, output directory to `dist`.
4. Add all required environment variables under **Settings → Environment Variables**.
5. Deploy.

Vercel automatically detects `api/**/*.ts` as serverless functions. The `vercel.json` configures SPA rewrites, CORS headers, and a 15-second function timeout.

---

## CI/CD

GitHub Actions runs on every push and PR to `main` (`.github/workflows/ci.yml`):

1. **Lint** — `bun run lint` (oxlint)
2. **Build** — `bun run build` (TypeScript + Vite)
3. **Typecheck API** — `bun run typecheck:api` (serverless functions against `tsconfig.api.json`)

Contract tests (`cargo test`) are included in the local `verify` script but not in CI (no Rust toolchain in the runner by default).

---

## Security

- **Non-custodial.** The fee payer can only pay fees and sponsor reserves. It cannot move organizer or recipient funds.
- **Claim tokens** are UUID v4 values hashed with SHA-256 before storage. A database leak cannot reconstruct valid claim URLs.
- **Row Level Security** on all Supabase tables. Organizers can only access their own campaigns.
- **Atomic locks.** Every fee-spending endpoint acquires a database-level row lock (`begin_claim` / `begin_gasless_op`) before submitting a transaction. This prevents double-claims and limits total attempts per link.
- **Transaction validation.** Every serverless endpoint validates the full structure of the signed inner transaction — operation count, operation type, source account, asset, balance ID — before co-signing or fee-bumping. A tampered transaction is rejected before it costs anything.

See [`docs/SECURITY.md`](./docs/SECURITY.md) for the full threat model.

---

## User Feedback & Onboarding

We collect structured user feedback through a Google Form to guide development priorities.

**[→ Fill out the ReRail Feedback Form](https://forms.google.com/REPLACE_WITH_YOUR_FORM_LINK)**

The form collects:
- Full name and email
- Stellar wallet address
- Overall product rating (1–5)
- Most useful feature (Gasless Claims / CSV Batch Payouts / Claim Link Sharing / Dashboard Analytics / DeFi Insights)
- Open-ended improvement suggestions
- Mainnet readiness sentiment

**Exported responses:** [`docs/user_feedback.csv`](./docs/user_feedback.csv)

> Replace the Google Form link above with your actual form URL after creating it at [forms.google.com](https://forms.google.com).

---

## Next Phase — Improvement Roadmap

Based on collected user feedback, the following improvements are planned for the next development phase:

### 1. Multi-Asset Support
Extend beyond USDC to support any Stellar asset (EURC, yXLM, custom tokens). The contract already accepts an `asset: Address` parameter — frontend and API changes are needed to let organizers pick the asset during campaign creation.

**Commit reference:** [`2a82b02`](https://github.com/sukrit-89/CUSS/commit/2a82b02) — initial campaign creation flow with asset parameter

### 2. Mobile-Optimised Claim Experience
The claim page works on mobile but needs dedicated touch-optimised layouts, deeper Freighter mobile integration, and progressive loading for low-bandwidth connections.

**Commit reference:** [`ae49565`](https://github.com/sukrit-89/CUSS/commit/ae49565) — current claim flow and responsive layout baseline

### 3. Real-Time Claim Notifications
Push notifications (email or webhook) to organizers when a recipient claims. Currently the dashboard requires a manual refresh. This will use Supabase Realtime subscriptions on the `recipients` table.

**Commit reference:** [`2a82b02`](https://github.com/sukrit-89/CUSS/commit/2a82b02) — Supabase schema and recipient status tracking

### 4. Mainnet Deployment & Auditing
Transition from Stellar Testnet to Public network. Requires a security audit of the `rerail_registry` contract, production fee payer funding, and Circle mainnet USDC issuer configuration. All environment variables already support mainnet via config — no code changes needed.

**Commit reference:** [`12da8e7`](https://github.com/sukrit-89/CUSS/commit/12da8e7) — CI/CD pipeline and deployment infrastructure

### 5. SoroSwap Swap Execution
Currently quote-only (testnet has no indexed liquidity). Once SoroSwap indexes testnet or we move to mainnet, enable one-click XLM → USDC conversion directly in the campaign funding step.

**Commit reference:** [`2a82b02`](https://github.com/sukrit-89/CUSS/commit/2a82b02) — SoroSwap integration (`src/lib/defi/soroswap.ts`)

### 6. Batch Reclaim for Expired Campaigns
Allow organizers to reclaim all unclaimed balances in one transaction after the campaign deadline. The predicate logic (`organizerReclaimPredicate`) already supports this — needs a dedicated UI and batched `claimClaimableBalance` builder.

**Commit reference:** [`2a82b02`](https://github.com/sukrit-89/CUSS/commit/2a82b02) — predicate and reclaim service foundations

---

## License

MIT. See [LICENSE](./LICENSE).

---

<div align="center">
Built on Stellar.
</div>
