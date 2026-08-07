// ---------------------------------------------------------------------------
// ReRail — Reflector Oracle (read-only)
// ---------------------------------------------------------------------------
// Reads a live USD price from a Reflector oracle contract via Soroban
// simulation. Purely informational: every failure degrades to `null` so a
// price card can never break a page.
// ---------------------------------------------------------------------------

import {
  Account,
  Contract,
  nativeToScVal,
  scValToNative,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import {
  NETWORK_PASSPHRASE,
  SOROBAN_INCLUSION_FEE,
  TX_TIMEOUT_SECONDS,
  USDC_ASSET_CODE,
} from '@/config/constants';
import { getSorobanServer } from '@/lib/stellar';

export const REFLECTOR_ORACLE_CONTRACT_ID =
  import.meta.env.VITE_REFLECTOR_ORACLE_CONTRACT_ID ?? '';

export const REFLECTOR_ENABLED = REFLECTOR_ORACLE_CONTRACT_ID.length > 0;

/**
 * Simulation needs a source account, but never a real one: nothing is
 * submitted and no signature is produced. Using a fixed all-zero account keeps
 * the call independent of whoever happens to be connected.
 */
const SIMULATION_SOURCE = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { price: number; fetchedAt: number }>();

/** Reflector's `Asset` enum: `Other(Symbol)` for ticker-based feeds. */
function assetScVal(code: string): xdr.ScVal {
  return xdr.ScVal.scvVec([
    nativeToScVal('Other', { type: 'symbol' }),
    nativeToScVal(code, { type: 'symbol' }),
  ]);
}

async function readDecimals(contract: Contract): Promise<number> {
  const value = await simulate(contract, 'decimals', []);
  return typeof value === 'number' ? value : 14;
}

async function simulate(
  contract: Contract,
  fn: string,
  args: xdr.ScVal[],
): Promise<unknown> {
  const server = getSorobanServer();

  const tx = new TransactionBuilder(new Account(SIMULATION_SOURCE, '0'), {
    fee: SOROBAN_INCLUSION_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(fn, ...args))
    .setTimeout(TX_TIMEOUT_SECONDS)
    .build();

  const result = await server.simulateTransaction(tx);

  if ('error' in result && result.error) {
    throw new Error(String(result.error));
  }

  const retval = (result as { result?: { retval: xdr.ScVal } }).result?.retval;
  if (!retval) throw new Error(`Reflector returned no value for ${fn}`);

  return scValToNative(retval);
}

/**
 * Returns the USD price for an asset ticker, or `null` when the oracle is not
 * configured or unreachable.
 */
export async function getPrice(assetCode = USDC_ASSET_CODE): Promise<number | null> {
  if (!REFLECTOR_ENABLED) return null;

  const cached = cache.get(assetCode);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.price;
  }

  try {
    const contract = new Contract(REFLECTOR_ORACLE_CONTRACT_ID);

    const [priceData, decimals] = await Promise.all([
      simulate(contract, 'lastprice', [assetScVal(assetCode)]),
      readDecimals(contract),
    ]);

    // `lastprice` returns Option<PriceData { price: i128, timestamp: u64 }>.
    const raw = (priceData as { price?: bigint } | null)?.price;
    if (raw === undefined || raw === null) return null;

    const price = Number(raw) / 10 ** decimals;
    cache.set(assetCode, { price, fetchedAt: Date.now() });
    return price;
  } catch (err) {
    console.warn('Reflector price unavailable:', err);
    return null;
  }
}

/** Converts a token amount into USD using the oracle, or `null` if unavailable. */
export async function toUsd(amount: number, assetCode = USDC_ASSET_CODE) {
  const price = await getPrice(assetCode);
  return price === null ? null : amount * price;
}
