import { createClient } from '@supabase/supabase-js';
import {
  Horizon,
  Keypair,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BASE_FEE = '1000';
const TX_TIMEOUT_SECONDS = 180;
const MAX_OPS_PER_TX = 100;

function getStringBodyValue(body: any, key: string): string | null {
  const value = body?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Reclaims expired claimable balances on behalf of the organizer.
 *
 * Two-phase flow, identical to the sponsor endpoint:
 *   POST (no body)            → returns unsigned inner tx XDR for the organizer
 *   POST { signed_inner_tx }  → validates, fee-bumps, submits
 *
 * The organizer is always the second claimant on every balance, gated by
 * `not(before deadline)`. Stellar itself refuses reclaims before the deadline
 * — this endpoint cannot take funds back early even if called with bad intent.
 */
export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const campaignId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const signedInnerTxXdr = getStringBodyValue(req.body, 'signed_inner_tx_xdr');

  if (!campaignId || !UUID_V4_RE.test(campaignId)) {
    return res.status(400).json({ error: 'Valid campaign ID is required' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const feePayerSecret = process.env.FEE_PAYER_SECRET || '';
  const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET;
  const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';

  if (!supabaseUrl || !supabaseKey || !feePayerSecret) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const server = new Horizon.Server(horizonUrl);
  const feePayer = Keypair.fromSecret(feePayerSecret);

  try {
    // Load campaign + its reclaimable recipients.
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (!campaign.treasury_address || !StrKey.isValidEd25519PublicKey(campaign.treasury_address)) {
      return res.status(400).json({ error: 'Campaign has no valid treasury address' });
    }

    // Only allow reclaim after deadline.
    if (campaign.deadline && new Date() < new Date(campaign.deadline)) {
      return res.status(400).json({
        error: 'Cannot reclaim before the campaign deadline has passed',
      });
    }

    const { data: reclaimable, error: recipientError } = await supabase
      .from('recipients')
      .select('id, claimable_balance_id, wallet_address, status')
      .eq('campaign_id', campaignId)
      .not('claimable_balance_id', 'is', null)
      .neq('status', 'claimed')
      .neq('status', 'expired');

    if (recipientError) {
      return res.status(500).json({ error: 'Failed to load recipients' });
    }

    if (!reclaimable || reclaimable.length === 0) {
      return res.status(400).json({ error: 'No reclaimable balances found' });
    }

    const organizerAddress = campaign.treasury_address;

    // ── Phase 1: build unsigned inner tx for the organizer ───────────────────
    if (!signedInnerTxXdr) {
      const organizerAccount = await server.loadAccount(organizerAddress);

      // Batch into a single transaction (up to MAX_OPS_PER_TX).
      const batch = reclaimable.slice(0, MAX_OPS_PER_TX);
      const builder = new TransactionBuilder(organizerAccount, {
        fee: BASE_FEE,
        networkPassphrase,
      }).setTimeout(TX_TIMEOUT_SECONDS);

      for (const recipient of batch) {
        builder.addOperation(
          Operation.claimClaimableBalance({
            balanceId: recipient.claimable_balance_id as string,
          }),
        );
      }

      const innerTx = builder.build();

      return res.status(200).json({
        unsigned_inner_tx_xdr: innerTx.toXDR(),
        reclaim_count: batch.length,
        total_reclaimable: reclaimable.length,
      });
    }

    // ── Phase 2: validate, fee-bump, submit ─────────────────────────────────
    const innerTx = TransactionBuilder.fromXDR(signedInnerTxXdr, networkPassphrase) as any;

    // The inner transaction source must be the organizer.
    if (innerTx.source !== organizerAddress) {
      return res.status(400).json({ error: 'Inner transaction source must be the campaign organizer' });
    }

    // Every operation must be claimClaimableBalance.
    const operations = innerTx.operations ?? [];
    if (operations.length === 0 || operations.length > MAX_OPS_PER_TX) {
      return res.status(400).json({ error: `Expected 1–${MAX_OPS_PER_TX} claimClaimableBalance operations` });
    }

    const reclaimableIds = new Set(reclaimable.map((r) => r.claimable_balance_id));

    for (const op of operations) {
      if (op.type !== 'claimClaimableBalance') {
        return res.status(400).json({ error: 'All operations must be claimClaimableBalance' });
      }
      if (!reclaimableIds.has(op.balanceId)) {
        return res.status(400).json({ error: 'Balance ID does not belong to this campaign or is already claimed' });
      }
    }

    // Fee-bump and submit.
    const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
      feePayer,
      BASE_FEE,
      innerTx,
      networkPassphrase,
    );
    feeBumpTx.sign(feePayer);

    const submitResult = await server.submitTransaction(feeBumpTx);

    if (!submitResult.successful) {
      return res.status(500).json({
        error: 'Reclaim transaction rejected by Stellar',
        details: submitResult,
      });
    }

    // Mark all reclaimed recipients as expired and log the transaction.
    const reclaimedOps = operations as Array<{ balanceId: string }>;
    const reclaimedBalanceIds = new Set(reclaimedOps.map((op) => op.balanceId));

    const reclaimedRecipients = reclaimable.filter(
      (r) => r.claimable_balance_id && reclaimedBalanceIds.has(r.claimable_balance_id),
    );

    for (const recipient of reclaimedRecipients) {
      await supabase
        .from('recipients')
        .update({ status: 'expired' })
        .eq('id', recipient.id);

      await supabase.from('transactions').insert({
        recipient_id: recipient.id,
        campaign_id: campaignId,
        tx_hash: submitResult.hash,
        tx_type: 'reclaim',
      });
    }

    // If all recipients are now claimed or expired, mark the campaign as expired.
    const { data: remaining } = await supabase
      .from('recipients')
      .select('id')
      .eq('campaign_id', campaignId)
      .neq('status', 'claimed')
      .neq('status', 'expired');

    if (!remaining || remaining.length === 0) {
      await supabase
        .from('campaigns')
        .update({ status: 'expired' })
        .eq('id', campaignId);
    }

    return res.status(200).json({
      success: true,
      tx_hash: submitResult.hash,
      reclaimed: reclaimedRecipients.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
