# ReRail — Stellar Integration Guide

> Deep dive into Stellar native Claimable Balances, Fee-Bump Envelopes, Account Sponsorship, and Stellar Wallets Kit.

---

## Native Stellar Protocol Primitives

ReRail relies directly on first-class Stellar protocol primitives introduced in Protocol 13 (Fee Bumps), Protocol 15 (Claimable Balances), and Protocol 19 (Sponsorship).

| Primitive | Operation Type | ReRail Function |
|---|---|---|
| **Claimable Balance** | `createClaimableBalance` / `claimClaimableBalance` | Lock funds per recipient on-chain with time predicates |
| **Fee-Bump Envelope** | `FeeBumpTransaction` | Wrap recipient's transaction so ReRail pays network gas |
| **Account Sponsorship** | `beginSponsoringFutureReserves` / `createAccount` | Sponsor 1.5 XLM reserve requirements for unfunded wallets |

---

## 1. Claimable Balances & Predicates

### Creation
When an organizer funds a campaign, ReRail creates one claimable balance per recipient:

```typescript
Operation.createClaimableBalance({
  asset: USDC_ASSET,
  amount: recipientAmount,
  claimants: [
    // Recipient: allowed to claim before campaign deadline
    new Claimant(
      recipientAddress,
      Claimant.predicateBeforeRelativeTime(deadlineSeconds.toString())
    ),
    // Organizer: allowed to reclaim after deadline
    new Claimant(
      organizerAddress,
      Claimant.predicateNot(
        Claimant.predicateBeforeRelativeTime(deadlineSeconds.toString())
      )
    ),
  ],
});
```

### Protocol Mechanics
- Funds are transferred from organizer treasury into an on-chain Claimable Balance entry.
- The entry stores a unique 32-byte hex ID (`balance_id`).
- Recipient can execute `Operation.claimClaimableBalance({ balanceId })` anytime before the deadline.

---

## 2. Fee-Bump Transaction Envelopes

To prevent recipients from needing XLM gas:

```
┌───────────────────────────────────────────────┐
│ Fee Bump Transaction (Outer)                  │
│ Fee Source: ReRail Fee Payer Account           │
│ Max Fee: 1,000 stroops (0.0001 XLM)            │
│ Signature: Fee Payer Private Key              │
│                                               │
│   ┌───────────────────────────────────────┐   │
│   │ Inner Transaction                     │   │
│   │ Source Account: Recipient Wallet      │   │
│   │ Operation: claimClaimableBalance      │   │
│   │ Signature: Recipient Wallet (Freighter)│  │
│   └───────────────────────────────────────┘   │
└───────────────────────────────────────────────┘
```

1. Recipient wallet signs the inner transaction XDR locally.
2. Serverless endpoint `/api/claim/:token/execute` verifies the inner transaction.
3. Server wraps the inner transaction in `TransactionBuilder.buildFeeBumpTransaction(...)`.
4. Fee Payer signs outer envelope and submits to Stellar Horizon RPC.

---

## 3. Account & Trustline Sponsorship

For new recipients without active accounts or USDC trustlines:

```typescript
const sponsorOps = [
  Operation.beginSponsoringFutureReserves({
    sponsoredId: recipientWallet,
    source: feePayerPublicKey,
  }),
  Operation.createAccount({
    destination: recipientWallet,
    startingBalance: '0',
    source: feePayerPublicKey,
  }),
  Operation.changeTrust({
    asset: USDC_ASSET,
    source: recipientWallet,
  }),
  Operation.endSponsoringFutureReserves({
    source: recipientWallet,
  }),
];
```

Both the fee-payer and recipient sign this atomic multi-operation transaction, activating the account and trustline with **0 XLM spent by the recipient**.

---

## 4. Multi-Wallet Integration via Stellar Wallets Kit

ReRail uses `@creit.tech/stellar-wallets-kit` for wallet abstraction:
- Supported Wallets: Freighter, Albedo, Hana, xBull, Lobstr, Rabet.
- Session storage & wallet readiness checks integrated into `wallet.store.ts`.
