CREATE TABLE public.transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  UUID NOT NULL REFERENCES public.recipients(id) ON DELETE CASCADE,
  campaign_id   UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  tx_hash       TEXT NOT NULL,
  tx_type       TEXT NOT NULL
                  CHECK (tx_type IN ('create_balance', 'claim', 'reclaim', 'sponsor_account')),
  stellar_response  JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_recipient_id ON public.transactions(recipient_id);
CREATE INDEX idx_transactions_campaign_id ON public.transactions(campaign_id);
CREATE INDEX idx_transactions_tx_type ON public.transactions(tx_type);
