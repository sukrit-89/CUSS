// ---------------------------------------------------------------------------
// ReRail — Stellar SDK configuration
// ---------------------------------------------------------------------------
// Pre-configured Asset instances and Horizon server factory.
// Import from '@/config/stellar' for ready-to-use Stellar objects.
// ---------------------------------------------------------------------------

import { Asset } from '@stellar/stellar-sdk';
import { USDC_ASSET_CODE, USDC_ISSUER } from './constants';

/**
 * Pre-configured USDC asset for the active network.
 * Used across claimable balance creation, trustline setup, etc.
 */
export const USDC_ASSET = new Asset(USDC_ASSET_CODE, USDC_ISSUER);
