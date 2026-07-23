ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- campaigns
CREATE POLICY "Campaigns are visible to their organizer" 
ON public.campaigns FOR SELECT 
USING (organizer_id = (SELECT auth.uid()));

CREATE POLICY "Campaigns can be created by their organizer" 
ON public.campaigns FOR INSERT 
WITH CHECK (organizer_id = (SELECT auth.uid()));

CREATE POLICY "Campaigns can be updated by their organizer" 
ON public.campaigns FOR UPDATE 
USING (organizer_id = (SELECT auth.uid()));

CREATE POLICY "Campaigns can be deleted by their organizer" 
ON public.campaigns FOR DELETE 
USING (organizer_id = (SELECT auth.uid()));

-- recipients
CREATE POLICY "Recipients are visible to campaign organizer" 
ON public.recipients FOR SELECT 
USING (
  campaign_id IN (
    SELECT id FROM public.campaigns WHERE organizer_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Recipients can be created by campaign organizer" 
ON public.recipients FOR INSERT 
WITH CHECK (
  campaign_id IN (
    SELECT id FROM public.campaigns WHERE organizer_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Recipients can be updated by campaign organizer" 
ON public.recipients FOR UPDATE 
USING (
  campaign_id IN (
    SELECT id FROM public.campaigns WHERE organizer_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Recipients claim lookup is public" 
ON public.recipients FOR SELECT 
USING (claim_link_token IS NOT NULL);

-- transactions
CREATE POLICY "Transactions are visible to campaign organizer" 
ON public.transactions FOR SELECT 
USING (
  campaign_id IN (
    SELECT id FROM public.campaigns WHERE organizer_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Transactions can be created by campaign organizer" 
ON public.transactions FOR INSERT 
WITH CHECK (
  campaign_id IN (
    SELECT id FROM public.campaigns WHERE organizer_id = (SELECT auth.uid())
  )
);
