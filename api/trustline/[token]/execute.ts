import { createClient } from '@supabase/supabase-js';
import {
  Horizon,
  Keypair,
  Networks,
  StrKey,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getStringBodyValue(body: any, key: string): string | null {
  const value = body?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Fee-bumps a recipient's USDC `changeTrust` transaction.
 *
 * This is state 3 of the claim flow: the recipient has an account but no USDC
 * trustline, and no XLM to pay for adding one. The recipient signs the inner
 * transaction; ReRail's fee payer covers the fee only.
 *
 * The asset check is not cosmetic — without it this endpoint would let anyone
 * with a valid claim token open arbitrary trustlines at ReRail's expense.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = Array.isArray(req.query.token) ? req.query.token[0] : req.query.token;
  const signedInnerTxXdr = getStringBodyValue(req.body, 'signed_inner_tx_xdr');

  if (!token || !UUID_V4_RE.test(token)) {
    return res.status(400).json({ error: 'Valid claim token is required' });
  }

  if (!signedInnerTxXdr) {
    return res.status(400).json({ error: 'signed_inner_tx_xdr is required' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const feePayerSecret = process.env.FEE_PAYER_SECRET || '';
  const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET;
  const horizonUrl =
    process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
  const usdcIssuer =
    process.env.STELLAR_USDC_ISSUER ||
    'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
  const usdcCode = process.env.STELLAR_USDC_CODE || 'USDC';

  if (!supabaseUrl || !supabaseKey || !feePayerSecret) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const server = new Horizon.Server(horizonUrl);

  try {
    // Read-only pre-checks first, so a malformed request never consumes one of
    // the recipient's attempts.
    const { data: recipient, error } = await supabase
      .from('recipients')
      .select('id, campaign_id, wallet_address, status')
      .eq('claim_link_token', token)
      .single();

    if (error || !recipient) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (recipient.status !== 'pending') {
      return res.status(400).json({ error: 'Claim already executed or invalid status' });
    }

    if (!recipient.wallet_address || !StrKey.isValidEd25519PublicKey(recipient.wallet_address)) {
      return res.status(409).json({ error: 'Recipient wallet address is missing or invalid' });
    }

    const innerTx = TransactionBuilder.fromXDR(signedInnerTxXdr, networkPassphrase) as any;
    const operations = innerTx.operations ?? [];
    const operation = operations[0];
    const operationSource = operation?.source ?? innerTx.source;

    if (operations.length !== 1 || operation?.type !== 'changeTrust') {
      return res
        .status(400)
        .json({ error: 'Inner transaction must contain exactly one changeTrust operation' });
    }

    const line = operation.line;
    const assetCode = typeof line?.getCode === 'function' ? line.getCode() : null;
    const assetIssuer = typeof line?.getIssuer === 'function' ? line.getIssuer() : null;

    if (assetCode !== usdcCode || assetIssuer !== usdcIssuer) {
      return res
        .status(400)
        .json({ error: 'Trustline asset must be the campaign USDC asset' });
    }

    if (operationSource !== recipient.wallet_address) {
      return res
        .status(400)
        .json({ error: 'Inner transaction source does not match recipient wallet' });
    }

    // ── Burn one attempt before spending the fee payer's XLM ────────────────
    // Everything above is free to reject. From here on the request costs real
    // money, so a leaked link must not be replayable without limit.
    const { data: lockRows, error: lockError } = await supabase.rpc('begin_gasless_op', {
      p_token: token,
      p_kind: 'trustline',
    });

    if (lockError) {
      return res.status(500).json({ error: 'Failed to record the trustline attempt' });
    }

    if (!(Array.isArray(lockRows) ? lockRows[0] : lockRows)) {
      return res.status(429).json({
        error:
          'This link has used all of its trustline attempts. Contact the organizer.',
      });
    }

    const feePayer = Keypair.fromSecret(feePayerSecret);

    const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
      feePayer,
      '1000',
      innerTx,
      networkPassphrase
    );

    feeBumpTx.sign(feePayer);

    const submitResult = await server.submitTransaction(feeBumpTx);

    if (!submitResult.successful) {
      return res
        .status(500)
        .json({ error: 'Transaction submission failed', details: submitResult });
    }

    // Deliberately does not touch recipient status — adding a trustline is a
    // prerequisite, not a claim.
    return res.status(200).json({
      success: true,
      hash: submitResult.hash,
      tx_hash: submitResult.hash,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
