import { createClient } from '@supabase/supabase-js';
import { isRegistryConfigured, recordBalanceCreated } from '../_lib/registry';

const TX_HASH_RE = /^[0-9a-f]{64}$/i;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ClaimantEffect {
  type: string;
  account: string;
  balance_id: string;
  amount?: string;
}

function getStringValue(source: any, key: string): string | null {
  const value = source?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Reconciles on-chain claimable balances back into Supabase.
 *
 * After the organizer signs and submits the createClaimableBalance batch, the
 * balance IDs only exist inside Horizon's transaction effects. Without this
 * step `recipients.claimable_balance_id` stays NULL and no recipient can ever
 * claim.
 *
 * Recipients are matched by claimant address rather than operation index —
 * a `claimable_balance_claimant_created` effect carries the claimant it was
 * created for, which survives reordering and partial batches.
 */
export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const txHash =
    getStringValue(req.query, 'txHash') ?? getStringValue(req.body, 'tx_hash');
  const campaignId =
    getStringValue(req.query, 'campaignId') ?? getStringValue(req.body, 'campaign_id');

  if (!txHash || !TX_HASH_RE.test(txHash)) {
    return res.status(400).json({ error: 'Valid txHash is required' });
  }

  if (!campaignId || !UUID_RE.test(campaignId)) {
    return res.status(400).json({ error: 'Valid campaignId is required' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const horizonUrl =
    process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // The route writes with the service role key, which bypasses RLS. Without a
  // verified caller anyone could point any transaction hash at any campaign.
  const accessToken = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');

  if (!accessToken) {
    return res.status(401).json({ error: 'Authorization bearer token is required' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);

  if (userError || !userData?.user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  try {
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, organizer_id, treasury_address, registry_campaign_id')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (campaign.organizer_id !== userData.user.id) {
      return res.status(403).json({ error: 'You do not own this campaign' });
    }

    // ── Fetch the transaction so we know who created the balances ───────────
    const txResponse = await fetch(`${horizonUrl}/transactions/${txHash}`);

    if (!txResponse.ok) {
      return res.status(404).json({ error: 'Transaction not found on Horizon' });
    }

    const transaction = (await txResponse.json()) as { source_account?: string };
    const organizerAddress = transaction.source_account;

    if (!organizerAddress) {
      return res.status(502).json({ error: 'Horizon returned a transaction with no source' });
    }

    // The organizer is the only account allowed to fund a campaign's balances.
    // If we already know the treasury, a mismatch means this txHash belongs to
    // someone else and must not be attributed to this campaign.
    if (campaign.treasury_address && campaign.treasury_address !== organizerAddress) {
      return res
        .status(403)
        .json({ error: 'Transaction source does not match campaign treasury' });
    }

    // ── Pull every claimant effect from the transaction ─────────────────────
    const effectsResponse = await fetch(
      `${horizonUrl}/transactions/${txHash}/effects?limit=200`
    );

    if (!effectsResponse.ok) {
      return res.status(502).json({ error: 'Failed to load transaction effects' });
    }

    const effectsPayload = (await effectsResponse.json()) as {
      _embedded?: { records?: ClaimantEffect[] };
    };
    const effects: ClaimantEffect[] = effectsPayload?._embedded?.records ?? [];

    // Each balance has two claimants: the recipient and the organizer's
    // reclaim-after-deadline claim. Only the recipient side identifies a row.
    const recipientEffects = effects.filter(
      (effect) =>
        effect.type === 'claimable_balance_claimant_created' &&
        effect.account !== organizerAddress
    );

    if (recipientEffects.length === 0) {
      return res.status(200).json({ synced: 0, unmatched: [], balances: 0 });
    }

    const synced: Array<{ recipient_id: string; wallet_address: string; balance_id: string }> = [];
    const unmatched: string[] = [];

    for (const effect of recipientEffects) {
      const { data: updated, error: updateError } = await supabase
        .from('recipients')
        .update({ claimable_balance_id: effect.balance_id })
        .eq('campaign_id', campaignId)
        .eq('wallet_address', effect.account)
        .is('claimable_balance_id', null)
        .select('id')
        .maybeSingle();

      if (updateError || !updated) {
        // Either no recipient row for this claimant, or it was already synced
        // by an earlier call. Both are safe to skip; report so the UI can tell.
        unmatched.push(effect.account);
        continue;
      }

      synced.push({
        recipient_id: updated.id,
        wallet_address: effect.account,
        balance_id: effect.balance_id,
      });
    }

    if (synced.length > 0) {
      await supabase.from('transactions').insert(
        synced.map((entry) => ({
          recipient_id: entry.recipient_id,
          campaign_id: campaignId,
          tx_hash: txHash,
          tx_type: 'create_balance',
        }))
      );
    }

    if (!campaign.treasury_address) {
      await supabase
        .from('campaigns')
        .update({ treasury_address: organizerAddress })
        .eq('id', campaignId);
    }

    // ── Mirror onto the Soroban registry, best effort ───────────────────────
    // The registry is a proof layer. A failure here must not fail the sync —
    // the balances exist on-chain either way and the links already work.
    let registrySynced = 0;

    if (isRegistryConfigured() && campaign.registry_campaign_id) {
      for (const entry of synced) {
        try {
          const registryTxHash = await recordBalanceCreated(
            campaign.registry_campaign_id,
            entry.wallet_address,
            entry.balance_id
          );

          await supabase
            .from('recipients')
            .update({ registry_status: 'funded', registry_tx_hash: registryTxHash })
            .eq('id', entry.recipient_id);

          registrySynced += 1;
        } catch (registryError: any) {
          console.warn(
            `Registry mark_balance_created failed for ${entry.wallet_address}:`,
            registryError?.message
          );
        }
      }
    }

    return res.status(200).json({
      synced: synced.length,
      unmatched,
      balances: recipientEffects.length,
      registry_synced: registrySynced,
      recipients: synced,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
