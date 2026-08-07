/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_HORIZON_URL?: string;
  readonly VITE_NETWORK_PASSPHRASE?: string;
  readonly VITE_USDC_ISSUER?: string;
  readonly VITE_USDC_ASSET_CODE?: string;
  readonly VITE_NETWORK?: 'TESTNET' | 'PUBLIC';
  readonly VITE_SOROBAN_RPC_URL?: string;
  readonly VITE_RERAIL_REGISTRY_CONTRACT_ID?: string;
  readonly VITE_EXPLORER_TX_BASE_URL?: string;
  readonly VITE_REFLECTOR_ORACLE_CONTRACT_ID?: string;
  readonly VITE_BLEND_USDC_POOL_ID?: string;
  readonly VITE_SOROSWAP_API_URL?: string;
  readonly VITE_SOROSWAP_API_KEY?: string;
  readonly VITE_CLAIM_LINK_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
