import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  MoreHorizontal,
  Search,
  Copy,
  Check,
  Download,
  Loader2,
  Mail,
  RotateCcw,
  Sparkles,
  Layers,
  ExternalLink,
  Send,
} from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { WalletButton } from '@/components/WalletButton';
import { StatusBadge } from '@/components/StatusBadge';
import { ClaimPreviewModal } from '@/components/ClaimPreviewModal';
import { CampaignDetailSkeleton } from '@/components/Skeleton';
import { getCampaignById } from '@/lib/supabase/queries/campaigns';
import { getRecipientsByCampaign } from '@/lib/supabase/queries/recipients';
import { supabase } from '@/lib/supabase/client';
import { CLAIM_LINK_BASE_URL } from '@/config/constants';
import { downloadCSV, exportRecipientsCSV } from '@/features/campaigns/utils/csv-export';
import { getUsdcSupplyApy, projectYield } from '@/lib/defi/blend';
import { getPrice } from '@/lib/defi/reflector';
import { useWalletStore } from '@/stores/wallet.store';
import { toast } from '@/stores/toast.store';
import type { Database } from '@/lib/supabase/database.types';

type Campaign = Database['public']['Tables']['campaigns']['Row'];
type Recipient = Database['public']['Tables']['recipients']['Row'];
type Filter = 'all' | 'pending' | 'claimed' | 'expired';

