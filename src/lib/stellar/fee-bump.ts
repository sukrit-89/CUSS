import { TransactionBuilder, Operation } from '@stellar/stellar-sdk';
import { BASE_FEE, NETWORK_PASSPHRASE, TX_TIMEOUT_SECONDS } from '@/config/constants';
import { getHorizonServer } from '@/lib/stellar/client';

/**
 * Builds the inner claimClaimableBalance transaction for a recipient.
 * @param recipientPublicKey The public key of the recipient claiming the balance.
 * @param balanceId The ID of the claimable balance to claim.
 * @returns The unsigned inner transaction XDR.
 */
export async function buildClaimInnerTransaction(
  recipientPublicKey: string,
  balanceId: string
): Promise<string> {
  const server = getHorizonServer();
  const recipientAccount = await server.loadAccount(recipientPublicKey);
  
  const builder = new TransactionBuilder(recipientAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  }).setTimeout(TX_TIMEOUT_SECONDS);
  
  builder.addOperation(
    Operation.claimClaimableBalance({
      balanceId,
    })
  );
  
  return builder.build().toXDR();
}
