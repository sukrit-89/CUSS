import {
  buildActivateRegistryCampaignTx,
  buildCreateAndRegisterTx,
  buildCreateRegistryCampaignTx,
  buildRegisterRecipientsTx,
  submitRegistryTx,
  MAX_REGISTRY_BATCH,
  type RegistryBatchRecipient,
} from '@/lib/stellar';
import { CONTRACTS_ENABLED, RERAIL_REGISTRY_CONTRACT_ID } from '@/config/contracts';
import { USDC_SAC_CONTRACT_ID } from '@/config/stellar';
import { updateCampaign } from '@/lib/supabase/queries/campaigns';
import { updateRecipient } from '@/lib/supabase/queries/recipients';
import { normalizeStellarAmount } from '@/lib/utils/validation';

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
  const normalized = normalizeStellarAmount(amount);
  const [whole, fraction = ''] = normalized.split('.');
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
 * Recipients are registered in batches. A payout that fits in one batch costs
 * the organizer a single signature; larger ones cost one per chunk plus one to
 * activate, rather than one per recipient.
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

    // Only recipients with a wallet address can be claimants on chain.
    const registrable = recipients.filter((recipient) => recipient.wallet_address);

    if (registrable.length === 0) return null;

    // Hashing is done up front so a failure cannot leave half the batch
    // registered on chain with no matching hash in Supabase.
    const entries = await Promise.all(
      registrable.map(async (recipient) => ({
        recipient,
        batch: {
          recipient: recipient.wallet_address as string,
          amount: toStroops(recipient.amount || input.defaultAmount || '0'),
          claimTokenHash: await hashClaimToken(recipient.claim_link_token),
        } satisfies RegistryBatchRecipient,
      })),
    );

    const chunks: (typeof entries)[] = [];
    for (let i = 0; i < entries.length; i += MAX_REGISTRY_BATCH) {
      chunks.push(entries.slice(i, i + MAX_REGISTRY_BATCH));
    }

    // One chunk: a single create_and_register call. Otherwise: create, one call
    // per chunk, then activate.
    const totalSignatures = chunks.length === 1 ? 1 : chunks.length + 2;
    const describe = (index: number) =>
      `Recording campaign on-chain (signature ${index} of ${totalSignatures})...`;

    // ── 1. Create + register the first chunk in one call ──────────────────
    onProgress?.(describe(1));

    const [firstChunk, ...restChunks] = chunks;

    // A single-chunk payout is created, registered, and activated by one
    // invocation. Multi-chunk payouts must stay Draft until every recipient is
    // registered, so they take the create-then-append path instead.
    const createXdr =
      chunks.length === 1
        ? await buildCreateAndRegisterTx(
            organizerPublicKey,
            {
              organizer: organizerPublicKey,
              name: input.name,
              assetContractId: USDC_SAC_CONTRACT_ID,
              defaultAmount: toStroops(input.defaultAmount || '0'),
              totalPool: toStroops(input.totalPool || '0'),
              deadline: BigInt(Math.floor(input.deadline.getTime() / 1000)),
            },
            firstChunk.map((entry) => entry.batch),
          )
        : await buildCreateRegistryCampaignTx(organizerPublicKey, {
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

    const recordChunk = async (chunk: typeof entries, txHash: string) => {
      await Promise.all(
        chunk.map((entry) =>
          updateRecipient(entry.recipient.id, {
            claim_token_hash: entry.batch.claimTokenHash,
            registry_status: 'pending',
            registry_tx_hash: txHash,
          }),
        ),
      );
    };

    if (chunks.length === 1) {
      await recordChunk(firstChunk, created.hash);
      return registryCampaignId;
    }

    // ── 2. Remaining chunks, one signature each ───────────────────────────
    const pendingChunks = [firstChunk, ...restChunks];

    for (const [index, chunk] of pendingChunks.entries()) {
      onProgress?.(describe(index + 2));

      const registerXdr = await buildRegisterRecipientsTx(
        organizerPublicKey,
        organizerPublicKey,
        registryCampaignId,
        chunk.map((entry) => entry.batch),
      );

      const registered = await submitRegistryTx(await signTransaction(registerXdr));
      await recordChunk(chunk, registered.hash);
    }

    // ── 3. Activate — balances can only be recorded once the campaign is Active
    onProgress?.(describe(totalSignatures));

    const activateXdr = await buildActivateRegistryCampaignTx(
      organizerPublicKey,
      organizerPublicKey,
      registryCampaignId,
    );

    await submitRegistryTx(await signTransaction(activateXdr));

    return registryCampaignId;
  }
}
