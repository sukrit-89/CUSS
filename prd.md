> This document captures every decision made in the architecture deep-dive and UI planning session. It supersedes v3 on frontend spec, integration stack, and testnet USDC strategy. Read this alongside v3 for full context.
> 

# 1. What Changed from v3

| Area | v3 | v4 (this doc) |
| --- | --- | --- |
| Frontend stack | React + Vite + TS + Tailwind | Same + Liquid Glass design system + Geist font |
| Stellar integrations | Claimable Balances + Fee Bump only |   • SoroSwap + Soroban contract + Reflector Oracle + Blend APY |
| Testnet USDC | Unspecified | Official Circle testnet issuer `GBBD47...FLA5` |
| UI pages | Listed in prose | Full 6-page spec with component-level detail |
| Recipient flow | 4-state described | Interactive 5-state spec (invalid/claimed/expired + 4 wallet states) |
| Wallet connect | Freighter hardcoded | Stellar Wallets Kit (multi-wallet abstraction) |

# 2. Design System

## 2.1 Foundation

- **Font:** Geist (Google Fonts, weights 300/400/500/600/700)
- **Background (authenticated pages):** `#080808`
- **Background (public pages):** Looping background video — same CDN source across landing + claim page
- **Accent:** `#22c55e` (suku.log green, used for success states only)
- **Primary CTA:** `bg-white text-black rounded-full` — always
- **Secondary CTA:** `liquid-glass text-white rounded-full` — always

## 2.2 Liquid Glass Class

Defined once in `src/index.css`, used across every card, nav, input, button, and badge:

```css
.liquid-glass {
  background: rgba(255,255,255,0.01);
  background-blend-mode: luminosity;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  border: none;
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.1);
  position: relative;
  overflow: hidden;
}

.liquid-glass::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1.4px;
  background: linear-gradient(
    180deg,
    rgba(255,255,255,0.45) 0%,
    rgba(255,255,255,0.15) 20%,
    rgba(255,255,255,0) 40%,
    rgba(255,255,255,0) 60%,
    rgba(255,255,255,0.15) 80%,
    rgba(255,255,255,0.45) 100%
  );
  -webkit-mask: linear-gradient(#fff 0 0) content-box,
                linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}
```

## 2.3 Status Badges

```
draft:    bg-white/10    text-white/50
active:   bg-white/15    text-white
pending:  bg-amber-500/20 text-amber-200
claimed:  bg-green-500/20 text-green-300
expired:  bg-red-500/20   text-red-300
ready:    bg-green-500/20 text-green-200
```

## 2.4 Icons

`lucide-react` only. Key icons per page:

- Brand: `<Zap size={22} strokeWidth={1.5} />`
- Nav: `Menu`, `X`, `ChevronDown`
- Claim page: `Lock`, `CheckCircle`, `ExternalLink`, `Monitor`
- Dashboard: `MoreHorizontal`, `Upload`, `ArrowRight`, `Loader2`

# 3. Page-by-Page Frontend Spec

## 3.1 Landing `/`

**Background:** Full-viewport looping video, `object-cover`, `autoPlay muted loop playsInline`.

**Navbar** (`absolute top-0 left-0 right-0 z-20`):

- Logo: `<Zap />` + `ReRail`
- Nav pill (center, `liquid-glass rounded-xl`): `Home` (active), `How it Works` (dropdown), `Ecosystem`, `For Teams`
- Right CTAs: `Log in` (liquid-glass) + `Begin Now` (bg-white text-black)
- Mobile: hamburger toggle, `liquid-glass` dropdown panel

**Hero** (`absolute bottom-0 left-0 z-20 px-12 pb-16 max-w-2xl`):

- H1: `"Set up a grant. Send a link. Get paid."` — `text-5xl font-medium tracking-tight`
- p: `"Gasless USDC payouts via shareable claim links. No XLM. No wallet friction. Every distribution is on-chain and auditable."`
- Buttons: `"Start distributing"` (primary) + `"See how it works"` (liquid-glass secondary)

## 3.2 Auth `/login`

**Background:** Same video as landing.

**Card** (`absolute inset-0 flex items-center justify-center`):

