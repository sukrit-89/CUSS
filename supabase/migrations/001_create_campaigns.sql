CREATE TABLE public.campaigns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  token         TEXT NOT NULL DEFAULT 'USDC',
  issuer        TEXT NOT NULL,
  amount_per_recipient  NUMERIC(20, 7) NOT NULL,
  total_pool    NUMERIC(20, 7) NOT NULL,
  deadline      TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'active', 'completed', 'expired')),
  treasury_address  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaigns_organizer_id ON public.campaigns(organizer_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
