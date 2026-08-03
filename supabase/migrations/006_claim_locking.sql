-- ---------------------------------------------------------------------------
-- Claim locking + rate limiting
-- ---------------------------------------------------------------------------
-- The claim route previously read `status = 'pending'` and updated it much
-- later, so two concurrent requests could both pass the read. The protocol
-- rejects the second claim, but the caller got an opaque 500 instead of a
-- clear error. A single atomic UPDATE makes the database the arbiter.
-- ---------------------------------------------------------------------------

-- ── Transitional 'claiming' status ──────────────────────────────────────────

ALTER TABLE public.recipients
  DROP CONSTRAINT IF EXISTS recipients_status_check;

ALTER TABLE public.recipients
  ADD CONSTRAINT recipients_status_check
  CHECK (status IN ('pending', 'claiming', 'claimed', 'expired'));

-- ── Per-token attempt counter ───────────────────────────────────────────────

ALTER TABLE public.recipients
  ADD COLUMN IF NOT EXISTS claim_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_claim_attempt_at TIMESTAMPTZ;

-- ── begin_claim: lock, burn, and rate limit in one statement ────────────────
-- Returns zero rows when the claim is already in flight, already claimed, or
-- has exceeded the attempt cap. The caller must not touch the fee payer until
-- this returns a row.

CREATE OR REPLACE FUNCTION public.begin_claim(p_token TEXT)
RETURNS TABLE (
  id                   UUID,
  campaign_id          UUID,
  wallet_address       TEXT,
  claimable_balance_id TEXT,
  claim_attempts       INT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.recipients r
     SET status                = 'claiming',
         claim_attempts        = r.claim_attempts + 1,
         last_claim_attempt_at = now()
   WHERE r.claim_link_token = p_token
     AND r.status           = 'pending'
     AND r.claim_attempts   < 5
  RETURNING r.id, r.campaign_id, r.wallet_address, r.claimable_balance_id, r.claim_attempts;
$$;

REVOKE ALL ON FUNCTION public.begin_claim(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.begin_claim(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.begin_claim(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.begin_claim(TEXT) TO service_role;

-- ── release_claim: return a locked row to 'pending' after a failure ─────────
-- The attempt counter is deliberately not decremented, so a caller that keeps
-- failing still runs out of attempts.

CREATE OR REPLACE FUNCTION public.release_claim(p_recipient_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.recipients
     SET status = 'pending'
   WHERE id = p_recipient_id
     AND status = 'claiming';
$$;

REVOKE ALL ON FUNCTION public.release_claim(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_claim(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.release_claim(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.release_claim(UUID) TO service_role;
