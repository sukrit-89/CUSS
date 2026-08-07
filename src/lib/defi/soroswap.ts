// ---------------------------------------------------------------------------
// ReRail — SoroSwap quotes (read-only)
// ---------------------------------------------------------------------------
// Step 2 of campaign creation shows organizers what their XLM is worth in USDC.
//
// Executing the swap is NOT implemented, and cannot be until SoroSwap indexes
// testnet: its /health endpoint currently reports zero protocols for testnet
// (`{"testnet": []}`) while mainnet lists soroswap, phoenix, aqua and sdex.
// With no indexed protocol there is no route to quote, let alone execute.
// Organizers fund with USDC directly instead — see the Circle faucet link in
// the wizard.
// ---------------------------------------------------------------------------

import { NETWORK_PASSPHRASE } from '@/config/constants';
import { USDC_SAC_CONTRACT_ID } from '@/config/stellar';

const API_URL = import.meta.env.VITE_SOROSWAP_API_URL ?? 'https://api.soroswap.finance';

const API_KEY = import.meta.env.VITE_SOROSWAP_API_KEY ?? '';

/** SoroSwap keys its routes by network name, not by passphrase. */
const NETWORK =
  NETWORK_PASSPHRASE === 'Public Global Stellar Network ; September 2015'
    ? 'mainnet'
    : 'testnet';

/** How the router addresses native XLM. */
const XLM_CONTRACT_ID = 'native';

/** Stroops per unit — the router takes amounts in stroops. */
const STROOPS_PER_UNIT = 10_000_000;

export type QuoteFailure =
  /** No API key configured, so the router answers 403. */
  | 'not-configured'
  /** The network has no indexed liquidity protocols — testnet today. */
  | 'no-liquidity'
  /** Reachable, but no path between the two assets at this size. */
  | 'no-route';

export interface SwapQuote {
  /** How much USDC the given XLM amount is expected to produce. */
  amountOut: number;
  /** USDC per XLM, derived from the quote. */
  rate: number;
}

export type QuoteResult =
  | { ok: true; quote: SwapQuote }
  | { ok: false; reason: QuoteFailure };

/** True when a quote could even be attempted on the configured network. */
export const SOROSWAP_ENABLED = API_KEY.length > 0;

let cachedProtocols: string[] | null = null;

/**
 * Which liquidity protocols SoroSwap has indexed for the active network.
 *
 * Worth the extra request: it separates "no route for this pair" from "this
 * network has no liquidity at all", and the organizer should not be told to
 * retry in the second case.
 */
async function indexedProtocols(): Promise<string[]> {
  if (cachedProtocols) return cachedProtocols;

  try {
    const res = await fetch(`${API_URL}/health`);
    if (!res.ok) return [];

    const data = await res.json();
    cachedProtocols = data?.status?.indexer?.[NETWORK] ?? [];
    return cachedProtocols ?? [];
  } catch {
    return [];
  }
}

/**
 * Fetches an XLM → USDC quote.
 *
 * Callers treat any failure as "swap unavailable, fund with USDC directly"
 * rather than an error, because the campaign can still be funded without it.
 */
export async function getXlmToUsdcQuote(xlmAmount: number): Promise<QuoteResult> {
  if (!Number.isFinite(xlmAmount) || xlmAmount <= 0) {
    return { ok: false, reason: 'no-route' };
  }

  if (!SOROSWAP_ENABLED) {
    return { ok: false, reason: 'not-configured' };
  }

  const protocols = await indexedProtocols();

  if (protocols.length === 0) {
    return { ok: false, reason: 'no-liquidity' };
  }

  try {
    const res = await fetch(`${API_URL}/quote?network=${NETWORK}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        assetIn: XLM_CONTRACT_ID,
        assetOut: USDC_SAC_CONTRACT_ID,
        amount: String(Math.round(xlmAmount * STROOPS_PER_UNIT)),
        tradeType: 'EXACT_IN',
        protocols,
      }),
    });

    if (!res.ok) return { ok: false, reason: 'no-route' };

    const data = await res.json();

    // The API has shipped several response shapes; accept the common ones and
    // bail out rather than guessing if none match.
    const rawOut =
      data?.amountOut ?? data?.outputAmount ?? data?.trade?.amountOut ?? data?.to?.amount;

    const stroops = typeof rawOut === 'string' ? parseFloat(rawOut) : Number(rawOut);

    if (!Number.isFinite(stroops) || stroops <= 0) {
      return { ok: false, reason: 'no-route' };
    }

    const amountOut = stroops / STROOPS_PER_UNIT;

    return { ok: true, quote: { amountOut, rate: amountOut / xlmAmount } };
  } catch {
    return { ok: false, reason: 'no-route' };
  }
}

/** What the wizard tells the organizer when a quote cannot be produced. */
export function quoteFailureMessage(reason: QuoteFailure): string {
  switch (reason) {
    case 'not-configured':
      return 'Swap quotes need a SoroSwap API key. Fund the treasury with USDC directly.';
    case 'no-liquidity':
      return `SoroSwap has no indexed liquidity on ${NETWORK} yet. Fund the treasury with USDC directly.`;
    case 'no-route':
      return 'No SoroSwap route for this amount right now. Fund the treasury with USDC directly.';
  }
}
