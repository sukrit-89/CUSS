// ---------------------------------------------------------------------------
// ReRail — Blend Protocol (read-only)
// ---------------------------------------------------------------------------
// ReRail never deposits into Blend. It only reads the current USDC supply APY
// so an organizer can see what unclaimed funds could earn. Everything here is
// best effort: if the pool is unreachable, the UI simply hides the number.
// ---------------------------------------------------------------------------

import { NETWORK_PASSPHRASE, SOROBAN_RPC_URL } from '@/config/constants';
import { USDC_SAC_CONTRACT_ID } from '@/config/stellar';

export const BLEND_USDC_POOL_ID = import.meta.env.VITE_BLEND_USDC_POOL_ID ?? '';

export const BLEND_ENABLED = BLEND_USDC_POOL_ID.length > 0;

export interface BlendSupplySnapshot {
  /** Supply APY as a fraction, e.g. 0.042 for 4.2%. */
  apy: number;
  poolId: string;
}

let cached: { value: BlendSupplySnapshot; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

/**
 * Reads the USDC supply APY from the configured Blend pool.
 *
 * Returns `null` when Blend is not configured or the pool cannot be read —
 * an APY card is informational, so it must never break a page.
 */
export async function getUsdcSupplyApy(): Promise<BlendSupplySnapshot | null> {
  if (!BLEND_ENABLED) return null;

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    // Dynamic import keeps the Blend SDK out of the initial bundle.
    const { PoolV2 } = await import('@blend-capital/blend-sdk');

    const pool = await PoolV2.load(
      { rpc: SOROBAN_RPC_URL, passphrase: NETWORK_PASSPHRASE },
      BLEND_USDC_POOL_ID,
    );

    const reserve = pool.reserves.get(USDC_SAC_CONTRACT_ID);
    if (!reserve) return null;

    const value = { apy: reserve.estSupplyApy, poolId: BLEND_USDC_POOL_ID };
    cached = { value, fetchedAt: Date.now() };
    return value;
  } catch (err) {
    console.warn('Blend APY unavailable:', err);
    return null;
  }
}

/** Projected yield if `amount` USDC stayed unclaimed for `days` at `apy`. */
export function projectYield(amount: number, apy: number, days: number): number {
  return amount * apy * (days / 365);
}
