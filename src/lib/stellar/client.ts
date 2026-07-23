import { Horizon } from '@stellar/stellar-sdk';
import { HORIZON_URL } from '@/config/constants';

let horizonInstance: Horizon.Server | null = null;

/**
 * Gets a singleton instance of the Horizon server client.
 */
export function getHorizonServer(): Horizon.Server {
  if (!horizonInstance) {
    horizonInstance = new Horizon.Server(HORIZON_URL);
  }
  return horizonInstance;
}
