# ReRail — API Reference

> Vercel Serverless Functions for gasless payout resolution, account sponsorship, trustline creation, and balance execution on Stellar.

---

## Overview & Base URL

ReRail utilizes Vercel Serverless API functions to execute gasless operations without exposing server secrets (`FEE_PAYER_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) to the client bundle.

| Environment | Base URL |
|---|---|
| Development | `http://localhost:5173/api` |
| Staging | `https://rerail-staging.vercel.app/api` |
| Production | `https://rerail.vercel.app/api` |

---

## Endpoints Summary

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| [`/api/claim/:token/resolve`](#1-get-apiclaimtokenresolve) | `GET` | Public | Resolves claim link metadata & status |
| [`/api/claim/:token/execute`](#2-post-apiclaimtokenexecute) | `POST` | Token | Fee-bumps and submits recipient claim transaction |
| [`/api/trustline/:token/execute`](#3-post-apitrustlinetokenexecute) | `POST` | Token | Fee-bumps recipient `changeTrust` operation |
| [`/api/account/:token/sponsor`](#4-post-apiaccounttokensponsor) | `POST` | Token | Sponsors account creation & USDC trustline for new wallets |
| [`/api/campaign/sync`](#5-post-apicampaignsync) | `POST` | Bearer | Syncs on-chain claimable balance IDs back to recipients |

---

## Detailed Endpoint Specifications

### 1. `GET /api/claim/:token/resolve`

Resolves a claim link token (UUID v4) to recipient & campaign information. This endpoint is **public** and called by the recipient claim page on load.

#### Path Parameters
| Parameter | Type | Required | Description |
|---|---|---|---|
| `token` | `string` | Yes | UUID v4 claim link token |

#### Response `200 OK`
```json
{
  "name": "Alice Chen",
  "amount": "50.00",
  "asset_code": "USDC",
  "token": "68916417-5ea8-4869-9a38-1c9a14771182",
  "status": "pending",
  "campaign_name": "ETH Global Hackathon Grants",
  "deadline": "2026-09-01T00:00:00Z",
  "balance_id": "00000000a39c812...",
  "wallet_address": "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
}
```

#### Response `410 Gone` (Claimed or Expired)
```json
{
  "error": "Already claimed",
  "status": "claimed",
  "amount": "50.00",
  "asset_code": "USDC",
  "campaign_name": "ETH Global Hackathon Grants",
  "claimed_at": "2026-08-05T14:22:00Z",
  "tx_hash": "a1b2c3d4e5f6..."
}
```

---

### 2. `POST /api/claim/:token/execute`

Wraps the recipient's signed `claimClaimableBalance` inner transaction in a Stellar Fee-Bump transaction signed by ReRail's fee payer.

#### Request Body
```json
{
  "signed_inner_tx_xdr": "AAAAAgAAAAB...base64-xdr..."
}
```

#### Response `200 OK`
```json
{
  "success": true,
  "tx_hash": "8f3a91b2c...",
  "hash": "8f3a91b2c..."
}
```

---

### 3. `POST /api/trustline/:token/execute`

Fee-bumps a recipient's USDC `changeTrust` transaction so they can enable USDC receiving without owning XLM.

#### Request Body
```json
{
  "signed_inner_tx_xdr": "AAAAAgAAAAB...base64-xdr..."
}
```

#### Response `200 OK`
```json
{
  "success": true,
  "hash": "c4d3e2f1..."
}
```

---

### 4. `POST /api/account/:token/sponsor`

Two-phase endpoint to activate a brand-new Stellar account and add its USDC trustline with zero XLM required from the recipient.

#### Phase 1: Build Unsigned Sponsorship TX (`POST` with no body)
```json
{
  "unsigned_tx_xdr": "AAAAAgAAAAB...",
  "wallet_address": "GBBD47..."
}
```

#### Phase 2: Co-sign & Submit (`POST` with `signed_tx_xdr`)
```json
{
  "signed_tx_xdr": "AAAAAgAAAAB..."
}
```

---

### 5. `POST /api/campaign/sync`

Syncs on-chain claimable balance IDs from Horizon to database recipients after funding.

#### Query Parameters
- `txHash`: Stellar transaction hash
- `campaignId`: Campaign UUID

#### Headers
- `Authorization: Bearer <supabase_access_token>`

---

## Security & Error Handling

- **Rate Limits:** Enforced per IP address (30/min for resolve, 10/min for execution routes).
- **Atomic Locking:** API routes execute `begin_gasless_op` in PostgreSQL to cap gasless attempts at 5 per operation kind per link.
- **Strict Inner TX Verification:** Verifies inner transactions contain only expected operations (`claimClaimableBalance`, `changeTrust`) targeting the recipient's registered wallet address.
