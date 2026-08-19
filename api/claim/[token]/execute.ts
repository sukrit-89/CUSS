import { createClient } from '@supabase/supabase-js';
import {
  Horizon,
  Keypair,
  Networks,
  StrKey,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { isRegistryConfigured, recordClaim } from '../../_lib/registry';

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getStringBodyValue(body: any, key: string): string | null {
  const value = body?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function firstJoinedRow<T>(row: T | T[] | null | undefined): T | null {
  return Array.isArray(row) ? (row[0] ?? null) : (row ?? null);
}

/**
 * Returns a locked recipient to 'pending' so a genuine retry is possible.
 * The attempt counter is not rolled back, so repeated failures still exhaust
 * the budget.
 */
async function releaseClaim(supabase: any, recipientId: string | null) {
  if (!recipientId) return;
  try {
    await supabase.rpc('release_claim', { p_recipient_id: recipientId });
  } catch {
    // Best effort — the row stays 'claiming' and an operator can reset it.
  }
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
  const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';

  if (!supabaseUrl || !supabaseKey || !feePayerSecret) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const server = new Horizon.Server(horizonUrl);

  // Declared outside the try so the failure path can release the lock.
  let lockedRecipientId: string | null = null;

  try {
    // Read-only pre-checks first, so obviously-invalid requests never consume
    // one of the recipient's five attempts.
    const { data: preview, error: previewError } = await supabase
      .from('recipients')
      .select('status, claimable_balance_id, wallet_address, campaigns(deadline)')
      .eq('claim_link_token', token)
      .single();

    if (previewError || !preview) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    if (preview.status === 'claimed') {
      return res.status(400).json({ error: 'Claim already executed or invalid status' });
    }

    if (!preview.claimable_balance_id) {
      return res.status(409).json({ error: 'Claimable balance has not been created yet' });
    }

    const campaign = firstJoinedRow(preview.campaigns);

    if (campaign?.deadline && new Date() > new Date(campaign.deadline)) {
      return res.status(410).json({ error: 'Claim expired' });
    }

    // ── Atomic lock + burn + rate limit ─────────────────────────────────────
    // A single UPDATE decides the winner. Zero rows means the claim is already
    // in flight, already done, or has burned through its attempt budget.
    const { data: lockRows, error: lockError } = await supabase.rpc('begin_claim', {
      p_token: token,
    });

    if (lockError) {
      return res.status(500).json({ error: 'Failed to acquire claim lock' });
    }

    const recipient = Array.isArray(lockRows) ? lockRows[0] : lockRows;

    if (!recipient) {
      return res.status(409).json({
        error:
          'Claim is already in progress, already completed, or has exceeded the retry limit',
      });
    }

    lockedRecipientId = recipient.id;

    if (!recipient.claimable_balance_id) {
      await releaseClaim(supabase, lockedRecipientId);
      return res.status(409).json({ error: 'Claimable balance has not been created yet' });
    }

    if (!recipient.wallet_address || !StrKey.isValidEd25519PublicKey(recipient.wallet_address)) {
      await releaseClaim(supabase, lockedRecipientId);
      return res.status(409).json({ error: 'Recipient wallet address is missing or invalid' });
    }

    const innerTx = TransactionBuilder.fromXDR(signedInnerTxXdr, networkPassphrase) as any;
    const operations = innerTx.operations ?? [];
    const operation = operations[0];
    const operationSource = operation?.source ?? innerTx.source;

    if (operations.length !== 1 || operation?.type !== 'claimClaimableBalance') {
      await releaseClaim(supabase, lockedRecipientId);
      return res.status(400).json({ error: 'Inner transaction must contain exactly one claimClaimableBalance operation' });
    }

    if (operation.balanceId !== recipient.claimable_balance_id) {
      await releaseClaim(supabase, lockedRecipientId);
      return res.status(400).json({ error: 'Inner transaction balance ID does not match claim link' });
    }

    if (operationSource !== recipient.wallet_address) {
      await releaseClaim(supabase, lockedRecipientId);
      return res.status(400).json({ error: 'Inner transaction source does not match recipient wallet' });
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

    if (submitResult.successful) {
      const claimedAt = new Date().toISOString();

      await supabase
        .from('recipients')
        .update({ status: 'claimed', claimed_at: claimedAt })
        .eq('id', recipient.id);

      await supabase
        .from('transactions')
        .insert({
          recipient_id: recipient.id,
          campaign_id: recipient.campaign_id,
          tx_hash: submitResult.hash,
          tx_type: 'claim',
          stellar_response: submitResult,
        });

      // ── Mirror the claim onto the Soroban registry, best effort ──────────
      // The USDC has already moved; the registry only records that it did.
      // A contract failure must never turn a successful claim into an error.
      let registryTxHash: string | null = null;

      if (isRegistryConfigured()) {
        try {
          const { data: campaignRow } = await supabase
            .from('campaigns')
            .select('registry_campaign_id')
            .eq('id', recipient.campaign_id)
            .single();

          if (campaignRow?.registry_campaign_id) {
            registryTxHash = await recordClaim(
              campaignRow.registry_campaign_id,
              recipient.wallet_address,
              submitResult.hash
            );

            await supabase
              .from('recipients')
              .update({ registry_status: 'claimed', registry_tx_hash: registryTxHash })
              .eq('id', recipient.id);
          }
        } catch (registryError: any) {
          console.warn('Registry record_claim failed:', registryError?.message);
        }
      }

      return res.status(200).json({
        success: true,
        hash: submitResult.hash,
        tx_hash: submitResult.hash,
        registry_tx_hash: registryTxHash,
      });
    } else {
      await releaseClaim(supabase, lockedRecipientId);
      return res.status(500).json({ error: 'Transaction submission failed', details: submitResult });
    }
  } catch (err: any) {
    await releaseClaim(supabase, lockedRecipientId);
    return res.status(500).json({ error: err.message });
  }
}
