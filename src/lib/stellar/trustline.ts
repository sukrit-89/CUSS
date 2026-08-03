import { Operation, Asset, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import { getHorizonServer } from '@/lib/stellar/client';
import {
  BASE_FEE,
  NETWORK_PASSPHRASE,
  TX_TIMEOUT_SECONDS,
} from '@/config/constants';

/**
 * Builds a changeTrust operation.
 * @param asset The asset to trust.
 * @param source Optional source account override.
 */
export function buildChangeTrustOp(
  asset: Asset,
  source?: string,
): xdr.Operation<Operation.ChangeTrust> {
  return Operation.changeTrust({
    asset,
    source,
  });
}

/**
 * Checks if an account has a trustline for a specific asset.
 * @param publicKey The public key of the account.
 * @param asset The asset to check.
 */
export async function hasTrustline(publicKey: string, asset: Asset): Promise<boolean> {
  const server = getHorizonServer();
  const account = await server.loadAccount(publicKey);
  
  return account.balances.some((balance) => {
    if ('asset_code' in balance && 'asset_issuer' in balance) {
      return balance.asset_code === asset.getCode() && balance.asset_issuer === asset.getIssuer();
    }
    return false;
  });
}

/**
 * Builds the unsigned inner transaction a recipient signs to open a trustline.
 * The recipient pays nothing — /api/trustline/[token]/execute fee-bumps it.
 *
 * @param recipientPublicKey The recipient adding the trustline.
 * @param asset The asset to trust.
 */
export async function buildTrustlineInnerTransaction(
  recipientPublicKey: string,
  asset: Asset,
): Promise<string> {
  const server = getHorizonServer();
  const recipientAccount = await server.loadAccount(recipientPublicKey);

  return new TransactionBuilder(recipientAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(buildChangeTrustOp(asset))
    .setTimeout(TX_TIMEOUT_SECONDS)
    .build()
    .toXDR();
}
