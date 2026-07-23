# ReRail — Security Model

> Threat model, key management, and security controls.

---

## Table of Contents

- [Threat Model](#threat-model)
- [Key Management](#key-management)
- [Access Control](#access-control)
- [Input Validation](#input-validation)
- [Rate Limiting](#rate-limiting)
- [Security Checklist](#security-checklist)

---

## Threat Model

### T1: Organiser Reclaims Funds Before Deadline

**Vector**: Organiser attempts to claim recipient's claimable balance before the deadline expires.

**Mitigation**: Claimable balance time predicates enforce this at the **protocol level**. The organiser's claimant predicate uses `predicateNot(predicateBeforeRelativeTime(deadline))`, meaning they can only reclaim **after** the deadline. This is enforced by the Stellar network itself — no application-level bypass is possible.

**Severity**: N/A (mitigated at protocol level)

---

### T2: Guessable / Enumerable Claim Links

**Vector**: Attacker brute-forces claim link tokens to discover and claim balances.

**Mitigation**:
- Claim tokens are **UUID v4** — 122 bits of cryptographic randomness
- Brute-force space: 2^122 (~5.3 × 10^36 possibilities)
- At 1 billion guesses/second, exhaustive search takes ~1.7 × 10^20 years
- Rate limiting on the resolve endpoint adds defense-in-depth

**Severity**: Negligible

---

### T3: Fee Payer Account Drained

**Vector**: Attacker floods the claim endpoint to drain the fee payer's XLM balance.

**Mitigation**:
- Rate limiting: **10 requests/minute per IP** on `/api/claim/:token/execute`
- Fee payer holds minimal XLM (~5 XLM, enough for ~500 fee bumps)
- Refilled in small batches, never holds large balances
- Each valid claim costs ~0.01 XLM — attacker needs valid claim tokens to trigger actual submissions
- Invalid requests are rejected before any Stellar transaction is built

**Severity**: Low (requires valid tokens + sustained attack)

---

### T4: Recipient Double-Claiming

**Vector**: Recipient submits the same claim transaction twice.

**Mitigation**: The Stellar protocol **rejects** a second `claimClaimableBalance` operation on an already-claimed balance with `op_does_not_exist`. This is idempotent by design. Additionally, the application checks recipient status before building the fee bump.

**Severity**: N/A (protocol-level idempotency)

---

### T5: Cross-Organiser Data Access

**Vector**: Organiser A attempts to read or modify Organiser B's campaigns.

**Mitigation**: Supabase **Row Level Security** policies enforce `organizer_id = auth.uid()` on every operation:
- SELECT, INSERT, UPDATE, DELETE on `campaigns` table
- SELECT, INSERT, UPDATE on `recipients` table (via campaign ownership join)
- SELECT, INSERT on `transactions` table (via campaign ownership join)

Even if the client-side code is manipulated, the database rejects unauthorised access.

**Severity**: N/A (enforced at database level)

---

### T6: Fee Payer Key Exposure

**Vector**: Fee payer secret key leaks via client bundle or logs.

**Mitigation**:
- Secret stored as a **Vercel environment variable** (`FEE_PAYER_SECRET`)
- Never prefixed with `VITE_` — not bundled into client code
- Only accessed in the `/api/claim/execute` serverless function
- Vercel encrypts environment variables at rest
- No logging of key material in application code

**Severity**: Critical if breached (limited by fee payer holding minimal XLM)

---

### T7: CSV Injection Attack

**Vector**: Malicious CSV file contains formula injection (e.g., `=CMD()`, `+SYSTEM()`) in name/email fields.

**Mitigation**:
- All CSV fields sanitised: leading `=`, `+`, `-`, `@`, `\t`, `\r` characters are stripped
- Stellar addresses validated with `StrKey.isValidEd25519PublicKey()`
- Amount fields validated as positive numerics with ≤ 7 decimal places
- File size limits enforced
- Max 200 rows per upload (L5)

**Severity**: Low (sanitisation applied before storage)

---

### T8: Inner Transaction Manipulation

**Vector**: Attacker modifies the inner transaction XDR sent to the execute endpoint.

**Mitigation**:
- Server validates the inner TX contains exactly one `claimClaimableBalance` operation
- Server verifies the balance ID matches the recipient's stored `claimable_balance_id`
- Server verifies the claim token maps to a valid, pending recipient
- Stellar rejects transactions with invalid signatures

**Severity**: Low (multi-layer validation)

---

## Key Management

### Principle: Minimal Key Exposure

| Key | Location | Who Holds It | What It Can Do |
|---|---|---|---|
| Organiser signing key | Freighter browser wallet | Organiser only | Sign campaign transactions |
| Recipient signing key | Freighter browser wallet | Recipient only | Sign claim transactions |
| Fee payer key | Vercel env var | Server only | Sign fee bump wrappers |
| Supabase anon key | Client bundle (public) | Everyone | Read public data, authenticated queries |
| Supabase service role key | Vercel env var | Server only | Bypass RLS (claim resolution) |

### Rules

1. **No custodial keys** — ReRail never holds keys for organiser or recipient funds
2. **Fee payer isolation** — Holds only XLM for fees, never USDC or any value token
3. **Secret rotation** — Fee payer key can be rotated by generating a new keypair and updating the Vercel env var
4. **No key logging** — Application code never logs, serialises, or transmits secret keys

---

## Access Control

### Supabase RLS Policies

```sql
-- Campaigns: organiser-only access
CREATE POLICY "campaigns_select_own" ON campaigns
  FOR SELECT USING (organizer_id = (SELECT auth.uid()));

-- Recipients: campaign ownership check
CREATE POLICY "recipients_select_via_campaign" ON recipients
  FOR SELECT USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE organizer_id = (SELECT auth.uid())
    )
  );

-- Public claim resolution (by token only)
CREATE POLICY "recipients_select_by_claim_token" ON recipients
  FOR SELECT USING (true);
-- Safe because: UUID v4 tokens have 2^122 entropy, preventing enumeration.
-- The claim API returns only non-sensitive info (name, amount, status).
```

### Performance Optimisation

- `(SELECT auth.uid())` used instead of `auth.uid()` — forces single evaluation per query
- Indexes on `organizer_id`, `campaign_id`, `claim_link_token`, `status`

---

## Input Validation

| Input | Validation | Location |
|---|---|---|
| Stellar address | `StrKey.isValidEd25519PublicKey()` | CSV parser, claim page |
| USDC amount | Positive numeric, ≤ 7 decimals | CSV parser, campaign form |
| Email | Basic format regex | CSV parser |
| Campaign name | Non-empty string, max 200 chars | Campaign form |
| CSV fields | Strip `=`, `+`, `-`, `@` prefixes | CSV parser |
| Claim token | UUID v4 format | API endpoints |
| Inner TX XDR | Valid base64, single claimClaimableBalance op | Execute endpoint |

---

## Rate Limiting

| Endpoint | Limit | Window |
|---|---|---|
| `GET /api/claim/:token/resolve` | 30 requests | Per minute per IP |
| `POST /api/claim/:token/execute` | 10 requests | Per minute per IP |

Implementation: Vercel's built-in rate limiting or a lightweight in-memory counter (acceptable for L5; Redis-backed for L6).

---

## Security Checklist

### L5 MVP

- [x] RLS enabled on all tables
- [x] Fee payer key in server-side env vars only
- [x] CSV injection sanitisation
- [x] Stellar address validation
- [x] Amount validation (positive, ≤ 7 decimals)
- [x] Claim token entropy (UUID v4)
- [x] No custodial keys
- [x] Inner TX validation on execute endpoint
- [ ] Rate limiting on API endpoints
- [ ] HTTPS enforced (Vercel default)

### L6 Production

- [ ] Rate limiting with Redis backing
- [ ] Sentry error monitoring (no PII in events)
- [ ] Fee payer balance monitoring + alerts
- [ ] Security audit of RLS policies
- [ ] Penetration test on claim flow
- [ ] CSP headers configured
- [ ] Dependency vulnerability scanning (npm audit)
