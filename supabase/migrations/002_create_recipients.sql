CREATE TABLE public.recipients (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id          UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  email                TEXT,
  wallet_address       TEXT,
  amount               NUMERIC(20, 7),
  claimable_balance_id TEXT,
  claim_link_token     TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'claimed', 'expired')),
  claimed_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recipients_campaign_id ON public.recipients(campaign_id);
CREATE INDEX idx_recipients_claim_link_token ON public.recipients(claim_link_token);
CREATE INDEX idx_recipients_status ON public.recipients(status);
CREATE INDEX idx_recipients_wallet_address ON public.recipients(wallet_address);
