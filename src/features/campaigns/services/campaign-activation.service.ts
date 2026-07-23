import { Asset } from '@stellar/stellar-sdk';
import { USDC_ASSET } from '@/config/stellar';
import { DEFAULT_CLAIM_EXPIRY_SECONDS, TX_TYPE } from '@/config/constants';
import { buildCreateClaimableBalanceTx } from '@/lib/stellar/claimable-balance';
import { getRecipientsByCampaign } from '@/lib/supabase/queries/recipients';
import {
  getCampaignById,
  updateCampaignStatus,
} from '@/lib/supabase/queries/campaigns';
import type { Database } from '@/lib/supabase/database.types';

type RecipientRow = Database['public']['Tables']['recipients']['Row'];

export interface CampaignActivationDraft {
  campaignId: string;
  unsignedTransactionXdrs: string[];
  recipients: RecipientRow[];
  transactionType: typeof TX_TYPE.CREATE_BALANCE;
}

export interface BuildCampaignActivationInput {
  campaignId: string;
  organizerPublicKey: string;
  asset?: Asset;
  deadlineSeconds?: number;
}

/**
 * Builds the unsigned native Stellar transactions needed to activate a campaign.
 *
 * This intentionally stays contract-free for the current skeleton. It uses
 * Stellar claimable balances directly and returns XDRs for the organizer to
 * sign in-browser later.
 */
export class CampaignActivationService {
  static async buildActivationTransactions(
    input: BuildCampaignActivationInput,
  ): Promise<CampaignActivationDraft> {
    const [campaign, recipients] = await Promise.all([
      getCampaignById(input.campaignId),
      getRecipientsByCampaign(input.campaignId),
    ]);
    const claimableRecipients = recipients.filter(
      (recipient) =>
        recipient.status === 'pending' &&
        recipient.wallet_address &&
        !recipient.claimable_balance_id,
    );

    if (claimableRecipients.length === 0) {
      throw new Error('No pending recipients with wallet addresses to activate.');
    }

    const unsignedTransactionXdrs = await buildCreateClaimableBalanceTx(
      input.organizerPublicKey,
      input.asset ?? USDC_ASSET,
      claimableRecipients.map((recipient) => ({
        recipientPublicKey: recipient.wallet_address as string,
        amount: recipient.amount ?? campaign.amount_per_recipient,
        deadlineSeconds: input.deadlineSeconds ?? DEFAULT_CLAIM_EXPIRY_SECONDS,
      })),
    );

    return {
      campaignId: input.campaignId,
      unsignedTransactionXdrs,
      recipients: claimableRecipients,
      transactionType: TX_TYPE.CREATE_BALANCE,
    };
  }

  static async markCampaignActive(campaignId: string) {
    return updateCampaignStatus(campaignId, 'active');
  }
}
