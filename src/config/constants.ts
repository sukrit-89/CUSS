// ---------------------------------------------------------------------------
// ReRail — Centralised Constants
// ---------------------------------------------------------------------------
// No magic strings. Every Stellar address, network config, and status enum
// lives here. Import from '@/config/constants' everywhere.
// ---------------------------------------------------------------------------

// ── Network ──────────────────────────────────────────────────────────────────

export const STELLAR_NETWORK = import.meta.env.VITE_NETWORK ?? 'TESTNET';

export const NETWORK_PASSPHRASE =
  import.meta.env.VITE_NETWORK_PASSPHRASE ?? 'Test SDF Network ; September 2015';

export const HORIZON_URL =
  import.meta.env.VITE_HORIZON_URL ?? 'https://horizon-testnet.stellar.org';

/** Soroban RPC — contract invocations cannot go through Horizon */
export const SOROBAN_RPC_URL =
  import.meta.env.VITE_SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org';

// ── USDC Asset (Testnet) ─────────────────────────────────────────────────────

export const USDC_ASSET_CODE = import.meta.env.VITE_USDC_ASSET_CODE ?? 'USDC';

/**
 * Circle's official Stellar testnet USDC issuer is the default. Mainnet
 * migration is an env change, not a code change.
 */
export const USDC_ISSUER =
  import.meta.env.VITE_USDC_ISSUER ??
  'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

// ── Transaction Defaults ─────────────────────────────────────────────────────

/** Base fee in stroops (100 stroops = 0.00001 XLM) */
export const BASE_FEE = '100';

/** Fee bump multiplier — 10× base gives comfortable headroom */
export const FEE_BUMP_MULTIPLIER = 10;

/**
 * Inclusion fee for Soroban contract invocations, in stroops.
 * Simulation attaches the resource fee on top of this; BASE_FEE alone is too
 * low to get a contract call included.
 */
export const SOROBAN_INCLUSION_FEE = '1000000';

/** Transaction timeout in seconds */
export const TX_TIMEOUT_SECONDS = 30;

/**
 * Base reserve consumed per claimable balance entry, in XLM.
 * Used to warn the organizer about the XLM they need on top of the USDC pool.
 */
export const XLM_RESERVE_PER_BALANCE = 0.5;

// ── External links ───────────────────────────────────────────────────────────

/** Circle's testnet faucet — the easiest way for organizers to get test USDC. */
export const CIRCLE_FAUCET_URL = 'https://faucet.circle.com/';

/** Explorer base URL for transaction links shown to recipients. */
export const EXPLORER_TX_BASE_URL =
  import.meta.env.VITE_EXPLORER_TX_BASE_URL ??
  'https://stellar.expert/explorer/testnet/tx';

/** Looping background video shared by every public (unauthenticated) page. */
export const PUBLIC_BG_VIDEO = '/lv_0_20260723125159.mp4';

/** How often the claim page re-checks the recipient's wallet state. */
export const CLAIM_POLL_INTERVAL_MS = 2000;

// ── Claim Defaults ───────────────────────────────────────────────────────────

/** Default claim expiry: 7 days in seconds */
export const DEFAULT_CLAIM_EXPIRY_SECONDS = 604_800;

/** Maximum recipients per CSV upload (L5 limit) */
export const MAX_RECIPIENTS_PER_UPLOAD = 200;

/** Maximum Stellar operations per transaction */
export const MAX_OPS_PER_TX = 100;

// ── Campaign Status ──────────────────────────────────────────────────────────

export const CAMPAIGN_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
} as const;

export type CampaignStatusValue =
  (typeof CAMPAIGN_STATUS)[keyof typeof CAMPAIGN_STATUS];

// ── Recipient Status ─────────────────────────────────────────────────────────

export const RECIPIENT_STATUS = {
  PENDING: 'pending',
  /** Transient lock held by /api/claim/[token]/execute while a fee bump is in flight */
  CLAIMING: 'claiming',
  CLAIMED: 'claimed',
  EXPIRED: 'expired',
} as const;

export type RecipientStatusValue =
  (typeof RECIPIENT_STATUS)[keyof typeof RECIPIENT_STATUS];

// ── Transaction Types ────────────────────────────────────────────────────────

export const TX_TYPE = {
  CREATE_BALANCE: 'create_balance',
  CLAIM: 'claim',
  RECLAIM: 'reclaim',
  SPONSOR_ACCOUNT: 'sponsor_account',
} as const;

export type TxTypeValue = (typeof TX_TYPE)[keyof typeof TX_TYPE];

// ── Claim Link ───────────────────────────────────────────────────────────────

/** Base URL for claim links — changes per environment */
export const CLAIM_LINK_BASE_URL =
  import.meta.env.VITE_CLAIM_LINK_BASE_URL ??
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5174');
