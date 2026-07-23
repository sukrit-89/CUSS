import { createClient } from '@supabase/supabase-js';
import { TransactionBuilder, Keypair, Networks, server as HorizonServer } from '@stellar/stellar-sdk';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;
  const { signed_inner_tx_xdr } = req.body;

  if (!token || !signed_inner_tx_xdr) {
    return res.status(400).json({ error: 'Missing token or signed XDR' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const feePayerSecret = process.env.FEE_PAYER_SECRET || '';
  const networkPassphrase = process.env.VITE_STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET;
  const horizonUrl = process.env.VITE_STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';

  if (!supabaseUrl || !supabaseKey || !feePayerSecret) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const server = new HorizonServer(horizonUrl);

  try {
    const { data: recipient, error } = await supabase
      .from('recipients')
      .select('*, campaigns(balance_id)')
      .eq('claim_token', token)
      .single();

    if (error || !recipient) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (recipient.status !== 'pending') {
      return res.status(400).json({ error: 'Claim already executed or invalid status' });
    }

    const feePayer = Keypair.fromSecret(feePayerSecret);
    const innerTx = TransactionBuilder.fromXDR(signed_inner_tx_xdr, networkPassphrase) as any;
    
    const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
      feePayer,
      1000,
      innerTx,
      networkPassphrase
    );
    
    feeBumpTx.sign(feePayer);
    
    const submitResult = await server.submitTransaction(feeBumpTx);

    if (submitResult.successful) {
      await supabase
        .from('recipients')
        .update({ status: 'claimed' })
        .eq('id', recipient.id);
        
      return res.status(200).json({ success: true, hash: submitResult.hash });
    } else {
      return res.status(500).json({ error: 'Transaction submission failed', details: submitResult });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}