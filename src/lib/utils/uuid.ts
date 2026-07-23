import { v4 } from 'uuid';

/**
 * Generates a unique token for claims.
 * @returns UUID string.
 */
export function generateClaimToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return v4();
}

export { v4 };