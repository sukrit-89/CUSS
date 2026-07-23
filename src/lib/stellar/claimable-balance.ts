import {
  Asset,
  Claimant,
  Operation,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import { getHorizonServer } from '@/lib/stellar/client';
import {
  NETWORK_PASSPHRASE,
  BASE_FEE,
  TX_TIMEOUT_SECONDS,
  MAX_OPS_PER_TX,
} from '@/config/constants';
import {
  recipientPredicate,
  organizerReclaimPredicate,
  unconditionalPredicate,
} from '@/lib/stellar/predicates';

/** Input for a single claimable balance in a batch */
export interface CreateClaimableBalanceInput {
  recipientPublicKey: string;
  amount: string;
  deadlineSeconds?: number;
}

/**
 * Builds one or more transactions containing createClaimableBalance operations
 * for a batch of recipients. Splits into multiple TXs if > MAX_OPS_PER_TX.
 *
 * @param organizerPublicKey - Organiser's Stellar public key (source account)
 * @param asset - The asset to lock (e.g. USDC)
 * @param inputs - Array of per-recipient balance params
 * @returns Array of unsigned transaction XDR strings (ready for Freighter signing)
 */
export async function buildCreateClaimableBalanceTx(
  organizerPublicKey: string,
  asset: Asset,
  inputs: CreateClaimableBalanceInput[],
): Promise<string[]> {
  const server = getHorizonServer();
  const organizerAccount = await server.loadAccount(organizerPublicKey);

  const transactions: string[] = [];

  for (let i = 0; i < inputs.length; i += MAX_OPS_PER_TX) {
    const batch = inputs.slice(i, i + MAX_OPS_PER_TX);

    const builder = new TransactionBuilder(organizerAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    }).setTimeout(TX_TIMEOUT_SECONDS);

    for (const input of batch) {
      let recipPred: xdr.ClaimPredicate;
      let organizerPred: xdr.ClaimPredicate | undefined;

      if (input.deadlineSeconds) {
        recipPred = recipientPredicate(input.deadlineSeconds);
        organizerPred = organizerReclaimPredicate(input.deadlineSeconds);
      } else {
        recipPred = unconditionalPredicate();
      }

      const claimants = [new Claimant(input.recipientPublicKey, recipPred)];

      if (organizerPred) {
        claimants.push(new Claimant(organizerPublicKey, organizerPred));
      }

      builder.addOperation(
        Operation.createClaimableBalance({
          asset,
          amount: input.amount,
          claimants,
        }),
      );
    }

    const tx = builder.build();
    transactions.push(tx.toXDR());
  }

  return transactions;
}
