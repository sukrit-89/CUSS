// ---------------------------------------------------------------------------
// ReRail — Stellar SDK configuration
// ---------------------------------------------------------------------------
// Pre-configured Asset instances and Horizon server factory.
// Import from '@/config/stellar' for ready-to-use Stellar objects.
// ---------------------------------------------------------------------------

import { Asset } from '@stellar/stellar-sdk';
import { NETWORK_PASSPHRASE, USDC_ASSET_CODE, USDC_ISSUER } from './constants';

/**
 * Pre-configured USDC asset for the active network.
 */
export const USDC_ASSET = new Asset(USDC_ASSET_CODE, USDC_ISSUER);

/**
 * Circle's official Testnet EURC issuer address.
 */
export const EURC_ISSUER = 'GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO';
export const EURC_ASSET = new Asset('EURC', EURC_ISSUER);

/**
 * Native XLM asset.
 */
export const XLM_ASSET = Asset.native();

export interface AssetOption {
  code: string;
  name: string;
  symbol: string;
  asset: Asset;
  isNative: boolean;
  issuer: string;
}

export const SUPPORTED_ASSETS: AssetOption[] = [
  {
    code: 'USDC',
    name: 'USD Coin',
    symbol: '$',
    asset: USDC_ASSET,
    isNative: false,
    issuer: USDC_ISSUER,
  },
  {
    code: 'EURC',
    name: 'Euro Coin',
    symbol: '€',
    asset: EURC_ASSET,
    isNative: false,
    issuer: EURC_ISSUER,
  },
  {
    code: 'XLM',
    name: 'Stellar Lumens',
    symbol: '𝄌',
    asset: XLM_ASSET,
    isNative: true,
    issuer: 'native',
  },
];

export function getAssetByCode(code: string, issuer?: string | null): Asset {
  if (code === 'XLM' || issuer === 'native') {
    return Asset.native();
  }
  if (code === 'EURC') {
    return EURC_ASSET;
  }
  if (issuer && issuer !== 'native' && issuer !== USDC_ISSUER) {
    return new Asset(code, issuer);
  }
  return USDC_ASSET;
}

/**
 * The Stellar Asset Contract address for USDC.
 */
export const USDC_SAC_CONTRACT_ID = USDC_ASSET.contractId(NETWORK_PASSPHRASE);

