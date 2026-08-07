# ReRail — Product Requirements Document (PRD)

> **Status:** Active Specification | **Level:** L5 → L6 Production Scale | **Last Updated:** August 2026

---

## 1. Executive Summary

ReRail is gasless payout infrastructure built on Stellar that enables organizations to distribute USDC rewards, hackathon prizes, scholarships, and community grants through secure, shareable claim links.

Recipients claim funds without holding XLM (via Stellar native Fee-Bump transactions and Claimable Balances). Organizers manage campaigns through a liquid-glass dashboard. Every distribution is transparent, auditable, and instant on-chain.

**One-line pitch:** "Set up a grant. Send a link. Get paid — no XLM or prior wallet friction required."

---

## 2. Design System & Aesthetics

ReRail adopts a high-end, dark, liquid-glass aesthetic built with Vanilla CSS utilities and Tailwind.

- **Typography:** `Geist` (Google Font)
- **Glassmorphism:** `.liquid-glass` token (backdrop blur `blur(4px)`, subtle inner shadow, gradient border mask)
- **Backgrounds:**
  - **Public Pages (Landing & Claim):** High-impact ambient background video (`/lv_0_20260723125159.mp4`) with a dark contrast overlay (`bg-black/25`).
  - **Authenticated Pages (Dashboard, Wizard, Detail, Settings):** Deep obsidian background (`bg-[#080808]`).
- **Button Standards:**
  - **Primary CTA:** `bg-white text-black font-medium px-6 py-3 rounded-full hover:bg-white/90 transition-colors`
  - **Secondary CTA:** `liquid-glass text-white font-medium px-6 py-3 rounded-full hover:bg-white/5 transition-colors`
- **Branding Icon:** `<Zap size={22} strokeWidth={1.5} />` paired with `<span>ReRail</span>`.

---

## 3. Core Page Specifications

### Page 1 — Landing (`/`)
- **Header/Nav:** Brand (`Zap` + `ReRail`), navigation links: *Home (active)*, *How it Works (dropdown)*, *Ecosystem*, *For Teams*.
- **Hero:**
  - H1: *"Set up a grant. Send a link. Get paid."*
  - Subhead: *"Gasless USDC payouts via shareable claim links. No XLM. No wallet friction. Every distribution is on-chain and auditable."*
  - Actions: `"Start distributing"` (Primary CTA) & `"See how it works"` (Secondary CTA).
- **Background:** Full-screen looping video background (`lv_0_20260723125159.mp4`).
- **Sections:** Trust / Stat Band, Features Grid, 3-Step Process, Final Call to Action, and Footer.

### Page 2 — Auth (`/login`)
- **Layout:** Full-screen video background, no top navbar or sidebar.
- **Card:** Centered `.liquid-glass` card (`rounded-2xl p-8 max-w-sm`).
  - Logo: Centered `<Zap /> ReRail`.
  - Title: *"Start distributing"*
  - Subtitle: *"Connect your Google account to manage campaigns"*
  - Action: `"Continue with Google"` button using Supabase OAuth.
  - Subtext: *"No credit card required · Testnet only"*.

### Page 3 — Dashboard (`/dashboard`)
- **Layout:** `bg-[#080808]`, fixed top navbar with full-width `.liquid-glass` styling (`fixed top-0 left-0 right-0 z-20 liquid-glass border-b border-white/5`).
- **Navbar:** Nav links on left, `"New Campaign"` primary button + User profile / logout on right.
- **Stats Row:** 4 Grid cards displaying:
  1. *Total Distributed* (`$12,400`)
  2. *Active Claim Links* (`18`)
  3. *Claim Rate* (`64%`)
  4. *Total Recipients* (`50`)
- **Campaign Grid:** 3-column grid of campaign cards showing progress bars, claimed counts, deadline countdowns, and status badges (`pending`, `active`, `claimed`, `expired`).
- **Empty State:** Clean liquid-glass prompt when no campaigns exist.

### Page 4 — Campaign Creation Wizard (`/campaigns/new`)
- **Layout:** `bg-[#080808]` with fixed liquid-glass navbar.
- **Container:** Centered liquid-glass card containing a 4-step wizard.
- **Steps:**
  1. **Details:** Campaign Name, Default Amount (USDC), Expiry.
  2. **Fund:** Swap / Funding preview card (*"You send 240 XLM" → "Campaign receives 50.00 USDC"*).
  3. **Upload CSV:** Drag-and-drop CSV parser with real-time validation and preview table.
  4. **Review & Confirm:** Summary list and batch transaction generation progress.

### Page 5 — Campaign Detail (`/campaigns/:id`)
- **Layout:** `bg-[#080808]`, fixed navbar.
- **Header:** Campaign Title, Status Badge, Expiration Date, Options Menu (`MoreHorizontal`).
- **Stats Row:** 4 Cards (Claim Progress + Bar, Pending Amount, Yield/Apy Metric, Time Remaining).
- **Filter Row:** Filter pills (`All`, `Pending`, `Claimed`, `Expired`), Search input, Export CSV button.
- **Recipient Table:** Name, Amount, Status Badge, Timestamp, Copy Link button.

### Page 6 — Claim Page (`/claim/:token`)
- **Layout:** Public page with full-screen video background (`lv_0_20260723125159.mp4`) and dark overlay.
- **Card:** Centered liquid-glass card (`rounded-3xl p-7 max-w-sm`).
- **Features:**
  - Trust URL bar: `<Lock size={11} /> rerail.app/claim/8f3a...b9c`
  - Dynamic status pills (`pending`, `trustline`, `ready`, `claimed`, `expired`)
  - Amount display (`50.00 USDC`)
  - Step progression checklist (1-3)
  - Claim button (`Claim 50.00 USDC →`) executing gasless Fee-Bump transaction via Freighter.
  - Success state with transaction hash and Stellar Explorer verification link.
  - Mobile desktop requirement prompt fallback.

---

## 4. Technical Architecture & Stellar Primitives

- **Frontend:** React 19, TypeScript, Vite 8, TailwindCSS v4, Lucide React icons.
- **State Management:** Zustand (`auth.store.ts`, `campaign.store.ts`, `wallet.store.ts`).
- **Database & Auth:** Supabase (Google OAuth + Postgres database with indexed RLS).
- **Stellar Network Integration:**
  - **Horizon Client:** `@stellar/stellar-sdk` connecting to Testnet.
  - **Claimable Balances:** `Operation.createClaimableBalance` with relative time predicates (`Claimant.predicateBeforeRelativeTime`).
  - **Gasless Fee Sponsorship:** Serverless Vercel function (`api/claim/[token]/execute.ts`) wrapping user transactions in `TransactionBuilder.buildFeeBumpTransaction` signed by the fee payer account.
  - **Freighter Wallet:** `@stellar/freighter-api` for in-browser signing without native gas expenditure.

---

## 5. Success Metrics & Non-Functional Requirements

- **Performance:** Sub-1s page load times, optimized bundle (< 250kB gzipped initial chunk).
- **Security:** CSV injection sanitization, token UUID v4 validation, service role key restricted to serverless API functions.
- **Accessibility:** High contrast ratios on dark surfaces, standard ARIA landmarks, keyboard-navigable interactive elements.
