import { StrKey } from '@stellar/stellar-sdk';

const STELLAR_AMOUNT_RE = /^\d+(?:\.\d+)?$/;

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
 * Normalizes a Stellar amount string and rejects unsupported formats.
 *
 * Accepted values are plain decimal strings such as `1`, `1.25`, or `0.0000001`.
 * Scientific notation and locale-specific formats are rejected.
 *
 * @param amount - The amount to normalize.
 * @returns A canonical decimal string safe for Stellar SDK calls.
 * @throws If the amount is not a positive decimal with at most 7 decimals.
 */
export function normalizeStellarAmount(amount: string): string {
  const value = String(amount).trim();

  if (!value || !STELLAR_AMOUNT_RE.test(value)) {
    throw new Error('Amount must be a plain decimal number.');
  }

  const [wholePart, fractionPart = ''] = value.split('.');
  if (fractionPart.length > 7) {
    throw new Error('Amount must have at most 7 decimal places.');
  }

  const whole = wholePart.replace(/^0+(?=\d)/, '') || '0';
  const fraction = fractionPart.replace(/0+$/, '');

  if (whole === '0' && fraction.length === 0) {
    throw new Error('Amount must be greater than zero.');
  }

  return fraction.length > 0 ? `${whole}.${fraction}` : whole;
}

/**
 * Validates USDC amount (positive decimal, max 7 decimals).
 * @param amount - The amount to validate.
 * @returns boolean indicating if valid.
 */
export function isValidAmount(amount: string): boolean {
  try {
    normalizeStellarAmount(amount);
    return true;
  } catch {
    return false;
  }
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