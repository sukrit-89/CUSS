ALTER TABLE public.campaigns
  ADD COLUMN registry_contract_id TEXT,
  ADD COLUMN registry_campaign_id BIGINT,
  ADD COLUMN registry_create_tx_hash TEXT;

ALTER TABLE public.recipients
  ADD COLUMN claim_token_hash TEXT,
  ADD COLUMN registry_status TEXT
    CHECK (
      registry_status IS NULL
      OR registry_status IN ('pending', 'funded', 'claimed', 'expired')
    ),
  ADD COLUMN registry_tx_hash TEXT;

CREATE INDEX idx_campaigns_registry_campaign_id
  ON public.campaigns(registry_contract_id, registry_campaign_id);

CREATE INDEX idx_recipients_claim_token_hash
  ON public.recipients(claim_token_hash);
