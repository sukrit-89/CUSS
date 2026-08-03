import {
  buildActivateRegistryCampaignTx,
  buildCreateRegistryCampaignTx,
  buildRegisterRegistryRecipientTx,
  submitRegistryTx,
} from '@/lib/stellar';
import { CONTRACTS_ENABLED, RERAIL_REGISTRY_CONTRACT_ID } from '@/config/contracts';
import { USDC_SAC_CONTRACT_ID } from '@/config/stellar';
import { updateCampaign } from '@/lib/supabase/queries/campaigns';
import { updateRecipient } from '@/lib/supabase/queries/recipients';

/** Stroops per unit — Stellar amounts carry 7 decimal places. */
const STROOPS_PER_UNIT = 10_000_000n;

export interface RegistryRecipient {
  id: string;
  wallet_address: string | null;
  amount: string | null;
  claim_link_token: string;
}

export interface RegistryMirrorInput {
  campaignId: string;
  organizerPublicKey: string;
  name: string;
  defaultAmount: string;
  totalPool: string;
  deadline: Date;
  recipients: RegistryRecipient[];
  signTransaction: (xdr: string) => Promise<string>;
  /** Called before each wallet prompt so the UI can explain what is being signed. */
  onProgress?: (message: string) => void;
}

/** Converts a decimal string amount to the contract's i128 stroop representation. */
function toStroops(amount: string): bigint {
  const [whole, fraction = ''] = amount.trim().split('.');
  const paddedFraction = (fraction + '0000000').slice(0, 7);
  return BigInt(whole || '0') * STROOPS_PER_UNIT + BigInt(paddedFraction || '0');
}

/** SHA-256 of the claim token, hex-encoded. The registry never sees the token. */
export async function hashClaimToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Mirrors a campaign onto the Soroban registry.
 *
 * The registry is a proof layer, not a source of truth: Supabase already holds
 * everything the UI needs. Callers are expected to treat a rejection here as
 * cosmetic — the payout itself is settled by classic Stellar primitives and
 * must not be blocked by a contract hiccup.
 *
 * Ordering is fixed by the contract: recipients can only be registered while
 * the campaign is Draft, and balances can only be recorded once it is Active.
 */
export class RegistryService {
  static get isEnabled(): boolean {
    return CONTRACTS_ENABLED;
  }

  static async mirrorCampaign(input: RegistryMirrorInput): Promise<bigint | null> {
    if (!CONTRACTS_ENABLED) return null;

    const {
      campaignId,
      organizerPublicKey,
      recipients,
      signTransaction,
      onProgress,
    } = input;

    // ── 1. create_campaign ────────────────────────────────────────────────
    onProgress?.('Registering campaign on-chain...');

    const createXdr = await buildCreateRegistryCampaignTx(organizerPublicKey, {
      organizer: organizerPublicKey,
      name: input.name,
      assetContractId: USDC_SAC_CONTRACT_ID,
      defaultAmount: toStroops(input.defaultAmount || '0'),
      totalPool: toStroops(input.totalPool || '0'),
      deadline: BigInt(Math.floor(input.deadline.getTime() / 1000)),
    });

    const created = await submitRegistryTx(await signTransaction(createXdr));
    const registryCampaignId = BigInt(created.returnValue as string | number | bigint);

    await updateCampaign(campaignId, {
      registry_contract_id: RERAIL_REGISTRY_CONTRACT_ID,
      registry_campaign_id: Number(registryCampaignId),
      registry_create_tx_hash: created.hash,
    });

    // ── 2. register_recipient, one signature each while still Draft ───────
    const registrable = recipients.filter((r) => r.wallet_address);

    for (const [index, recipient] of registrable.entries()) {
      onProgress?.(`Registering recipient ${index + 1} of ${registrable.length}...`);

      const claimTokenHash = await hashClaimToken(recipient.claim_link_token);

      const registerXdr = await buildRegisterRegistryRecipientTx(organizerPublicKey, {
        organizer: organizerPublicKey,
        campaignId: registryCampaignId,
        recipient: recipient.wallet_address as string,
        amount: toStroops(recipient.amount || input.defaultAmount || '0'),
        claimTokenHash,
      });

      const registered = await submitRegistryTx(await signTransaction(registerXdr));

      await updateRecipient(recipient.id, {
        claim_token_hash: claimTokenHash,
        registry_status: 'pending',
        registry_tx_hash: registered.hash,
      });
    }

    // ── 3. activate_campaign — required before balances can be recorded ───
    onProgress?.('Activating campaign on-chain...');

    const activateXdr = await buildActivateRegistryCampaignTx(
      organizerPublicKey,
      organizerPublicKey,
      registryCampaignId,
    );

    await submitRegistryTx(await signTransaction(activateXdr));

    return registryCampaignId;
  }
}
