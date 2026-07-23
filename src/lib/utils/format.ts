/**
 * Format USDC amounts for display.
 * @param amount - String amount (Stellar convention: string representation)
 * @param decimals - Number of decimal places to show (default: 2)
 */
export function formatAmount(amount: string, decimals: number = 2): string {
  const num = parseFloat(amount);
  return isNaN(num)
    ? '0.00'
    : num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
}

/**
 * Format ISO date string for UI display.
 * @param isoDate - ISO 8601 date string
 */
export function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  return isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
}

/**
 * Truncate a Stellar public key to GABC...XYZ7 format for display.
 * @param address - Full Stellar public key (56 characters)
 */
export function formatStellarAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/**
 * Get the StellarExpert testnet explorer URL for a transaction hash.
 * @param txHash - Stellar transaction hash
 */
export function getStellarExplorerUrl(txHash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${txHash}`;
}