```
liquid-glass rounded-2xl p-8 max-w-sm
  → Logo (Zap + ReRail, centered)
  → h2: "Start distributing"
  → p:  "Connect your Google account to manage campaigns"
  → Google OAuth button (bg-white text-black rounded-full, full-width)
  → p:  "No credit card required · Testnet only"  (text-white/30 text-xs)
```

## 3.3 Dashboard `/dashboard`

**Background:** `bg-[#080808]`.

**Navbar** (fixed, `liquid-glass border-b border-white/5`):

- Same nav links
- Right: `"New Campaign"` (bg-white text-black) + avatar (liquid-glass rounded-full)

**Stats row** (`grid grid-cols-4 gap-4`):

Each card: `liquid-glass rounded-2xl p-5`

```
Label:  text-white/40 text-xs uppercase tracking-wide
Value:  text-white text-2xl font-medium font-mono
Sub:    text-white/30 text-xs
```

Four cards: Total Distributed · Active Campaigns · Pending Claims · Claimed This Week

**Campaign grid** (`grid grid-cols-3 gap-4 mt-8`):

Each card: `liquid-glass rounded-2xl p-5 hover:bg-white/5 transition-colors cursor-pointer`

```
→ Top row:   name (text-white font-medium) + status badge
→ Progress:  bg-white/10 rounded-full h-1 → inner bg-white
→ Bottom:    "32/50 claimed" · deadline countdown (both text-white/40 text-xs)
```

**Empty state:** `liquid-glass rounded-2xl p-8 text-center` with primary CTA.

## 3.4 Campaign Creation Wizard `/campaigns/new`

**Background:** `bg-[#080808]`. Single centered `liquid-glass rounded-2xl` card, max-width 600px.

**Step indicator:**

```
Active:  w-6 h-6 rounded-full bg-white text-black text-xs font-medium
Done:    w-6 h-6 rounded-full bg-white/20 text-white/60 text-xs  (shows ✓)
Future:  w-6 h-6 rounded-full border border-white/20 text-white/30 text-xs
Line:    flex-1 h-px bg-white/10
```

**Step 1 — Details:**

- Inputs: `liquid-glass rounded-xl px-4 py-3 text-white placeholder-white/30 focus:ring-white/20`
- Labels: `text-white/50 text-xs font-medium uppercase tracking-wide`
- Fields: Campaign name, per-recipient USDC amount, optional deadline toggle → date picker

**Step 2 — Fund:**

```
liquid-glass rounded-xl p-4 flex items-center justify-between
  Left:  "You send" / "240 XLM"   (font-mono)
  Mid:   <ArrowRight text-white/30 />
  Right: "Campaign receives" / "50.00 USDC"  (font-mono)
Rate:  "1 XLM = $0.21 · via SoroSwap"  text-white/30 text-xs text-center
```

Two options: `"Fund with XLM (auto-swap)"` (primary) or `"Fund with USDC directly"` (liquid-glass).

**Step 3 — Upload CSV:**

```
Drop zone: liquid-glass rounded-xl border-dashed border-white/20 p-10
  <Upload text-white/30 size={24} />
  "Drop CSV here or click to upload"
  "name, email, wallet_address"

After upload — preview table:
  thead:     text-white/30 text-xs uppercase, border-b border-white/10
  tbody row: text-white border-b border-white/5
  error row: text-red-300 bg-red-500/5
```

**Step 4 — Review & Create:**

```
Summary rows: flex justify-between py-2.5 border-b border-white/10
  "Recipients"  / "50"  (text-white/40 / text-white font-medium)
  "Total USDC"  / "500.00 USDC"
  "XLM Reserve" / "≈ 55 XLM"
  "Deadline"    / "Jan 31, 2026"

Creation progress (after clicking Create):
  Each step row: liquid-glass rounded-lg px-4 py-3 flex items-center gap-3
    pending:  <Loader2 animate-spin text-white/40 size={14} />
    complete: <CheckCircle text-green-300 size={14} />
    label:    text-white/50 text-sm
```

**Bottom nav:**

```
border-t border-white/10 flex justify-between mt-8 pt-6
  "Back":     liquid-glass rounded-full px-6 py-2.5
  "Continue": bg-white text-black rounded-full px-6 py-2.5
```

## 3.5 Campaign Detail `/campaigns/:id`

**Layout:** Three zones — header, stats row, recipient table.

**Header:**

