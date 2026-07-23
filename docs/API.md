# ReRail — API Reference

> Vercel Serverless Functions for claim resolution and execution.

---

## Base URL

| Environment | URL |
|---|---|
| Development | `http://localhost:5173/api` |
| Staging | `https://rerail-staging.vercel.app/api` |
| Production | `https://rerail.vercel.app/api` |

---

## Endpoints

### `GET /api/claim/:token/resolve`

Resolves a claim link token to recipient information. This endpoint is **public** — no authentication required.

#### Parameters

| Parameter | Type | Location | Required | Description |
|---|---|---|---|---|
| `token` | `string` | URL path | Yes | UUID v4 claim link token |

#### Response `200 OK`

```json
{
  "recipient_name": "Alice Chen",
  "amount": "50.0000000",
  "token": "USDC",
  "status": "pending",
  "campaign_name": "Hackathon 2026 Prizes",
  "deadline": "2026-08-01T00:00:00Z",
  "balance_id": "00000000abc123..."
}
```

#### Response `404 Not Found`

```json
{
  "error": "Claim link not found"
}
```

#### Response `410 Gone`

Returned when the claim has already been processed.

```json
{
  "error": "This claim has already been processed",
  "status": "claimed"
}
```

#### Rate Limit

30 requests per minute per IP address.

---

### `POST /api/claim/:token/execute`

Executes a gasless claim by wrapping the recipient's signed inner transaction in a fee bump transaction and submitting it to the Stellar network.

#### Parameters

| Parameter | Type | Location | Required | Description |
|---|---|---|---|---|
| `token` | `string` | URL path | Yes | UUID v4 claim link token |

#### Request Body

```json
{
  "signed_inner_tx_xdr": "AAAAAgAAAAB...base64-encoded-XDR..."
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `signed_inner_tx_xdr` | `string` | Yes | Base64-encoded XDR of the inner transaction, signed by the recipient via Freighter |

#### Response `200 OK`

```json
{
  "success": true,
  "tx_hash": "abc123def456...",
  "stellar_explorer_url": "https://stellar.expert/explorer/testnet/tx/abc123def456..."
}
```

#### Response `400 Bad Request`

```json
{
  "error": "Missing signed_inner_tx_xdr in request body"
}
```

#### Response `404 Not Found`

```json
{
  "error": "Claim link not found"
}
```

#### Response `409 Conflict`

```json
{
  "error": "This claim has already been processed",
  "status": "claimed"
}
```

#### Response `500 Internal Server Error`

```json
{
  "error": "Transaction submission failed",
  "details": "op_does_not_exist"
}
```

#### Rate Limit

10 requests per minute per IP address.

---

## Error Codes

| HTTP Status | Error | Description |
|---|---|---|
| `400` | `bad_request` | Missing or malformed request body |
| `404` | `not_found` | Claim token doesn't match any recipient |
| `405` | `method_not_allowed` | Wrong HTTP method |
| `409` | `conflict` | Claim already processed (claimed or expired) |
| `410` | `gone` | Claim expired and no longer available |
| `429` | `rate_limited` | Too many requests |
| `500` | `server_error` | Internal error (Stellar network, database, etc.) |

---

## Security Notes

1. The `resolve` endpoint returns **non-sensitive** information only (name, amount, status)
2. The `execute` endpoint validates the inner transaction before wrapping:
   - Must contain exactly one `claimClaimableBalance` operation
   - The balance ID must match the recipient's stored balance
   - The recipient must have status `pending`
3. The fee payer secret is **never** exposed in responses or logs
4. All endpoints enforce CORS headers via `vercel.json`
