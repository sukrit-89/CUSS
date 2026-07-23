import { Claimant, xdr } from '@stellar/stellar-sdk';

/**
 * Builds a predicate allowing a recipient to claim BEFORE the deadline.
 * @param deadlineSeconds - Seconds from balance creation until claim expires
 */
export function recipientPredicate(
  deadlineSeconds: number,
): xdr.ClaimPredicate {
  return Claimant.predicateBeforeRelativeTime(deadlineSeconds.toString());
}

/**
 * Builds a predicate allowing an organiser to reclaim AFTER the deadline.
 * @param deadlineSeconds - Seconds from creation after which organiser can reclaim
 */
export function organizerReclaimPredicate(
  deadlineSeconds: number,
): xdr.ClaimPredicate {
  return Claimant.predicateNot(
    Claimant.predicateBeforeRelativeTime(deadlineSeconds.toString()),
  );
}

/**
 * Builds an unconditional predicate — claim anytime, no deadline.
 */
export function unconditionalPredicate(): xdr.ClaimPredicate {
  return Claimant.predicateUnconditional();
}
