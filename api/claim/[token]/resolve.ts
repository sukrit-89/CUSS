import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
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
      .select('*, campaigns(name, claim_deadline, balance_id)')
      .eq('claim_token', token)
      .single();

    if (error || !recipient) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (recipient.status === 'claimed') {
      return res.status(410).json({ error: 'Already claimed' });
    }

    if (recipient.campaigns?.claim_deadline && new Date() > new Date(recipient.campaigns.claim_deadline)) {
      return res.status(410).json({ error: 'Claim expired' });
    }

    return res.status(200).json({
      name: recipient.name,
      amount: recipient.amount,
      token: recipient.claim_token,
      status: recipient.status,
      campaign_name: recipient.campaigns?.name,
      deadline: recipient.campaigns?.claim_deadline,
      balance_id: recipient.campaigns?.balance_id
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}