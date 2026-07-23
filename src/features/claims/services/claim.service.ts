import {
  getRecipientWithCampaign,
  updateRecipientStatus,
  type RecipientWithCampaign
} from '@/lib/supabase/queries/recipients';
import { createTransaction } from '@/lib/supabase/queries/transactions';

export interface ClaimResolveResponse {
  recipient: RecipientWithCampaign;
  isValid: boolean;
  message?: string;
}

/**
 * Service for handling recipient claims.
 */
export class ClaimService {
  /**
   * Looks up a recipient by claim token and checks validity.
   * @param token The claim link token
   */
  static async resolveClaimLink(token: string): Promise<ClaimResolveResponse> {
    try {
      const recipient = await getRecipientWithCampaign(token);

      if (recipient.status === 'claimed') {
        return { recipient, isValid: false, message: 'This claim has already been redeemed.' };
      }

      if (recipient.status === 'expired') {
        return { recipient, isValid: false, message: 'This claim link has expired.' };
      }

      const deadline = recipient.campaigns?.deadline;
      if (deadline && new Date(deadline) < new Date()) {
        return { recipient, isValid: false, message: 'The campaign deadline has passed.' };
      }

      return { recipient, isValid: true };
    } catch (error) {
      throw new Error(`Failed to resolve claim link: ${(error as Error).message}`);
    }
  }

  /**
   * Marks a recipient as claimed and logs the transaction.
   * @param recipientId The recipient ID
   * @param txHash The stellar transaction hash
   * @param campaignId The campaign ID
   */
  static async markClaimed(
    recipientId: string,
    txHash: string,
    campaignId: string
  ): Promise<void> {
    const claimedAt = new Date().toISOString();

    await updateRecipientStatus(recipientId, 'claimed', claimedAt);

    await createTransaction({
      recipient_id: recipientId,
      campaign_id: campaignId,
      tx_hash: txHash,
      tx_type: 'claim',
    });
  }
}
