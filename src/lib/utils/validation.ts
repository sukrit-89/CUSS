import { StrKey } from '@stellar/stellar-sdk';

/**
 * Validates a Stellar Ed25519 public key.
 * @param address - The stellar address to validate.
 * @returns boolean indicating if valid.
 */
export function isValidStellarAddress(address: string): boolean {
  try {
    return StrKey.isValidEd25519PublicKey(address);
  } catch {
    return false;
  }
}

/**
 * Sanitizes a field against CSV injection.
 * Strips leading =, +, -, @ characters.
 * @param value - The string to sanitize.
 * @returns sanitized string.
 */
export function sanitizeCSVField(value: string): string {
  if (!value) return '';
  const str = String(value).trim();
  if (/^[=+\-@]/.test(str)) {
    return str.replace(/^[=+\-@]+/, '');
  }
  return str;
}

/**
 * Validates USDC amount (positive number, max 7 decimals).
 * @param amount - The amount to validate.
 * @returns boolean indicating if valid.
 */
export function isValidAmount(amount: string): boolean {
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return false;
  const parts = amount.split('.');
  if (parts.length > 1 && parts[1].length > 7) return false;
  return true;
}

/**
 * Validates an email address.
 * @param email - The email to validate.
 * @returns boolean indicating if valid.
 */
export function isValidEmail(email: string): boolean {
  const re = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
  return re.test(String(email).toLowerCase());
}