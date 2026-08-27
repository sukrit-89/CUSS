# 🎬 ReRail — Product Demo Video Script
> **Format:** Live-Action Screen Recording + Voiceover & Camera PiP  
> **Target Duration:** ~3:30 – 4:00 minutes  
> **Vibe / Tone:** Modern, confident, punchy, fast-paced (think Linear or Stripe product launches).  
> **Key Message:** *"Set up a grant. Send a link. Get paid in USDC — zero gas, zero wallet funding required."*

---

## 📋 Pre-Recording Setup Checklist
- [ ] **Browser Window 1 (Organizer):** Chrome with Freighter Wallet connected (holds testnet USDC & XLM). Logged in to ReRail Dashboard (`/dashboard`).
- [ ] **Browser Window 2 (Recipient):** Clean Incognito Window with a *fresh/unfunded* Freighter wallet (0 XLM, 0 USDC).
- [ ] **Sample CSV ready:** `hackathon_winners.csv` (2–3 recipient rows).
- [ ] **Audio/Visual:** Upbeat, subtle tech/ambient background music (lowered during speech), smooth cursor transitions, 1080p/4K 60fps recording.

---

## ⏱️ Timeline & Shot Breakdown

```
[0:00 - 0:30]  ⚡ THE HOOK: The Web3 Onboarding Nightmare
[0:30 - 0:55]  💡 THE REVEAL: Introducing ReRail
[0:55 - 1:55]  🚀 ACT I: The Organizer Experience (Campaign in 60s)
[1:55 - 2:55]  ✨ ACT II: The 'Aha!' Moment (Gasless Recipient Claim)
[2:55 - 3:35]  🛡️ ACT III: Architecture & Stellar Magic
[3:35 - 4:00]  🎯 OUTRO: The Vision & Call To Action
```

---

## 🎬 Full Script & Screenplay

### [0:00 - 0:30] ⚡ The Hook: The Onboarding Nightmare
**Visual:** 
- Fullscreen camera / clean animated title card. 
- Cut to screen recording showing a confusing multi-step crypto flow (error popups: *"Insufficient XLM for trustline reserve"*, exchange KYC forms, gas fee calculator).

**Audio / SFX:** Upbeat, modern synth intro starts. Fast-paced delivery.

**Speaker:**
> *"Imagine you just won a hackathon, earned an open-source bounty, or received a scholarship. The organizer sends you 500 USDC on-chain."*
> 
> *"Sounds great, right? Until you try to claim it."*
> 
> *"Suddenly, you’re told: you can’t receive USDC until you buy XLM. You can't buy XLM without signing up for an exchange and waiting 3 days for KYC. And you can't pay network fees without holding native gas."*
> 
> *"90% of non-crypto natives drop out right here. Web3 payouts are broken."*

---

### [0:30 - 0:55] 💡 The Reveal: Introducing ReRail
**Visual:** 
- Quick swoosh SFX. Transition to ReRail Hero Page (`rerail.vercel.app`).
- Smooth scroll through the minimalist UI, highlighted value tags: **"Gasless Payouts"**, **"Instant Claim Links"**, **"Stellar Native"**.

**Speaker:**
> *"Meet **ReRail** — the gasless payout infrastructure built on Stellar."*
> 
> *"ReRail turns complex batch distributions into a single shareable link. Organizers create campaigns in 60 seconds, and recipients claim real USDC directly to their wallets with **zero XLM, zero gas fees, and zero friction**."*
> 
> *"Let’s see it in action."*

---

### [0:55 - 1:55] 🚀 Act I: The Organizer Experience
**Visual:**
- Click **"Launch App"** or **"Connect Wallet"**.
- Navigate to **"Create Campaign"**.
- Drag and drop `hackathon_winners.csv`. Show the instant client-side validation table.
- Set deadline (e.g., 30 Days).
- Click **"Create & Lock Funds"** -> Freighter popup triggers -> 1-click signature.
- Redirect to Campaign Detail view showing generated claim links & dynamic statistics.

