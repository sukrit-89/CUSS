-- ---------------------------------------------------------------------------
-- Public claim-link resolution
-- ---------------------------------------------------------------------------
-- The claim page needs to resolve a token before the recipient signs or the
-- server-side claim flow can continue. In local dev we do not always have a
-- service-role secret available, so this SECURITY DEFINER function exposes
-- only the non-sensitive fields needed to render the claim page.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_claim_link(p_token TEXT)
RETURNS TABLE (
  recipient_id UUID,
  campaign_id UUID,
  name TEXT,
  amount NUMERIC,
  wallet_address TEXT,
  claimable_balance_id TEXT,
  claim_link_token TEXT,
  status TEXT,
  claimed_at TIMESTAMPTZ,
  campaign_name TEXT,
  campaign_deadline TIMESTAMPTZ,
  campaign_amount_per_recipient NUMERIC,
  campaign_token TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.campaign_id,
    r.name,
    r.amount,
    r.wallet_address,
    r.claimable_balance_id,
    r.claim_link_token,
    r.status,
    r.claimed_at,
    c.name,
    c.deadline,
    c.amount_per_recipient,
    c.token
  FROM public.recipients r
  JOIN public.campaigns c ON c.id = r.campaign_id
  WHERE r.claim_link_token = p_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_claim_link(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_claim_link(TEXT) TO anon, authenticated, service_role;