```
flex items-start justify-between mb-8
  Left:
    h1: text-white text-2xl font-medium  [campaign name]
    row: status badge · text-white/30 "Expires Jan 31"
  Right:
    liquid-glass rounded-full px-4 py-2 flex items-center gap-1.5
    <MoreHorizontal size={14} /> "Options"
```

**Stats (4 cards):**

- `32/50 claimed` + progress bar inside card
- `$900 pending` + `≈ 18 recipients`
- `Blend APY: 4.2%` + `earn ~$3.78 if unclaimed 30d` (read from Blend SDK, no deposit)
- `4 days left` + deadline date

**Filter row:**

```
Filter pills (liquid-glass, active = bg-white/15 text-white):
  "All (50)" · "Pending (18)" · "Claimed (32)" · "Expired (0)"
Right side:
  search input (liquid-glass rounded-full text-sm)
  "Export CSV" (liquid-glass secondary button)
```

**Recipient table** (`liquid-glass rounded-2xl overflow-hidden`):

```
thead: text-white/30 text-xs uppercase tracking-wide, px-5 py-3, border-b border-white/10
tbody rows: border-b border-white/5 hover:bg-white/[0.03] transition-colors
  Name        text-white text-sm
  Amount      font-mono text-white text-sm
  Status      badge
  Claimed at  text-white/30 text-xs
  Action      liquid-glass text-white/50 text-xs px-3 py-1.5 rounded-full "Copy link"
```

## 3.6 Claim Page `/claim/:token` (Public)

**Background:** Same looping video + `bg-black/20` overlay.

**Card** (`absolute inset-0 flex items-center justify-center px-4`):

`liquid-glass rounded-3xl p-7 w-full max-w-sm flex flex-col gap-5`

**URL bar (trust signal):**

`liquid-glass rounded-lg px-3 py-2 flex items-center gap-2`

`<Lock size={11} text-white/40 />` + `rerail.app/claim/8f3a...b9c` (font-mono text-xs text-white/40)

**Amount display (persistent across all states):**

```
text-white text-4xl font-medium font-mono  → "50.00"
text-white/40 text-sm                       → "USDC · ≈ $50.00 via Reflector"
```

**5-state spec:**

| State | Trigger | Badge | UI shown |
| --- | --- | --- | --- |
| Invalid | Token not in DB | — | Error message, no action |
| Already claimed | status = claimed | — | Date + tx hash + explorer link |
| Expired | status = expired | — | Expired message, contact organizer |
| States 1–3 | status = pending, wallet checks | amber/blue | Step list (see below) |
| State 4 | All checks pass | green | Claim button |
| Success | Tx confirmed | green | Amount + tx hash + explorer |

**State 1–3 step list:**

```
ul flex flex-col gap-0
  li: border-b border-white/10 py-2.5 flex items-start gap-3
    num circle: liquid-glass w-5 h-5 rounded-full text-white/50 text-xs
    text:       text-white/60 text-sm
```

Page polls `setInterval(2000)` — auto-advances when wallet state changes.

**State 3 — Enable trustline:**

`"Enable USDC in my wallet"` (bg-white text-black rounded-full)

Hint: `"ReRail pays this network fee — you pay nothing"` (text-white/30 text-xs text-center)

**State 4 — Claim:**

`"Claim 50.00 USDC →"` (bg-white text-black rounded-full w-full)

Hint: `"No XLM required · irreversible"` (text-white/30 text-xs text-center)

**Success:**

```
<CheckCircle text-green-300 mx-auto size={32} />
"50.00 USDC received"  text-white text-lg font-medium text-center
liquid-glass rounded-xl px-4 py-3 font-mono text-white/40 text-xs break-all
  → tx hash
liquid-glass rounded-full flex items-center gap-2 mx-auto
  <ExternalLink size={13} /> "View on Stellar Explorer"
```

**Mobile fallback** (detect `navigator.userAgent`):

```
<Monitor text-white/40 mx-auto size={24} />
"Open on desktop to claim"     text-white text-base font-medium text-center
"Freighter wallet requires a desktop browser"  text-white/40 text-sm text-center
```

# 4. Integration Stack (upgraded)

## 4.1 Stellar Wallets Kit

Replaces hardcoded Freighter. Gives multi-wallet picker modal in one import.

