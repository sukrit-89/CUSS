import type { Recipient } from '@/features/campaigns/types/campaign.types';

/**
 * Generates a CSV string from a list of recipients, including claim links.
 *
 * @param recipients - Array of recipients to export
 * @param _campaignName - Campaign name (used for metadata, reserved for future)
 * @param baseUrl - Base URL for claim links (e.g. https://rerail.vercel.app)
 * @returns CSV string content
 */
export function exportRecipientsCSV(
  recipients: Recipient[],
  _campaignName: string,
  baseUrl: string,
): string {
  const headers = [
    'name',
    'email',
    'wallet_address',
    'amount',
    'claim_link',
    'status',
  ];

  const rows = recipients.map((r) => {
    const claimLink = r.claim_link_token
      ? `${baseUrl}/claim/${r.claim_link_token}`
      : '';

    return [
      r.name ?? '',
      r.email ?? '',
      r.wallet_address ?? '',
      r.amount ?? '',
      claimLink,
      r.status ?? '',
    ];
  });

  const csvLines = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(','),
    ),
  ];

  return csvLines.join('\n');
}

/**
 * Triggers a browser download for CSV content.
 *
 * @param csvContent - CSV string to download
 * @param filename - Name of the downloaded file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}