# ReRail — Security Model

> Threat model, key management, atomic rate limiting, and security controls.

---

## Threat Model & Mitigations

### T1: Organizer Reclaims Funds Before Deadline
- **Threat**: Organizer attempts to reclaim recipient's funds before the campaign deadline.
- **Mitigation**: Protocol-level enforcement. Claimable balance predicates use `Claimant.predicateNot(Claimant.predicateBeforeRelativeTime(deadline))` for the organizer. Stellar consensus rejects early reclaim attempts.

### T2: Claim Link Guessing / Enumerable Scans
- **Threat**: Attacker enumerates claim URLs to steal unclaimed payouts.
- **Mitigation**: Claim tokens are generated as **UUID v4** strings (122 bits of entropy, ~5.3 × 10^36 possibilities). Brute-force guessing is cryptographically infeasible. Public API resolution uses SHA-256 token hashing for internal tracking.

### T3: Fee Payer Drainage via Replay Attacks
- **Threat**: Malicious actor repeatedly calls `/api/claim/execute`, `/api/trustline/execute`, or `/api/account/sponsor` to drain the fee payer's XLM reserve.
- **Mitigation**:
  1. Atomic Postgres locking function `begin_gasless_op` increments per-kind attempt counters (`trustline_attempts`, `sponsor_attempts`).
  2. Maximum 5 gasless attempts allowed per claim link.
  3. Server verifies inner transaction operations before signing outer fee-bump envelope.
  4. IP-based rate limiting on all API routes.

### T4: Cross-Organizer Data Access
- **Threat**: Authenticated organizer accesses another organizer's campaign or recipient records.
- **Mitigation**: Supabase Row Level Security (RLS) policies enforce `organizer_id = auth.uid()` on all SELECT, INSERT, UPDATE, and DELETE operations.

### T5: CSV Formula Injection
- **Threat**: Uploaded recipient CSV contains malicious spreadsheet formulas (`=CMD()`, `@SUM()`).
- **Mitigation**: CSV parser strips leading `=`, `+`, `-`, `@`, `\t`, `\r` characters from all parsed string fields prior to DB insertion.

---

## Key Management & Secrets Isolation

| Key | Location | Scope | Permissions |
|---|---|---|---|
| Organizer Private Key | Browser Wallet (Freighter) | Client | Signs campaign creation & funding TXs |
| Recipient Private Key | Browser Wallet (Freighter) | Client | Signs claim inner TXs |
| Fee Payer Secret (`FEE_PAYER_SECRET`) | Vercel Environment Variable | Server-side API only | Signs outer Fee-Bump envelopes |
| Supabase Anon Key (`VITE_SUPABASE_ANON_KEY`) | Client Bundle | Public | RLS-restricted public database access |
| Supabase Service Role Key (`SUPABASE_SERVICE_ROLE_KEY`) | Vercel Environment Variable | Server-side API only | Atomic attempt checks & RPC invocation |

---

## Rate Limiting Matrix

| Endpoint | Limit | Scope | Action on Exceed |
|---|---|---|---|
| `GET /api/claim/:token/resolve` | 30 req/min | IP Address | HTTP 429 Too Many Requests |
| `POST /api/claim/:token/execute` | 10 req/min | IP Address + Attempt Cap (5) | HTTP 429 / HTTP 429 Attempt Limit |
| `POST /api/trustline/:token/execute` | 10 req/min | IP Address + Attempt Cap (5) | HTTP 429 Attempt Limit |
| `POST /api/account/:token/sponsor` | 10 req/min | IP Address + Attempt Cap (5) | HTTP 429 Attempt Limit |
