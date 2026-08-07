-- ---------------------------------------------------------------------------
-- Attempt caps for the fee-payer-funded routes
-- ---------------------------------------------------------------------------
-- /api/claim/[token]/execute already burns an attempt through `begin_claim`.
-- The other two gasless routes — trustline creation and account sponsorship —
-- had no cap at all, so a leaked claim token could be replayed indefinitely to
-- drain the fee payer's XLM.
--
-- Both are prerequisites rather than the claim itself, so they must not take
-- the row's `status` lock the way `begin_claim` does; a recipient who opens a
-- trustline still has to claim afterwards. A plain per-kind counter is enough.
-- ---------------------------------------------------------------------------

ALTER TABLE public.recipients
  ADD COLUMN IF NOT EXISTS trustline_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sponsor_attempts   INT NOT NULL DEFAULT 0;

-- ── begin_gasless_op: atomic increment with a cap ───────────────────────────
-- Returns zero rows when the recipient does not exist, is no longer pending,
-- or has exhausted the budget for that operation kind. The caller must not
-- touch the fee payer until this returns a row.

CREATE OR REPLACE FUNCTION public.begin_gasless_op(p_token TEXT, p_kind TEXT)
RETURNS TABLE (
  id             UUID,
  campaign_id    UUID,
  wallet_address TEXT,
  attempts       INT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.recipients r
     SET trustline_attempts = r.trustline_attempts + (p_kind = 'trustline')::INT,
         sponsor_attempts   = r.sponsor_attempts   + (p_kind = 'sponsor')::INT
   WHERE r.claim_link_token = p_token
     AND r.status           = 'pending'
     AND p_kind IN ('trustline', 'sponsor')
     AND CASE p_kind
           WHEN 'trustline' THEN r.trustline_attempts
           WHEN 'sponsor'   THEN r.sponsor_attempts
         END < 5
  RETURNING
    r.id,
    r.campaign_id,
    r.wallet_address,
    CASE p_kind
      WHEN 'trustline' THEN r.trustline_attempts
      WHEN 'sponsor'   THEN r.sponsor_attempts
    END;
$$;

REVOKE ALL ON FUNCTION public.begin_gasless_op(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.begin_gasless_op(TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.begin_gasless_op(TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.begin_gasless_op(TEXT, TEXT) TO service_role;
