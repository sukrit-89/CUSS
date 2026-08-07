import { Operation, Transaction, TransactionBuilder } from '@stellar/stellar-sdk';
import {
  BASE_FEE,
  MAX_OPS_PER_TX,
  NETWORK_PASSPHRASE,
  RECIPIENT_STATUS,
  TX_TIMEOUT_SECONDS,
  TX_TYPE,
} from '@/config/constants';
import { getHorizonServer } from '@/lib/stellar';
import { getRecipientsByCampaign, updateRecipient } from '@/lib/supabase/queries/recipients';
import { updateCampaignStatus } from '@/lib/supabase/queries/campaigns';
import { createTransaction } from '@/lib/supabase/queries/transactions';

export interface ReclaimResult {
  reclaimed: number;
  txHashes: string[];
}

/**
 * Reclaims unclaimed balances after a campaign's deadline.
 *
 * The organizer is the second claimant on every balance, gated by
 * `not(before deadline)`. That means Stellar itself refuses the reclaim before
 * the deadline — this service cannot take funds back early even if asked to.
 */
export class ReclaimService {
  static async reclaimExpired(
    campaignId: string,
    organizerPublicKey: string,
    signTransaction: (xdr: string) => Promise<string>,
  ): Promise<ReclaimResult> {
    const recipients = await getRecipientsByCampaign(campaignId);

    const reclaimable = recipients.filter(
      (recipient) =>
        recipient.claimable_balance_id &&
        recipient.status !== RECIPIENT_STATUS.CLAIMED &&
        recipient.status !== RECIPIENT_STATUS.CLAIMING,
    );

    if (reclaimable.length === 0) {
      throw new Error('There is nothing left to reclaim on this campaign.');
    }

    const server = getHorizonServer();
    const txHashes: string[] = [];
    let reclaimed = 0;

    for (let i = 0; i < reclaimable.length; i += MAX_OPS_PER_TX) {
      const batch = reclaimable.slice(i, i + MAX_OPS_PER_TX);

      // Reloaded per batch so the sequence number is correct after each submit.
      const account = await server.loadAccount(organizerPublicKey);
      const builder = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      }).setTimeout(TX_TIMEOUT_SECONDS);

      for (const recipient of batch) {
        builder.addOperation(
          Operation.claimClaimableBalance({
            balanceId: recipient.claimable_balance_id as string,
          }),
        );
      }

      const signedXdr = await signTransaction(builder.build().toXDR());
      const result = await server.submitTransaction(
        new Transaction(signedXdr, NETWORK_PASSPHRASE),
      );

      if (!result.successful) {
        throw new Error(`Stellar rejected the reclaim transaction (${result.hash}).`);
      }

      txHashes.push(result.hash);

      // Only mark rows expired once the ledger has accepted the reclaim, so a
      // failed batch never leaves a still-claimable link marked as expired.
      for (const recipient of batch) {
        await updateRecipient(recipient.id, { status: RECIPIENT_STATUS.EXPIRED });
        await createTransaction({
          campaign_id: campaignId,
          recipient_id: recipient.id,
          tx_hash: result.hash,
          tx_type: TX_TYPE.RECLAIM,
        });
        reclaimed += 1;
      }
    }

    await updateCampaignStatus(campaignId, 'expired');

    return { reclaimed, txHashes };
  }
}
