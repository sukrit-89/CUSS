import Papa from 'papaparse';
import {
  isValidStellarAddress,
  sanitizeCSVField,
  isValidEmail,
  isValidAmount,
} from '@/lib/utils/validation';
import { MAX_RECIPIENTS_PER_UPLOAD } from '@/config/constants';
import type { CSVRecipientRow, CSVParseResult } from '@/features/campaigns/types/campaign.types';

/**
 * Parses and validates a CSV string containing recipient data.
 *
 * Expected CSV columns: name, email (optional), wallet_address (optional), amount (optional)
 *
 * @param csvText - Raw CSV text content
 * @returns Parsed result with valid rows, errors, and warnings
 */
export function parseRecipientsCSV(csvText: string): CSVParseResult {
  const valid: CSVRecipientRow[] = [];
  const errors: CSVParseResult['errors'] = [];
  const warnings: CSVParseResult['warnings'] = [];
  const seenAddresses = new Set<string>();

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim().toLowerCase(),
  });

  // Check max row limit
  if (parsed.data.length > MAX_RECIPIENTS_PER_UPLOAD) {
    errors.push({
      row: 0,
      field: 'file',
      message: `CSV exceeds maximum of ${MAX_RECIPIENTS_PER_UPLOAD} rows. Got ${parsed.data.length}.`,
    });
    return { valid, errors, warnings };
  }

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    const rowNum = i + 2; // +2 for 1-indexed + header row

    // Sanitise all fields against CSV injection
    const name = sanitizeCSVField(row['name'] ?? '');
    const email = sanitizeCSVField(row['email'] ?? '');
    const walletAddress = sanitizeCSVField(row['wallet_address'] ?? '');
    const amount = sanitizeCSVField(row['amount'] ?? '');

    // Name is required
    if (!name) {
      errors.push({ row: rowNum, field: 'name', message: 'Name is required' });
      continue;
    }

    // Validate email if provided
    if (email && !isValidEmail(email)) {
      errors.push({
        row: rowNum,
        field: 'email',
        message: 'Invalid email format',
      });
      continue;
    }

    // Validate wallet address if provided
    if (walletAddress && !isValidStellarAddress(walletAddress)) {
      errors.push({
        row: rowNum,
        field: 'wallet_address',
        message: 'Invalid Stellar address',
      });
      continue;
    }

    // Check for duplicate wallet addresses
    if (walletAddress && seenAddresses.has(walletAddress)) {
      warnings.push({
        row: rowNum,
        message: 'Duplicate wallet address',
      });
    } else if (walletAddress) {
      seenAddresses.add(walletAddress);
    }

    // Validate amount if provided
    if (amount && !isValidAmount(amount)) {
      errors.push({
        row: rowNum,
        field: 'amount',
        message: 'Invalid amount — must be positive with at most 7 decimal places',
      });
      continue;
    }

    valid.push({
      name,
      email: email || undefined,
      wallet_address: walletAddress || undefined,
      amount: amount || undefined,
    });
  }

  return { valid, errors, warnings };
}