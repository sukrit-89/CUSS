# ReRail — Stellar Integration Guide

> Deep dive into Claimable Balances, Fee Bump Transactions, and Sponsored Accounts.

---

## Table of Contents

- [Overview](#overview)
- [Claimable Balance Lifecycle](#claimable-balance-lifecycle)
- [Fee Bump Transaction Mechanics](#fee-bump-transaction-mechanics)
- [Batch Transaction Strategy](#batch-transaction-strategy)
- [Sponsored Account Creation (L6)](#sponsored-account-creation-l6)
- [Error Handling](#error-handling)
- [Testing on Testnet](#testing-on-testnet)

---

## Overview

ReRail uses two first-class Stellar protocol primitives — no smart contracts required:

| Primitive | Purpose in ReRail |
|---|---|
| **Claimable Balance** | Lock USDC per recipient with time-gated access |
| **Fee Bump Transaction** | Wrap recipient's claim TX so they pay zero gas |

These are not Soroban simulations. They are native protocol operations, battle-tested since Protocol 15 (claimable balances) and Protocol 13 (fee bumps).

---

## Claimable Balance Lifecycle

### 1. Creation (Organiser Action)

When an organiser activates a campaign, ReRail creates one claimable balance per recipient:

```typescript
Operation.createClaimableBalance({
  asset: USDC_ASSET,     // USDC on testnet/mainnet
  amount: '50.0000000',  // 7 decimal places (Stellar convention)
  claimants: [
    // Recipient: can claim BEFORE deadline
    new Claimant(
      recipientPublicKey,
      Claimant.predicateBeforeRelativeTime(deadlineSeconds.toString())
    ),
    // Organiser: can reclaim AFTER deadline
    new Claimant(
      organizerPublicKey,
      Claimant.predicateNot(
        Claimant.predicateBeforeRelativeTime(deadlineSeconds.toString())
      )
    ),
  ],
})
```

**What happens on-chain:**
- The USDC is debited from the organiser's account
- A claimable balance entry is created on the ledger
- The balance is assigned a unique `balanceId` (returned in the transaction result)
- The organiser's minimum balance requirement increases by 1 base reserve

### 2. Claiming (Recipient Action)

The recipient claims their balance with a single operation:

```typescript
Operation.claimClaimableBalance({ balanceId })
```

**What happens on-chain:**
- The USDC is credited to the recipient's account
- The claimable balance entry is removed from the ledger
- The organiser's reserve requirement decreases

### 3. Reclaiming (Organiser Action — After Deadline)

If the deadline passes and the recipient hasn't claimed:

```typescript
// Same operation, but the organiser is the claimant
Operation.claimClaimableBalance({ balanceId })
```

The time predicate now allows the organiser to claim. The USDC returns to the organiser.

### Balance ID Extraction

After creating a claimable balance, the balance ID is extracted from the transaction result:

```typescript
const result = await server.submitTransaction(tx);
const ops = result.result_xdr; // Contains the balance ID
// Alternative: query Horizon for claimable balances by sponsor/claimant
```

For ReRail, we query Horizon after transaction submission to get the balance IDs associated with the claimant addresses.

---

## Fee Bump Transaction Mechanics

### The Problem

To claim a claimable balance, the recipient needs to submit a transaction. But submitting a transaction requires XLM for the network fee. New users don't have XLM.

### The Solution

A **Fee Bump Transaction** wraps the recipient's signed transaction with a different fee source:

```
┌─────────────────────────────────────┐
│ Fee Bump Transaction (Outer)        │
│ Fee Source: ReRail Fee Payer        │
│ Fee: 1000 stroops                   │
│ Signature: Fee Payer key            │
│                                     │
│   ┌─────────────────────────────┐   │
│   │ Inner Transaction           │   │
│   │ Source: Recipient            │   │
│   │ Op: claimClaimableBalance    │   │
│   │ Fee: 100 stroops (ignored)   │   │
│   │ Signature: Recipient key     │   │
│   └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

### Flow

1. **Frontend** builds the inner transaction (source = recipient, op = claimClaimableBalance)
2. **Freighter** signs it with the recipient's key
3. **Frontend** sends the signed XDR to `/api/claim/:token/execute`
4. **Server** wraps it in a fee bump (fee source = fee payer)
5. **Server** signs the outer envelope with the fee payer key
6. **Server** submits the complete fee bump transaction to Horizon

### Key Properties

- The inner transaction fee is **irrelevant** — the outer fee is what gets charged
- The recipient account doesn't need any XLM balance
- The fee payer only needs to hold enough XLM for fees (~0.01 XLM per bump)
- The fee payer never touches the USDC or the claimable balance

---

## Batch Transaction Strategy

### Limits

- Stellar allows **up to 100 operations per transaction**
- Each `createClaimableBalance` is one operation
- For campaigns with > 100 recipients, we split into multiple transactions

### Implementation

```typescript
function buildBatchClaimableBalances(recipients, ...): Transaction[] {
  const batches = chunk(recipients, MAX_OPS_PER_TX); // 100 per batch
  return batches.map(batch => {
    const builder = new TransactionBuilder(organizerAccount, { ... });
    batch.forEach(r => builder.addOperation(
      Operation.createClaimableBalance({ ... })
    ));
    return builder.build();
  });
}
```

### Sequence Numbers

Each batch transaction needs a unique sequence number. Since they're submitted sequentially by the organiser (signed via Freighter one at a time), the sequence numbers auto-increment.

### Error Recovery

If a batch transaction fails mid-way:
1. Check which balances were created (query Horizon by claimant)
2. Resume from the first uncreated recipient
3. The organiser can retry the activation for remaining recipients

---

## Sponsored Account Creation (L6)

For recipients who don't have a Stellar account at all, ReRail can sponsor account creation:

```typescript
const ops = [
  // 1. Platform begins sponsoring reserves
  Operation.beginSponsoringFutureReserves({
    sponsoredId: newAccountPublicKey,
  }),
  // 2. Create the account with 0 starting balance
  Operation.createAccount({
    destination: newAccountPublicKey,
    startingBalance: '0',
  }),
  // 3. Add USDC trustline (source: new account, sponsored by platform)
  Operation.changeTrust({
    asset: USDC_ASSET,
    source: newAccountPublicKey,
  }),
  // 4. End sponsorship (source: new account agrees to be sponsored)
  Operation.endSponsoringFutureReserves({
    source: newAccountPublicKey,
  }),
];
```

**Requirements:**
- Both the sponsor and the new account must sign the transaction
- The sponsor pays all reserve requirements (~1 XLM per account + 0.5 XLM per trustline)
- After creation, the recipient can immediately receive USDC via claimable balance

---

## Error Handling

### Common Errors

| Error | Cause | Response |
|---|---|---|
| `op_does_not_exist` | Balance already claimed or doesn't exist | Return "already claimed" |
| `op_not_authorized` | Recipient not a valid claimant | Return "not authorized" |
| `op_line_full` | Recipient's USDC trustline at max | Prompt to increase limit |
| `op_no_trust` | Recipient has no USDC trustline | Prompt to add trustline |
| `tx_bad_seq` | Stale sequence number | Reload account + retry |
| `tx_too_late` | Transaction timeout expired | Rebuild + resubmit |
| `FEE_BUMP_INNER_FAILED` | Inner TX invalid | Check inner error codes |

### Retry Strategy

1. **Transient errors** (bad_seq, too_late): Retry up to 3 times with exponential backoff
2. **Permanent errors** (op_does_not_exist, op_not_authorized): Don't retry, return clear error
3. **Fee payer errors**: Alert monitoring, don't expose to user

---

## Testing on Testnet

### Setup

```bash
# 1. Generate and fund testnet accounts
npx tsx scripts/generate-testnet-accounts.ts

# 2. Set up USDC trustlines
npx tsx scripts/setup-usdc-trustline.ts

# 3. Run E2E claim flow test
npx tsx scripts/test-claim-flow.ts
```

### Verification Tools

- **Stellar Laboratory**: https://laboratory.stellar.org/ — Build and submit test transactions
- **StellarExpert (Testnet)**: https://stellar.expert/explorer/testnet — Browse accounts, transactions, balances
- **Horizon API**: `GET /claimable_balances?claimant={pubkey}` — Query pending balances

### Test Scenarios

1. **Happy path**: Create balance → Claim → Verify USDC received
2. **Expired claim**: Create balance with 60s deadline → Wait → Organiser reclaims
3. **Double claim**: Claim balance → Try claiming again → Verify rejection
4. **No trustline**: Recipient without USDC trustline → Verify clear error
5. **Batch creation**: Create 150 recipients → Verify split into 2 transactions
