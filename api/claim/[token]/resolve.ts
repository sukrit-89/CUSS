import { createClient } from '@supabase/supabase-js';

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = Array.isArray(req.query.token) ? req.query.token[0] : req.query.token;

  if (!token || !UUID_V4_RE.test(token)) {
    return res.status(400).json({ error: 'Valid claim token is required' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey =
    process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase.rpc('resolve_claim_link', { p_token: token });
    const recipient = Array.isArray(data) ? data[0] : data;

    if (error || !recipient) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (recipient.status === 'claimed') {
      // The recipient still deserves proof: when it happened and the tx that
      // moved the funds, so they can verify it on an explorer themselves.
      const { data: claimTx } = await supabase
        .from('transactions')
        .select('tx_hash, created_at')
        .eq('recipient_id', recipient.id)
        .eq('tx_type', 'claim')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return res.status(410).json({
        error: 'Already claimed',
        status: 'claimed',
        amount: recipient.amount ?? recipient.campaign_amount_per_recipient,
        asset_code: recipient.campaign_token,
        campaign_name: recipient.campaign_name,
        claimed_at: recipient.claimed_at,
        tx_hash: claimTx?.tx_hash ?? null,
      });
    }

    if (recipient.campaign_deadline && new Date() > new Date(recipient.campaign_deadline)) {
      return res.status(410).json({
        error: 'Claim expired',
        status: 'expired',
        amount: recipient.amount ?? recipient.campaign_amount_per_recipient,
        asset_code: recipient.campaign_token,
        campaign_name: recipient.campaign_name,
        deadline: recipient.campaign_deadline,
      });
    }

    return res.status(200).json({
      name: recipient.name,
      amount: recipient.amount ?? recipient.campaign_amount_per_recipient,
      asset_code: recipient.campaign_token,
      token: recipient.claim_link_token,
      status: recipient.status,
      campaign_name: recipient.campaign_name,
      deadline: recipient.campaign_deadline,
      balance_id: recipient.claimable_balance_id,
      wallet_address: recipient.wallet_address,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
