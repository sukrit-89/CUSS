import { create } from 'zustand';
import type { ISupportedWallet } from '@creit.tech/stellar-wallets-kit';
import { NETWORK_PASSPHRASE } from '@/config/constants';
import { initWalletKit, StellarWalletsKit } from '@/lib/stellar/wallet-kit';

interface WalletState {
  publicKey: string | null;
  isConnected: boolean;
  /** True when at least one supported wallet is installed / reachable. */
  isWalletAvailable: boolean;
  availableWallets: ISupportedWallet[];
  isChecking: boolean;
  error: string | null;
  /** Refreshes the installed-wallet list and restores an existing session. */
  checkWallets: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction: (xdr: string) => Promise<string>;
}

export const useWalletStore = create<WalletState>((set) => ({
  publicKey: null,
  isConnected: false,
  isWalletAvailable: false,
  availableWallets: [],
  isChecking: false,
  error: null,

  checkWallets: async () => {
    initWalletKit();
    set({ isChecking: true, error: null });

    try {
      const wallets = await StellarWalletsKit.refreshSupportedWallets();
      const available = wallets.filter((wallet) => wallet.isAvailable);

      set({
        availableWallets: wallets,
        isWalletAvailable: available.length > 0,
      });

      // A previously connected wallet keeps its address in kit storage, so the
      // session survives a page reload without prompting the user again.
      try {
        const { address } = await StellarWalletsKit.getAddress();
        if (address) set({ publicKey: address, isConnected: true });
      } catch {
        // No active session — expected on first visit.
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Could not read installed wallets.' });
    } finally {
      set({ isChecking: false });
    }
  },

  connect: async () => {
    initWalletKit();
    set({ error: null });

    try {
      const { address } = await StellarWalletsKit.authModal();
      set({ publicKey: address, isConnected: !!address });
    } catch (err) {
      // A dismissed modal is a normal outcome, not a failure worth surfacing.
      const message = err instanceof Error ? err.message : String(err);
      if (!/clos|cancel|reject/i.test(message)) {
        set({ error: message });
      }
    }
  },

  disconnect: async () => {
    try {
      await StellarWalletsKit.disconnect();
    } finally {
      set({ publicKey: null, isConnected: false });
    }
  },

  signTransaction: async (xdr) => {
    initWalletKit();
    const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    return signedTxXdr;
  },
}));
