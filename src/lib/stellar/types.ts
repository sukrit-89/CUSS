// ---------------------------------------------------------------------------
// ReRail — Stellar-specific TypeScript types
// ---------------------------------------------------------------------------

/** Stellar network identifier */
export type StellarNetwork = 'TESTNET' | 'PUBLIC';

/** Parameters for creating a single claimable balance */
export interface ClaimableBalanceParams {
  amount: string;
  assetCode: string;
  assetIssuer: string;
  recipientPublicKey: string;
  sponsorPublicKey: string;
  deadlineSeconds?: number;
}

/** Parameters for wrapping a transaction in a fee bump */
export interface FeeBumpParams {
  innerTxXdr: string;
  feePayerPublicKey: string;
  baseFee: string;
}

/** Parameters for sponsored account creation */
export interface SponsoredAccountParams {
  sponsorPublicKey: string;
  newAccountPublicKey: string;
  startingBalance: string;
}

/** Result of a single item in a batch operation */
export interface BatchResult<T> {
  success: boolean;
  item: T;
  error?: string;
}

/** Wrapper around a Stellar Horizon transaction response */
export interface TransactionResult {
  successful: boolean;
  hash: string;
  ledger?: number;
  envelopeXdr?: string;
  resultXdr?: string;
  resultMetaXdr?: string;
}
