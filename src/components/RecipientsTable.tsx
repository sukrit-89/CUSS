import { useState } from 'react';
import { Ban, Copy, Inbox, RotateCcw, Check } from 'lucide-react';

export interface Recipient {
  id: string;
  recipient: string;
  amount: string;
  status: 'Pending' | 'Claimed' | 'Expired';
  claimedOn: string;
  claimUrl?: string;
}

interface RecipientsTableProps {
  data?: Recipient[];
  limit?: number;
}

export function RecipientsTable({ data = [], limit }: RecipientsTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const displayData = limit ? data.slice(0, limit) : data;

  const handleCopy = (id: string, claimUrl?: string) => {
    const urlToCopy = claimUrl || `${window.location.origin}/claim/${id}`;
    navigator.clipboard.writeText(urlToCopy);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleResend = (id: string, claimUrl?: string) => {
    const urlToCopy = claimUrl || `${window.location.origin}/claim/${id}`;
    navigator.clipboard.writeText(urlToCopy);
    setActionFeedback(`Resend link copied for recipient ${id.slice(0, 8)}`);
    setTimeout(() => setActionFeedback(null), 2500);
  };

  const handleRevoke = (id: string) => {
    setActionFeedback(`Claim link ${id.slice(0, 8)} marked for revocation`);
    setTimeout(() => setActionFeedback(null), 2500);
  };

  if (displayData.length === 0) {
    return (
      <div className="liquid-glass rounded-2xl overflow-hidden p-12 flex flex-col items-center justify-center text-center gap-2">
        <Inbox size={32} strokeWidth={1.5} className="text-white/20 mb-1" />
        <p className="text-white/40 text-sm">No recipients yet</p>
      </div>
    );
  }

  return (
    <div className="liquid-glass rounded-2xl overflow-hidden w-full relative">
      {actionFeedback && (
        <div className="bg-[#22c55e]/15 border-b border-[#22c55e]/30 px-6 py-2 text-xs text-[#22c55e] font-medium flex items-center justify-between">
          <span>{actionFeedback}</span>
          <button onClick={() => setActionFeedback(null)} className="text-white/40 hover:text-white">✕</button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-white/40 text-xs uppercase tracking-wide border-b border-white/5">
              <th className="px-6 py-3.5 font-medium">Recipient</th>
              <th className="px-6 py-3.5 font-medium">Amount</th>
              <th className="px-6 py-3.5 font-medium">Status</th>
              <th className="px-6 py-3.5 font-medium">Claimed On</th>
              <th className="px-6 py-3.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayData.map((row) => (
              <tr
                key={row.id}
                className="border-t border-white/5 text-white/80 text-sm hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-6 py-4 font-mono text-xs sm:text-sm text-white/90">
                  {row.recipient}
                </td>
                <td className="px-6 py-4 font-medium text-white">
                  {row.amount}
                </td>
                <td className="px-6 py-4">
                  {row.status === 'Pending' && (
                    <span className="liquid-glass rounded-full px-3 py-1 text-xs text-white/50 inline-flex items-center">
                      Pending
                    </span>
                  )}
                  {row.status === 'Claimed' && (
                    <span className="rounded-full px-3 py-1 text-xs bg-[#22c55e]/15 text-[#22c55e] inline-flex items-center font-medium">
                      Claimed
                    </span>
                  )}
                  {row.status === 'Expired' && (
                    <span className="rounded-full px-3 py-1 text-xs bg-white/5 text-white/30 inline-flex items-center">
                      Expired
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-white/50 text-xs sm:text-sm">
                  {row.claimedOn}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleCopy(row.id, row.claimUrl)}
                      title="Copy Claim Link"
                      className="p-1.5 rounded-lg text-white/40 hover:text-white transition-colors"
                    >
                      {copiedId === row.id ? (
                        <Check size={16} strokeWidth={1.5} className="text-[#22c55e]" />
                      ) : (
                        <Copy size={16} strokeWidth={1.5} />
                      )}
                    </button>
                    <button
                      onClick={() => handleResend(row.id, row.claimUrl)}
                      title="Resend Payout"
                      className="p-1.5 rounded-lg text-white/40 hover:text-white transition-colors"
                    >
                      <RotateCcw size={16} strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => handleRevoke(row.id)}
                      title="Revoke Claim Link"
                      className="p-1.5 rounded-lg text-white/40 hover:text-white hover:text-red-400 transition-colors"
                    >
                      <Ban size={16} strokeWidth={1.5} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
