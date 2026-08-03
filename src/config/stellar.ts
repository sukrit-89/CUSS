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
 * Used across claimable balance creation, trustline setup, etc.
 */
export const USDC_ASSET = new Asset(USDC_ASSET_CODE, USDC_ISSUER);

/**
 * The Stellar Asset Contract address for USDC.
 *
 * Soroban contracts address assets by SAC contract ID, not by classic issuer —
 * the registry's `create_campaign` expects this value, not `USDC_ISSUER`.
 */
export const USDC_SAC_CONTRACT_ID = USDC_ASSET.contractId(NETWORK_PASSPHRASE);