```tsx
import { StellarWalletsKit, WalletNetwork, FREIGHTER_ID } from '@creit.tech/stellar-wallets-kit'

const kit = new StellarWalletsKit({
  network: WalletNetwork.TESTNET,
  selectedWalletId: FREIGHTER_ID,
})
```

Used on: landing nav CTA, dashboard nav, campaign creation Step 2, wizard signing.

## 4.2 SoroSwap (XLM → USDC on funding)

Campaign creation Step 2. Organizer funds in XLM, SoroSwap swaps to testnet USDC before creating claimable balances.

```tsx
// Fetch quote
const quote = await fetch(
  `https://api.soroswap.finance/api/testnet/quote?from=XLM&to=USDC&amount=${xlmAmount}`
)
// Execute swap via Soroswap router contract on Soroban
```

Displays live rate in the wizard quote card. Executes on organizer wallet sign.

## 4.3 Soroban Campaign Registry Contract

A simple Rust/Soroban contract deployed to testnet. Makes campaigns verifiable on-chain — not just rows in a database.

```rust
// Functions
pub fn create_campaign(env: Env, organizer: Address, name: Symbol,
                       amount_per_recipient: i128, deadline: u64) -> u64
pub fn get_campaign(env: Env, campaign_id: u64) -> Campaign
pub fn close_campaign(env: Env, campaign_id: u64)
```

Called at Step 4 of creation wizard — organizer signs. Campaign ID returned and stored in Supabase alongside the DB row.

## 4.4 Reflector Oracle (live prices)

Shows organizer the USD value of their campaign pool in real time.

```tsx
// On dashboard + campaign detail
const price = await reflector.getPrice('USDC') // returns number
const usdValue = poolUSDC * price
```

Displayed in stats cards as `"≈ $X.XX"` beneath the USDC amount.

## 4.5 Blend Protocol (APY display — L5 read-only)

No actual deposits at L5. Reads Blend's current USDC supply APY and shows organizer projected earnings on unclaimed funds.

```tsx
const blendPool = await BlendPoolClient.load(BLEND_USDC_POOL_ID)
const apy = blendPool.supplyAPY // e.g. 0.042 = 4.2%
const projected = pendingUSDC * apy * (daysRemaining / 365)
```

Displayed in Campaign Detail stats card 3: `"Blend APY: 4.2% · earn ~$3.78 if unclaimed 30d"`.

# 5. Testnet USDC — Solved

## 5.1 Official testnet USDC issuer

```tsx
// constants/assets.ts
import { Asset } from '@stellar/stellar-sdk'

export const TESTNET_USDC = new Asset(
  'USDC',
  'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
)
```

This is the de facto standard — 23,000+ trustlines, 1.5M+ transactions on testnet. Used by Stellar Docs, Trustless Work, and the broader ecosystem.

## 5.2 Getting testnet USDC (for organizers during testing)

**Option 1 — Circle faucet (easiest):**

Go to Circle's USDC testnet faucet → select "Stellar" → paste wallet address → receive instantly.

Put this link in dashboard: `"💡 Need testnet USDC? Get it free from Circle's faucet →"`

**Option 2 — Path payment (what SoroSwap does internally):**

XLM (native) → USDC via Stellar testnet DEX path payment. SoroSwap wraps this.

## 5.3 Environment config

```
VITE_USDC_ISSUER=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
VITE_NETWORK=TESTNET
VITE_HORIZON_URL=https://horizon-testnet.stellar.org
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

Mainnet migration = swap four env vars. Zero code changes.

# 6. Recipient Claim Flow — Full 5-State Spec

## 6.1 Pre-state checks (before wallet states)

```
UUID from URL → Supabase lookup
  token not found  → "This link is invalid" (no action)
  status = claimed → "Already claimed on [date] · tx: [hash]" + explorer link
  status = expired → "This link expired on [date]. Contact the organizer."
  status = pending → run wallet state machine
```

## 6.2 Wallet state machine (client-side polling)

