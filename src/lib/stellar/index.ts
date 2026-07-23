// ---------------------------------------------------------------------------
// ReRail — Stellar library barrel export
// ---------------------------------------------------------------------------
// Import from '@/lib/stellar' for clean, ergonomic access to all Stellar
// SDK utilities, transaction builders, and helpers.
// ---------------------------------------------------------------------------

export { getHorizonServer } from './client';

export {
  buildCreateClaimableBalanceTx,
  type CreateClaimableBalanceInput,
} from './claimable-balance';

export {
  buildFeeBumpTransaction,
  buildClaimInnerTransaction,
} from './fee-bump';

export {
  recipientPredicate,
  organizerReclaimPredicate,
  unconditionalPredicate,
} from './predicates';

export {
  loadAccount,
  accountExists,
  buildSponsoredAccountOps,
} from './account';

export {
  buildChangeTrustOp,
  hasTrustline,
} from './trustline';

export {
  buildCreateRegistryCampaignTx,
  buildRegisterRegistryRecipientTx,
  buildActivateRegistryCampaignTx,
  buildMarkRegistryBalanceCreatedTx,
  buildRecordRegistryClaimTx,
  type RegistryCampaignInput,
  type RegistryRecipientInput,
  type RegistryRecipientBalanceInput,
  type RegistryClaimInput,
} from './registry-contract';

export type {
  StellarNetwork,
  ClaimableBalanceParams,
  FeeBumpParams,
  SponsoredAccountParams,
  BatchResult,
  TransactionResult,
} from './types';
