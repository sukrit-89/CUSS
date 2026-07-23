import { Keypair, TransactionBuilder, Transaction, Operation } from '@stellar/stellar-sdk';
import { BASE_FEE, FEE_BUMP_MULTIPLIER, NETWORK_PASSPHRASE, TX_TIMEOUT_SECONDS } from '@/config/constants';
import { getHorizonServer } from '@/lib/stellar/client';

/**
 * Wraps a signed inner transaction in a fee bump and signs with fee payer.
 * @param innerTxXdr The base64 XDR of the signed inner transaction.
 * @param feePayerSecret The secret key of the fee payer.
 * @returns The signed fee bump transaction XDR.
 */
export function buildFeeBumpTransaction(innerTxXdr: string, feePayerSecret: string): string {
  const innerTx = new Transaction(innerTxXdr, NETWORK_PASSPHRASE);
  const feePayerKeypair = Keypair.fromSecret(feePayerSecret);
  
  const baseFee = innerTx.operations.length * parseInt(BASE_FEE) * FEE_BUMP_MULTIPLIER;
  
  const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
    feePayerKeypair,
    baseFee.toString(),
    innerTx,
    NETWORK_PASSPHRASE
  );
  
  feeBumpTx.sign(feePayerKeypair);
  
  return feeBumpTx.toXDR();
}

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
