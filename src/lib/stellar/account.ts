import { Operation, Asset } from '@stellar/stellar-sdk';
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
 * Funds an account with the testnet friendbot.
 *
 * Testnet-only convenience for claim-page state 2 — on pubnet the recipient
 * has to fund the account themselves.
 */
export async function fundWithFriendbot(publicKey: string): Promise<void> {
  const response = await fetch(
    `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`,
  );

  if (!response.ok) {
    // Friendbot 400s when the account already exists, which is not a failure
    // from the caller's point of view.
    if (await accountExists(publicKey)) return;
    throw new Error('Friendbot could not fund this account. Try again shortly.');
  }
}

/**
 * Builds operation array for sponsored account + USDC trustline creation.
 * @param sponsorPublicKey The sponsor's public key.
 * @param newAccountPublicKey The new account's public key.
 * @param startingBalance The native asset starting balance.
 * @param asset The asset (e.g. USDC) to create a trustline for.
 */
export function buildSponsoredAccountOps(
  sponsorPublicKey: string,
  newAccountPublicKey: string,
  startingBalance: string,
  asset: Asset
): Operation[] {
  return [
    Operation.beginSponsoringFutureReserves({
      sponsoredId: newAccountPublicKey,
      source: sponsorPublicKey,
    }),
    Operation.createAccount({
      destination: newAccountPublicKey,
      startingBalance,
      source: sponsorPublicKey,
    }),
    Operation.changeTrust({
      asset,
      source: newAccountPublicKey,
    }),
    Operation.endSponsoringFutureReserves({
      source: newAccountPublicKey,
    }),
  ];
}