**Speaker:**
> *"I'm logged in as an event organizer. We just wrapped up our global hackathon, and we need to distribute prizes to our top teams."*
> 
> *(Dragging CSV onto screen)*
> *"I drop in our winners CSV. ReRail immediately parses, validates every address, and protects against CSV injection."*
> 
> *"I set the total prize pool and an optional 30-day reclaim deadline."*
> 
> *(Clicking 'Create & Lock Funds')*
> *"Now, watch this: With a single Freighter signature, ReRail leverages Stellar's native **Claimable Balances**. The USDC is locked trustlessly on-chain. Notice that ReRail **never takes custody** of my private keys or funds."*
> 
> *(Showing links table)*
> *"Done. Our campaign is live. Each winner gets a unique, high-entropy claim link that I can drop into an email or Discord DM."*

---

### [1:55 - 2:55] ✨ Act II: The 'Aha!' Moment (Recipient Claim)
**Visual:**
- Cut to **Incognito Window**. Paste the claim link (`/claim/[token]`).
- Screen reveals the claim page: *"You've received 250 USDC for Hackathon Prize!"*.
- Open Freighter extension in top corner to show: **Balance: 0.00 XLM / Account Unfunded**.
- Click **"Connect Wallet"** -> Click **"Claim USDC Gaslessly"**.
- Progress states animate smoothly: *[Sponsoring Account...] -> [Setting Trustline...] -> [Submitting Fee-Bump...]*
- Success confetti / checkmark explosion -> Display Transaction Hash on StellarExpert with 250 USDC added.

**Audio / SFX:** Satisfying chime / whoosh upon successful claim confirmation.

**Speaker:**
> *"Now, let's step into the recipient's shoes."*
> 
> *"I just opened my claim link. I see exactly what I'm getting: 250 USDC from the Hackathon campaign."*
> 
> *"I connect my wallet. And look closely at my Freighter balance: **0.00 XLM**. This account is completely empty."*
> 
> *(Clicking 'Claim')*
> *"I hit Claim. Watch what happens behind the scenes in under 4 seconds:"*
> 
> *1. ReRail’s serverless backend sponsors the account reserve.*  
> *2. It establishes the USDC trustline automatically.*  
> *3. It wraps my claim in a Stellar **Fee-Bump Transaction**, covering 100% of network fees.*
> 
> *"And boom! Confirmed on ledger. I just received 250 USDC without ever touching an exchange or spending a single penny on gas. That is the magic of ReRail."*

---

### [2:55 - 3:35] 🛡️ Act III: Architecture & Stellar Superpowers
**Visual:**
- Quick cut to the clean Architecture Diagram / Security docs from GitHub or slides.
- Highlight key Stellar protocol primitives (Claimable Balances, Fee-Bumps, Time Predicates).

**Speaker:**
> *"Why did we build this on Stellar instead of traditional smart contracts?"*
> 
> *"Because Stellar gives us protocol-level superpowers:"*
> 
> - **Claimable Balances with Time Predicates:** *If a recipient fails to claim within 30 days, the organizer can reclaim unspent funds with a single click. No funds are ever lost in the void.*
> - **Fee-Bump Transactions:** *True gasless execution without complex meta-transaction relayer contracts.*
> - **Enterprise Security:** *UUID-v4 entropy, Row-Level Security on PostgreSQL, and zero custodial risk.*

---

### [3:35 - 4:00] 🎯 Outro: The Vision & Call to Action
**Visual:**
- Return to live app dashboard showing the real-time status update: *Recipient marked as 'Claimed'*.
- Display closing slide with GitHub URL, Live Demo link, and Stellar Rise In Belt badge.

**Speaker:**
> *"ReRail is building the payout rail that Web3 has always deserved. From DAOs and bounties to global enterprise payroll — simple, auditable, and truly frictionless."*
> 
> *"Experience the live demo on Stellar Testnet today at **rerail.vercel.app**, and check out our open-source codebase on GitHub."*
> 
> *"Thank you for watching!"*

---

## 💡 Pro Presenter Tips
1. **Pacing:** Keep energy high and conversational. Don't linger on loading screens — edit cuts tightly around ledger confirmation times.
2. **Zoom & Focus:** Zoom in 150% on the Freighter wallet balance showing `0 XLM` right before claiming to emphasize the gasless capability.
3. **Soundtrack:** Use royalty-free lofi-tech or ambient electro beats at 15% volume under the voiceover.
