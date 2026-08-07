import { createClient } from '@supabase/supabase-js';

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function firstJoinedRow<T>(row: T | T[] | null | undefined): T | null {
  return Array.isArray(row) ? (row[0] ?? null) : (row ?? null);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = Array.isArray(req.query.token) ? req.query.token[0] : req.query.token;

  if (!token || !UUID_V4_RE.test(token)) {
    return res.status(400).json({ error: 'Valid claim token is required' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data: recipient, error } = await supabase
      .from('recipients')
      .select('id, name, amount, wallet_address, claimable_balance_id, claim_link_token, status, claimed_at, campaigns(id, name, deadline, amount_per_recipient, token)')
      .eq('claim_link_token', token)
      .single();

    if (error || !recipient) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    const campaign = firstJoinedRow(recipient.campaigns);

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
        amount: recipient.amount ?? campaign?.amount_per_recipient,
        asset_code: campaign?.token,
        campaign_name: campaign?.name,
        claimed_at: recipient.claimed_at,
        tx_hash: claimTx?.tx_hash ?? null,
      });
    }

    if (campaign?.deadline && new Date() > new Date(campaign.deadline)) {
      return res.status(410).json({
        error: 'Claim expired',
        status: 'expired',
        amount: recipient.amount ?? campaign?.amount_per_recipient,
        asset_code: campaign?.token,
        campaign_name: campaign?.name,
        deadline: campaign?.deadline,
      });
    }

    return res.status(200).json({
      name: recipient.name,
      amount: recipient.amount ?? campaign?.amount_per_recipient,
      asset_code: campaign?.token,
      token: recipient.claim_link_token,
      status: recipient.status,
      campaign_name: campaign?.name,
      deadline: campaign?.deadline,
      balance_id: recipient.claimable_balance_id,
      wallet_address: recipient.wallet_address,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
