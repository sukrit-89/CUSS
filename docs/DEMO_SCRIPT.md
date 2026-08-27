# ReRail — Demo & Walkthrough Script

**Estimated length:** 3 to 5 minutes  
**Goal:** Showcase the complete end-to-end flow of ReRail, emphasizing the gasless recipient experience and the enterprise-grade organizer tooling.

---

## 1. Introduction & The Problem (0:00 - 0:45)
*(Visual: Start on the ReRail Hero/Landing Page)*

**Speaker:**  
"Hi, welcome to ReRail. Today, I'm going to show you how we're solving one of the biggest points of friction in Web3: **distributing grants and payouts.** 

Normally, if a DAO or a hackathon wants to send USDC to 50 people, every single recipient needs to already have a wallet, and they need to hold native tokens—like XLM—just to open a trustline and pay for gas. If they are new to Web3, they are completely stuck.

ReRail fixes this. We are a **gasless USDC payout platform built on Stellar**. Organizers set up a grant, send a link, and recipients get paid—with zero XLM required. Let me show you how it works."

---

## 2. The Organizer Flow (0:45 - 2:00)
*(Visual: Click 'Launch App'. Connect Freighter Wallet. Go to the 'New Payout' Dashboard.)*

**Speaker:**  
"I'm logged in as an Organizer. Let's create a new payout campaign—say, for our 'Q3 Hackathon Winners'. 

I can add recipients manually or upload a CSV for bulk distributions. Let's add a couple of addresses. *(Type or paste a test address)*. 

Because ReRail integrates with DeFi protocols, you'll see some smart insights here: 
1. **SoroSwap integration** shows me exactly what my XLM is worth in USDC for funding.
2. **Blend Protocol integration** projects the yield I could be earning if these funds sit unclaimed for too long.

Once I review the batch, I click **Fund & Create**. 

Behind the scenes, ReRail is using native **Stellar Claimable Balances** with a time-based reclaim predicate. I sign exactly one transaction to lock the USDC on-chain. Notice that ReRail never custodies my private keys or my funds."

*(Visual: Transaction approves. The Dashboard shows the Active Campaign with Claim Links.)*

"The campaign is live. I now have unique, secure claim links to send to my winners via email or Discord. Let's copy one of these links."

---

## 3. The Recipient Flow — The 'Aha!' Moment (2:00 - 3:30)
*(Visual: Open a new Incognito Window. Paste the Claim Link. Have a brand new, unfunded Freighter wallet ready.)*

**Speaker:**  
"Now, let's switch roles. I'm a recipient who just got a claim link in my email. 

I open the link, and I see a beautiful, liquid-glass interface showing my pending claim for 100 USDC. 

I connect my Freighter wallet. **Here is the magic:** this is a brand new wallet. It has 0 XLM. It doesn't even exist on the ledger yet. 

When I click **Claim**, ReRail's serverless backend springs into action. 
1. First, it **sponsors my account creation** and the 1.5 XLM reserve.
2. Then, it **opens a USDC trustline** for me.
3. Finally, I sign the claim transaction, but I don't pay gas. ReRail wraps it in a Stellar **Fee-Bump Envelope** and pays the fee for me.

Boom. The claim is successful. I just received 100 USDC, and I didn't have to buy a single drop of XLM or jump through KYC hoops at an exchange to get gas money."

---

## 4. Under the Hood & Security (3:30 - 4:15)
*(Visual: Briefly show the Supabase dashboard or the GitHub architecture diagram)*

**Speaker:**  
"How do we do this securely? 

ReRail uses an enterprise-grade stack. The backend runs on Vercel Serverless Functions with a Supabase PostgreSQL database. 

- **No Link Leaks:** All claim tokens are hashed with SHA-256 at rest. If the database leaks, the links are safe.
- **Concurrency Protection:** Our endpoints use atomic database-level row locks. It is impossible to double-claim a link, even under a race-condition attack.
- **On-Chain Auditing:** We also deploy an optional Soroban smart contract—`rerail_registry`—that mirrors the campaign lifecycle on-chain, proving exactly who claimed what, and when."

---

## 5. Conclusion (4:15 - 4:30)
*(Visual: Back to the ReRail Dashboard showing the recipient marked as 'Claimed')*

**Speaker:**  
"ReRail makes Web3 grants as easy as sending a Stripe link. No gas, no onboarding friction, fully non-custodial. 

Thanks for watching our demo. Check out our GitHub for the full source code and documentation."
