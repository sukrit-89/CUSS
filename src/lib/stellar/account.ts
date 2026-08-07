import { Asset } from '@stellar/stellar-sdk';
import { getHorizonServer } from '@/lib/stellar/client';

/**
 * Loads an account from the Horizon server.
 * @param publicKey The public key of the account.
 */
export async function loadAccount(publicKey: string) {
  const server = getHorizonServer();
  return await server.loadAccount(publicKey);
}

/**
 * Checks if an account exists on the network.
 * @param publicKey The public key to check.
 */
export async function accountExists(publicKey: string): Promise<boolean> {
  try {
    const server = getHorizonServer();
    await server.loadAccount(publicKey);
    return true;
  } catch (error: any) {
    if (error?.response?.status === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Reads an account's balance for a given asset.
 *
 * Returns `null` when the account does not exist, and `'0'` when the account
 * exists but holds no trustline for the asset — the caller needs to tell those
 * two cases apart to give the organizer a useful funding error.
 */
export async function getAssetBalance(
  publicKey: string,
  asset: Asset,
): Promise<string | null> {
  try {
    const account = await loadAccount(publicKey);
    const balances = account.balances as unknown as Array<Record<string, string>>;

    if (asset.isNative()) {
      return balances.find((b) => b.asset_type === 'native')?.balance ?? '0';
    }

    const match = balances.find(
      (b) => b.asset_code === asset.getCode() && b.asset_issuer === asset.getIssuer(),
    );

    return match?.balance ?? '0';
  } catch (error: any) {
    if (error?.response?.status === 404) return null;
    throw error;
  }
}
