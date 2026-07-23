import { Operation, Asset } from '@stellar/stellar-sdk';
import { getHorizonServer } from '@/lib/stellar/client';

/**
 * Builds a changeTrust operation.
 * @param asset The asset to trust.
 * @param source Optional source account override.
 */
export function buildChangeTrustOp(asset: Asset, source?: string): Operation {
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
