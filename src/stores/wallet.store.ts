import { create } from 'zustand';
import {
  isConnected as checkIsConnected,
  requestAccess,
  signTransaction as freighterSign,
} from '@stellar/freighter-api';
import { NETWORK_PASSPHRASE } from '@/config/constants';

interface WalletState {
  publicKey: string | null;
  isConnected: boolean;
  isFreighterInstalled: boolean;
  checkFreighter: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTransaction: (xdr: string) => Promise<string>;
}

export const useWalletStore = create<WalletState>((set) => ({
  publicKey: null,
  isConnected: false,
  isFreighterInstalled: false,

  checkFreighter: async () => {
    const result = await checkIsConnected();
    set({ isFreighterInstalled: result.isConnected });
  },

  connect: async () => {
    try {
      const result = await requestAccess();
      const address = result.address;
      set({ publicKey: address, isConnected: !!address });
    } catch (error) {
      console.error('Failed to connect to Freighter:', error);
    }
  },

  disconnect: () => {
    set({ publicKey: null, isConnected: false });
  },

  signTransaction: async (xdr) => {
    try {
      const result = await freighterSign(xdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
      });
      return result.signedTxXdr;
    } catch (error) {
      console.error('Failed to sign transaction:', error);
      throw error;
    }
  },
}));