function formatDate(value: string | null | undefined) {
  if (!value) return 'No deadline';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysLeft(value: string | null | undefined) {
  if (!value) return 'No deadline';
  const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return 'Expired';
  if (days === 0) return 'Today';
  return `${days} day${days === 1 ? '' : 's'} left`;
}

function amountOf(recipient: Recipient, campaign: Campaign | null) {
  return parseFloat(recipient.amount ?? campaign?.amount_per_recipient ?? '0') || 0;
}

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [blendApy, setBlendApy] = useState<number | null>(null);
  const [usdcPrice, setUsdcPrice] = useState<number | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [reclaimState, setReclaimState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [reclaimMessage, setReclaimMessage] = useState('');
  const [emailSending, setEmailSending] = useState(false);

  // Modal state
  const [previewOpen, setPreviewOpen] = useState(false);

  const wallet = useWalletStore();

  useEffect(() => {
    if (!id) return;

    async function load() {
      setIsLoading(true);
      setError('');
      try {
        const [campaignRow, recipientRows] = await Promise.all([
          getCampaignById(id as string),
          getRecipientsByCampaign(id as string),
        ]);
        setCampaign(campaignRow);
        setRecipients(recipientRows);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load campaign.');
      } finally {
        setIsLoading(false);
      }
    }

    load();

    // Live claim updates for this campaign.
    const channel = supabase
      .channel(`campaign-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'recipients',
          filter: `campaign_id=eq.${id}`,
        },
        (payload) => {
          const updated = payload.new as Database['public']['Tables']['recipients']['Row'];
          setRecipients((prev) =>
            prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    getUsdcSupplyApy().then((snapshot) => setBlendApy(snapshot?.apy ?? null));
    getPrice().then(setUsdcPrice);
  }, []);

  const stats = useMemo(() => {
    const total = recipients.length;
    const claimed = recipients.filter((r) => r.status === 'claimed').length;
    const expired = recipients.filter((r) => r.status === 'expired').length;
    const pending = total - claimed - expired;
    const claimedUsdc = recipients
      .filter((r) => r.status === 'claimed')
      .reduce((sum, r) => sum + amountOf(r, campaign), 0);
    const pendingUsdc = recipients
      .filter((r) => r.status !== 'claimed' && r.status !== 'expired')
      .reduce((sum, r) => sum + amountOf(r, campaign), 0);

    return { total, claimed, pending, expired, claimedUsdc, pendingUsdc };
  }, [recipients, campaign]);

  const filteredRecipients = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipients.filter((r) => {
      const statusMatch = filter === 'all' || r.status === filter;
      const queryMatch =
        !q ||
        [r.name, r.email, r.wallet_address, r.claim_link_token]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      return statusMatch && queryMatch;
    });
  }, [recipients, filter, query]);

  const copyLink = async (recipient: Recipient) => {
    const url = `${CLAIM_LINK_BASE_URL}/claim/${recipient.claim_link_token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(recipient.id);
    toast.success(`Claim link for ${recipient.name} copied!`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyAllPendingLinks = async () => {
    const pending = recipients.filter((r) => r.status === 'pending');
    if (pending.length === 0) {
      toast.info('No pending claim links to copy.');
      return;
    }

    const text = pending
      .map((r) => `${r.name}: ${CLAIM_LINK_BASE_URL}/claim/${r.claim_link_token}`)
      .join('\n');

    await navigator.clipboard.writeText(text);
    toast.success(`Copied ${pending.length} pending claim link(s) to clipboard!`);
  };

  const copyFormattedList = async () => {
    if (recipients.length === 0) return;
    const formatted = recipients
      .map(
        (r, idx) =>
          `${idx + 1}. ${r.name} (${amountOf(r, campaign).toFixed(2)} USDC): ${CLAIM_LINK_BASE_URL}/claim/${r.claim_link_token}`,
      )
      .join('\n');
    await navigator.clipboard.writeText(formatted);
    toast.success('Copied formatted claim links list (ready for Discord/Slack/Notion)!');
  };

  const deadlinePassed =
    !!campaign?.deadline && new Date(campaign.deadline).getTime() < Date.now();

  const handleReclaim = async () => {
    if (!campaign) return;

    setOptionsOpen(false);
    setReclaimState('busy');
    setReclaimMessage('');

    try {
      const organizer = wallet.publicKey;
      if (!organizer) throw new Error('Connect the organizer wallet to reclaim funds.');

      // Phase 1: Request unsigned inner tx from server
      const prepareRes = await fetch(`/api/campaign/${campaign.id}/reclaim`, {
        method: 'POST',
      });
      const prepareData = await prepareRes.json();

      if (!prepareRes.ok || !prepareData.unsigned_inner_tx_xdr) {
        throw new Error(prepareData.error || 'Failed to prepare reclaim transaction.');
      }

      // Phase 2: Sign inner tx with organizer wallet
      const signedInnerXdr = await wallet.signTransaction(prepareData.unsigned_inner_tx_xdr);

      // Phase 3: Submit signed inner tx to server for fee-bumping and submission
      const submitRes = await fetch(`/api/campaign/${campaign.id}/reclaim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signed_inner_tx_xdr: signedInnerXdr }),
      });
      const submitData = await submitRes.json();

      if (!submitRes.ok || !submitData.success) {
        throw new Error(submitData.error || 'Reclaim submission failed.');
      }

      setReclaimState('done');
      const msg = `Reclaimed ${submitData.reclaimed} unclaimed balance(s).`;
      setReclaimMessage(msg);
      toast.success(msg);
      setRecipients(await getRecipientsByCampaign(campaign.id));
      setCampaign(await getCampaignById(campaign.id));
    } catch (err) {
      setReclaimState('error');
      const msg = err instanceof Error ? err.message : 'Reclaim failed.';
      setReclaimMessage(msg);
      toast.error(msg);
    }
  };

  const exportCsv = () => {
    if (!campaign) return;
    const csv = exportRecipientsCSV(recipients as any, campaign.name, CLAIM_LINK_BASE_URL);
    downloadCSV(csv, `${campaign.name || 'campaign'}-recipients.csv`);
    toast.success('Recipient claim links CSV exported');
  };

  const handleSendEmails = async (recipientId?: string) => {
    if (!campaign) return;
    setOptionsOpen(false);
    setEmailSending(true);
    try {
      const res = await fetch('/api/notify/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaign.id,
          recipientId,
          baseUrl: CLAIM_LINK_BASE_URL,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send email notification(s).');
      }
      toast.success(
        data.simulated
          ? `Dispatched claim email(s) to ${data.sent} recipient(s) (Preview Mode)`
          : `Sent claim email(s) to ${data.sent} recipient(s)!`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send emails.');
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white flex font-sans pb-20 md:pb-0">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <main className="p-6 sm:p-8 max-w-7xl">
          {isLoading && <CampaignDetailSkeleton />}

          {!isLoading && error && (
            <div className="liquid-glass rounded-2xl p-8 text-center text-red-300 text-sm">
              {error}
            </div>
          )}

          {!isLoading && campaign && (
            <>
              {/* Header */}
              <header className="flex flex-col sm:flex-row sm:items-start justify-between mb-8 gap-4">
                <div>
                  <Link
                    to="/dashboard"
                    className="text-white/40 hover:text-white text-xs mb-3 inline-flex items-center gap-1 transition-colors"
                  >
                    ← Back to Dashboard
                  </Link>
                  <h1 className="text-white text-2xl font-medium tracking-tight">
                    {campaign.name}
                  </h1>
                  <div className="flex items-center gap-2.5 mt-2">
                    <StatusBadge status={campaign.status} />
                    <span className="text-white/40 text-xs">
                      Expires {formatDate(campaign.deadline)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Preview Claim Page button */}
                  <button
                    onClick={() => setPreviewOpen(true)}
                    className="liquid-glass rounded-full px-4 py-2 text-xs font-medium text-white/80 hover:text-white flex items-center gap-1.5 transition-colors border border-white/10 hover:bg-white/5 cursor-pointer"
                  >
                    <Sparkles size={13} className="text-amber-400" />
                    <span>Preview Claim Page</span>
                  </button>

                  <WalletButton variant="glass" compact connectLabel="Connect wallet" />

                  {/* Options Menu */}
                  <div className="relative">
                    <button
                      onClick={() => setOptionsOpen(!optionsOpen)}
                      className="liquid-glass rounded-full p-2 text-white/50 hover:text-white transition-colors border border-white/10"
                      aria-label="Campaign options"
                    >
                      <MoreHorizontal size={16} />
                    </button>

                    {optionsOpen && (
                      <div className="absolute right-0 top-full mt-2 w-56 liquid-glass rounded-2xl p-2 z-20 border border-white/10 shadow-2xl backdrop-blur-xl">
                        <button
                          onClick={exportCsv}
                          className="w-full text-left px-3 py-2 text-xs text-white/80 hover:text-white hover:bg-white/10 rounded-lg flex items-center gap-2 cursor-pointer"
                        >
                          <Download size={14} /> Export CSV
                        </button>

                        <button
                          onClick={() => handleSendEmails()}
                          disabled={emailSending}
                          className="w-full text-left px-3 py-2 text-xs text-white/80 hover:text-white hover:bg-white/10 rounded-lg flex items-center gap-2 cursor-pointer disabled:opacity-40"
                        >
                          <Mail size={14} />
                          <span>{emailSending ? 'Sending emails...' : 'Send claim emails'}</span>
                        </button>

                        <button
                          onClick={handleReclaim}
                          disabled={reclaimState === 'busy' || !deadlinePassed}
                          className="w-full text-left px-3 py-2 text-xs text-white/80 hover:text-white hover:bg-white/10 rounded-lg flex items-center gap-2 cursor-pointer disabled:opacity-40"
                        >
                          <RotateCcw size={14} />
                          <span>Reclaim expired funds</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </header>

              {/* Reclaim state banner */}
              {reclaimState === 'busy' && (
                <div className="mb-6 liquid-glass rounded-2xl p-4 flex items-center gap-3 text-sm text-white/80 border border-amber-500/20">
                  <Loader2 className="animate-spin text-amber-400" size={16} />
                  <span>Reclaiming expired balances on Stellar...</span>
                </div>
              )}

              {reclaimMessage && (
                <div
                  className={`mb-6 liquid-glass rounded-2xl p-4 text-xs ${
                    reclaimState === 'done' ? 'text-green-300 border-green-500/20' : 'text-red-300 border-red-500/20'
                  } border`}
                >
                  {reclaimMessage}
                </div>
              )}

              {/* Stats Section */}
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="liquid-glass rounded-2xl p-5 border border-white/10">
                  <p className="text-white/40 text-xs font-mono uppercase tracking-wide">
                    Claim Progress
                  </p>
                  <p className="text-white text-2xl font-medium mt-2">
                    {stats.claimed} <span className="text-white/40 text-sm font-normal">/ {stats.total} claimed</span>
                  </p>
                  <div className="w-full h-1.5 liquid-glass rounded-full overflow-hidden mt-3 bg-white/5">
                    <div
                      className="h-full bg-white rounded-full transition-all duration-500"
                      style={{ width: `${stats.total > 0 ? (stats.claimed / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="liquid-glass rounded-2xl p-5 border border-white/10">
                  <p className="text-white/40 text-xs font-mono uppercase tracking-wide">
                    Claimed Volume
                  </p>
                  <p className="text-white text-2xl font-medium mt-2">
                    {stats.claimedUsdc.toFixed(2)}{' '}
                    <span className="text-white/40 text-sm font-normal">USDC</span>
                  </p>
                  <p className="text-white/30 text-xs mt-2 font-mono">
                    {usdcPrice !== null
                      ? `≈ $${(stats.claimedUsdc * usdcPrice).toFixed(2)} Reflector USD`
                      : `${stats.pendingUsdc.toFixed(2)} USDC pending`}
                  </p>
                </div>

                <div className="liquid-glass rounded-2xl p-5 border border-white/10">
                  <p className="text-white/40 text-xs font-mono uppercase tracking-wide">
                    Blend Yield APY
                  </p>
                  <p className="text-white text-2xl font-medium mt-2">
                    {blendApy !== null ? `${blendApy.toFixed(2)}%` : '—'}
                  </p>
                  <p className="text-white/30 text-xs mt-2">
                    {blendApy !== null
                      ? `earn ~$${projectYield(stats.pendingUsdc, blendApy, 30).toFixed(2)} if unclaimed 30d`
                      : 'DeFi yield projected'}
                  </p>
                </div>

                <div className="liquid-glass rounded-2xl p-5 border border-white/10">
                  <p className="text-white/40 text-xs font-mono uppercase tracking-wide">
                    Deadline
                  </p>
                  <p className="text-white text-2xl font-medium mt-2">
                    {daysLeft(campaign.deadline)}
                  </p>
                  <p className="text-white/30 text-xs mt-2">{formatDate(campaign.deadline)}</p>
                </div>
              </section>

              {/* Recipients Table & Filters */}
              <section className="mt-8 flex flex-col gap-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Status Filter Tabs */}
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        ['all', `All (${stats.total})`],
                        ['pending', `Pending (${stats.pending})`],
                        ['claimed', `Claimed (${stats.claimed})`],
                        ['expired', `Expired (${stats.expired})`],
                      ] as Array<[Filter, string]>
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                          filter === key
                            ? 'bg-white/15 text-white font-semibold shadow-sm'
                            : 'liquid-glass text-white/50 hover:text-white border border-white/5'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Search & Bulk Action Bar */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="liquid-glass rounded-full px-3.5 py-1.5 flex items-center gap-2 text-xs text-white/50 border border-white/10">
                      <Search size={13} />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search recipient..."
                        className="bg-transparent outline-none text-white placeholder:text-white/30 w-36 sm:w-44 text-xs"
                      />
                    </label>

                    <button
                      onClick={copyAllPendingLinks}
                      className="liquid-glass rounded-full px-3.5 py-1.5 text-xs font-medium text-white/70 hover:text-white flex items-center gap-1.5 border border-white/10 hover:bg-white/5 cursor-pointer"
                      title="Copy all pending claim links to clipboard"
                    >
                      <Layers size={13} />
                      <span>Copy Pending</span>
                    </button>

                    <button
                      onClick={copyFormattedList}
                      className="liquid-glass rounded-full px-3.5 py-1.5 text-xs font-medium text-white/70 hover:text-white flex items-center gap-1.5 border border-white/10 hover:bg-white/5 cursor-pointer"
                      title="Copy formatted names + links list"
                    >
                      <Copy size={13} />
                      <span>Copy Formatted List</span>
                    </button>

                    <button
                      onClick={exportCsv}
                      className="liquid-glass rounded-full px-3.5 py-1.5 text-xs font-medium text-white/70 hover:text-white flex items-center gap-1.5 border border-white/10 hover:bg-white/5 cursor-pointer"
                    >
                      <Download size={13} />
                      <span>Export CSV</span>
                    </button>
                  </div>
                </div>

                {/* Recipient Rows Table */}
                <div className="liquid-glass rounded-2xl overflow-hidden border border-white/10">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="text-white/30 text-[11px] font-mono uppercase tracking-wider border-b border-white/10">
                        <tr>
                          <th className="px-5 py-3 font-medium">Recipient</th>
                          <th className="px-5 py-3 font-medium">Payout Amount</th>
                          <th className="px-5 py-3 font-medium">Status</th>
                          <th className="px-5 py-3 font-medium">Claimed Date</th>
                          <th className="px-5 py-3 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredRecipients.map((recipient) => (
                          <tr
                            key={recipient.id}
                            className="hover:bg-white/[0.03] transition-colors"
                          >
                            <td className="px-5 py-4 text-white text-xs">
                              <div className="font-medium text-white">{recipient.name}</div>
                              <div className="text-white/40 text-[11px] font-mono mt-0.5">
                                {recipient.wallet_address
                                  ? `${recipient.wallet_address.slice(0, 6)}...${recipient.wallet_address.slice(-4)}`
                                  : recipient.email || 'Direct claim link'}
                              </div>
                            </td>
                            <td className="px-5 py-4 font-mono text-white text-xs font-medium">
                              {amountOf(recipient, campaign).toFixed(2)} USDC
                            </td>
                            <td className="px-5 py-4">
                              <StatusBadge status={recipient.status} />
                            </td>
                            <td className="px-5 py-4 text-white/40 text-xs">
                              {recipient.claimed_at ? formatDate(recipient.claimed_at) : '—'}
                            </td>
                            <td className="px-5 py-4 text-right">
                              <div className="inline-flex items-center gap-1.5 justify-end">
                                <button
                                  onClick={() => copyLink(recipient)}
                                  className="liquid-glass text-white/80 hover:text-white text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                                  title="Copy Claim Link"
                                >
                                  {copiedId === recipient.id ? (
                                    <Check size={12} className="text-green-400" />
                                  ) : (
                                    <Copy size={12} />
                                  )}
                                  <span>{copiedId === recipient.id ? 'Copied' : 'Copy'}</span>
                                </button>

                                <a
                                  href={`${CLAIM_LINK_BASE_URL}/claim/${recipient.claim_link_token}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="liquid-glass text-white/50 hover:text-white p-1.5 rounded-full border border-white/10 hover:bg-white/10 transition-colors inline-flex items-center"
                                  title="Open & Test Claim Link"
                                >
                                  <ExternalLink size={12} />
                                </a>

                                <a
                                  href={`https://wa.me/?text=${encodeURIComponent(`Hi ${recipient.name}, your ${amountOf(recipient, campaign).toFixed(2)} USDC payout is ready on ReRail: ${CLAIM_LINK_BASE_URL}/claim/${recipient.claim_link_token}`)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="liquid-glass text-white/50 hover:text-green-400 p-1.5 rounded-full border border-white/10 hover:bg-white/10 transition-colors inline-flex items-center"
                                  title="Share on WhatsApp"
                                >
                                  <Send size={12} />
                                </a>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filteredRecipients.length === 0 && (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-5 py-12 text-center text-white/40 text-xs"
                            >
                              No recipients match this filter.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </>
          )}
        </main>
      </div>

      {/* Claim Page Live Simulation Modal */}
      {previewOpen && campaign && (
        <ClaimPreviewModal
          isOpen={previewOpen}
          onClose={() => setPreviewOpen(false)}
          campaignName={campaign.name}
          amount={campaign.amount_per_recipient || '50.00'}
          assetCode={campaign.token || 'USDC'}
        />
      )}
    </div>
  );
}
