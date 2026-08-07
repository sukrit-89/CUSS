// ---------------------------------------------------------------------------
// ReRail — Stellar Wallets Kit bootstrap
// ---------------------------------------------------------------------------
// One place where the multi-wallet abstraction is configured. Everything else
// in the app talks to the wallet through `@/stores/wallet.store`.
// ---------------------------------------------------------------------------

import {
  Networks as KitNetworks,
  StellarWalletsKit,
} from '@creit.tech/stellar-wallets-kit';
import { defaultModules } from '@creit.tech/stellar-wallets-kit/modules/utils';
import { FREIGHTER_ID } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { NETWORK_PASSPHRASE } from '@/config/constants';

/** Maps our passphrase constant onto the kit's network enum. */
function kitNetwork(): KitNetworks {
  return NETWORK_PASSPHRASE === KitNetworks.PUBLIC
    ? KitNetworks.PUBLIC
    : KitNetworks.TESTNET;
}

let initialized = false;

/**
 * Initialises the kit exactly once.
 *
 * The kit registers custom elements and reads browser storage, so it must not
 * run during module evaluation on the server or in tests.
 */
export function initWalletKit(): void {
  if (initialized || typeof window === 'undefined') return;

  StellarWalletsKit.init({
    modules: defaultModules(),
    network: kitNetwork(),
    selectedWalletId: FREIGHTER_ID,
    authModal: { showInstallLabel: true },
  });

  initialized = true;
}

export { StellarWalletsKit, FREIGHTER_ID };