```
State 1: window.freighter === undefined
  → Show 3-step install guide
  → Poll every 2s for extension

State 2: freighter.getPublicKey() returns key, Horizon GET /accounts/:key → 404
  → Show 3-step account creation guide
  → Continue polling

State 3: Account exists, GET /accounts/:key → balances has no USDC entry
  → Show "Enable USDC" button
  → POST /api/trustline/execute → fee-bumped changeTrust → recipient signs → re-check

State 4: All pass
  → Show "Claim [X] USDC →" button
  → POST /api/claim/execute {token} → fee-bumped claimClaimableBalance → recipient signs
  → Server: UPDATE recipients SET status='claimed', claimed_at=NOW() (synchronous)
  → Return tx_hash → success screen
```

## 6.3 Mobile detection

```tsx
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
if (isMobile) return <MobileFallback />
```

Shown BEFORE the wallet state machine. No dead end — tells user exactly what to do.

# 7. API Surface

```
POST /api/campaign/create       → insert campaign + recipients into Supabase
POST /api/campaign/sync         → read Horizon effects → write balance IDs to Supabase
POST /api/trustline/execute     → fee-bumped changeTrust (State 3)
POST /api/claim/execute         → fee-bumped claimClaimableBalance (State 4) — ONLY route touching fee-payer key
GET  /api/campaign/:id/stats    → aggregated stats for detail page
```

All other data access is direct Supabase client queries with RLS enforced at DB layer.

**Security on `/api/claim/execute`:**

- Rate limited per claim token
- Token burned on first success → replay structurally impossible
- Fee-payer key only wraps (pays gas) — never originates value transfer
- Status checked synchronously before executing — double-spend impossible

# 8. 30-Day Build Plan

## Week 1 — Foundation (Commits 1–7)

- C1: Vite + React + TS + Tailwind scaffold, liquid-glass CSS, Geist import, deploy to Vercel
- C2: Stellar Wallets Kit integration + wallet connect modal
- C3: Supabase schema (campaigns + recipients + transactions), RLS policies, Google OAuth
- C4: Soroban contract — `create_campaign`, `get_campaign`, `close_campaign` in Rust
- C5: Deploy Soroban contract to testnet, call from frontend
- C6: Horizon API service wrapper (account info, balance queries, effects polling)
- C7: SoroSwap SDK — fetch quote + execute XLM→USDC swap

## Week 2 — Organizer Flow (Commits 8–14)

- C8: Landing page (exact liquid-glass prompt spec)
- C9: Auth page (Google OAuth, video background card)
- C10: Dashboard page (stats row + campaign grid + empty state)
- C11: Campaign creation Step 1 + 2 (details + fund via SoroSwap)
- C12: Campaign creation Step 3 (CSV upload + PapaParse validation)
- C13: Campaign creation Step 4 (batch claimableBalance creation, organizer signs)
- C14: Balance sync — POST /api/campaign/sync → Horizon effects → Supabase balance IDs

## Week 3 — Recipient Claim Flow (Commits 15–21)

- C15: Claim page routing + pre-state checks (invalid/claimed/expired screens)
- C16: State 1 — no Freighter → inline install guide, 2s polling
- C17: State 2 — no account → account creation guide, polling
- C18: State 3 — no trustline → fee-bumped changeTrust → /api/trustline/execute
- C19: /api/claim/execute — rate limit + burn token + fee bump + sync Supabase
- C20: State 4 + success screen — tx hash + Stellar Explorer link
- C21: Mobile detection + fallback screen

## Week 4 — DeFi Layer + Polish (Commits 22–28+)

- C22: Reflector Oracle integration — live prices on dashboard + campaign detail
- C23: Campaign detail page (header + stats + filter row + recipient table)
- C24: Blend APY read-only display in stats card 3
- C25: Reclaim expired balances flow
- C26: Export CSV (recipient report: name, status, claimed_at, tx_hash)
- C27: Google Form embed + feedback collection (L5 requirement)
- C28: **Documented iteration commit** — fix one real UX bug found during user testing
- C29+: 50-user acquisition campaign (Stellar Discord + Rise In + personal network)

# 9. Open Questions / Risks

| Item | Status | Notes |
| --- | --- | --- |
| SoroSwap testnet USDC liquidity | Unknown | May need fallback to Circle faucet if liquidity thin |
| Blend testnet deployment | Needs verification | Confirm BLEND_USDC_POOL_ID for testnet |
| Soroban contract audit | Not required for L5 | Simple registry, low risk |
| Freighter desktop-only | Known | Mobile fallback screen handles this |
| Fee-payer XLM reserve | Monitor | Top up before running 50-user campaign |