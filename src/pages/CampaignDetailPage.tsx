import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MoreHorizontal, Search, Copy, Check, Download, Loader2, RotateCcw } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { WalletButton } from '@/components/WalletButton';
import { StatusBadge } from '@/components/StatusBadge';
import { getCampaignById } from '@/lib/supabase/queries/campaigns';
import { getRecipientsByCampaign } from '@/lib/supabase/queries/recipients';
import { CLAIM_LINK_BASE_URL } from '@/config/constants';
import { downloadCSV, exportRecipientsCSV } from '@/features/campaigns/utils/csv-export';
import { getUsdcSupplyApy, projectYield } from '@/lib/defi/blend';
import { getPrice } from '@/lib/defi/reflector';
import { ReclaimService } from '@/features/campaigns/services/reclaim.service';
import { useWalletStore } from '@/stores/wallet.store';
import type { Database } from '@/lib/supabase/database.types';

type Campaign = Database['public']['Tables']['campaigns']['Row'];
type Recipient = Database['public']['Tables']['recipients']['Row'];
type Filter = 'all' | 'pending' | 'claimed' | 'expired';

function formatDate(value: string | null | undefined) {
  if (!value) return 'No deadline';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
  }, [id]);

  // Both feeds are informational, so they load independently of the page data
  // and stay silent when the integrations are not configured.
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
      const queryMatch = !q || [r.name, r.email, r.wallet_address, r.claim_link_token]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
      return statusMatch && queryMatch;
    });
  }, [recipients, filter, query]);

  const copyLink = async (recipient: Recipient) => {
    await navigator.clipboard.writeText(`${CLAIM_LINK_BASE_URL}/claim/${recipient.claim_link_token}`);
    setCopiedId(recipient.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const deadlinePassed = !!campaign?.deadline && new Date(campaign.deadline).getTime() < Date.now();

  const handleReclaim = async () => {
    if (!campaign) return;

    setOptionsOpen(false);
    setReclaimState('busy');
    setReclaimMessage('');

    try {
      const organizer = wallet.publicKey;
      if (!organizer) throw new Error('Connect the organizer wallet to reclaim funds.');

      const result = await ReclaimService.reclaimExpired(
        campaign.id,
        organizer,
        useWalletStore.getState().signTransaction,
      );

      setReclaimState('done');
      setReclaimMessage(`Reclaimed ${result.reclaimed} unclaimed balance(s).`);
      setRecipients(await getRecipientsByCampaign(campaign.id));
      setCampaign(await getCampaignById(campaign.id));
    } catch (err) {
      setReclaimState('error');
      setReclaimMessage(err instanceof Error ? err.message : 'Reclaim failed.');
    }
  };

  const exportCsv = () => {
    if (!campaign) return;
    const csv = exportRecipientsCSV(recipients as any, campaign.name, CLAIM_LINK_BASE_URL);
    downloadCSV(csv, `${campaign.name || 'campaign'}-recipients.csv`);
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white flex">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <main className="p-6 sm:p-8 max-w-7xl">
          {isLoading && (
            <div className="py-24 flex justify-center text-white/40">
              <Loader2 className="animate-spin" size={32} />
            </div>
          )}

          {!isLoading && error && (
            <div className="liquid-glass rounded-2xl p-8 text-center text-red-300 text-sm">{error}</div>
          )}

          {!isLoading && campaign && (
            <>
              <header className="flex items-start justify-between mb-8 gap-4">
                <div>
                  <Link to="/dashboard" className="text-white/30 hover:text-white text-xs mb-3 inline-block">← Dashboard</Link>
                  <h1 className="text-white text-2xl font-medium">{campaign.name}</h1>
                  <div className="flex items-center gap-2 mt-2">
                    <StatusBadge status={campaign.status} />
                    <span className="text-white/30 text-sm">Expires {formatDate(campaign.deadline)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <WalletButton variant="glass" compact connectLabel="Connect wallet" />
                  <div className="relative">
                    <button
                      onClick={() => setOptionsOpen(!optionsOpen)}
                      className="liquid-glass rounded-full px-4 py-2 flex items-center gap-1.5 text-white/70 text-sm hover:text-white transition-colors"
                    >
                      <MoreHorizontal size={14} /> Options
                    </button>
                    {optionsOpen && (
                      <div className="absolute right-0 mt-2 w-64 liquid-glass rounded-xl p-2 z-20">
                        <button
                          onClick={handleReclaim}
                          disabled={!deadlinePassed || reclaimState === 'busy'}
                          title={
                            deadlinePassed
                              ? 'Return unclaimed balances to the treasury'
                              : 'Available only after the deadline'
                          }
                          className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <RotateCcw size={14} />
                          {reclaimState === 'busy' ? 'Reclaiming...' : 'Reclaim expired balances'}
                        </button>
                        <button
                          onClick={() => {
                            setOptionsOpen(false);
                            exportCsv();
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 flex items-center gap-2"
                        >
                          <Download size={14} /> Export recipient report
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </header>

              {reclaimMessage && (
                <div
                  className={`rounded-xl p-3 mb-6 text-xs ${
                    reclaimState === 'error'
                      ? 'bg-red-500/10 text-red-300'
                      : 'bg-green-500/10 text-green-300'
                  }`}
                >
                  {reclaimMessage}
                </div>
              )}

              <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="liquid-glass rounded-2xl p-5">
                  <p className="text-white/40 text-xs uppercase tracking-wide">Claimed</p>
                  <p className="text-white text-2xl font-medium mt-2">{stats.claimed}/{stats.total}</p>
                  <div className="bg-white/10 rounded-full h-1 mt-4 overflow-hidden">
                    <div className="bg-white h-full" style={{ width: `${stats.total ? (stats.claimed / stats.total) * 100 : 0}%` }} />
                  </div>
                </div>
                <div className="liquid-glass rounded-2xl p-5">
                  <p className="text-white/40 text-xs uppercase tracking-wide">Pending</p>
                  <p className="text-white text-2xl font-medium font-mono mt-2">{stats.pendingUsdc.toFixed(2)} USDC</p>
                  <p className="text-white/30 text-xs mt-2">
                    {usdcPrice !== null
                      ? `≈ $${(stats.pendingUsdc * usdcPrice).toFixed(2)} via Reflector · ${stats.pending} recipients`
                      : `≈ ${stats.pending} recipients`}
                  </p>
                </div>
                <div className="liquid-glass rounded-2xl p-5">
                  <p className="text-white/40 text-xs uppercase tracking-wide">Blend APY</p>
                  <p className="text-white text-2xl font-medium mt-2">
                    {blendApy !== null ? `${(blendApy * 100).toFixed(1)}%` : '—'}
                  </p>
                  <p className="text-white/30 text-xs mt-2">
                    {blendApy !== null
                      ? `earn ~$${projectYield(stats.pendingUsdc, blendApy, 30).toFixed(2)} if unclaimed 30d`
                      : 'Blend pool not configured'}
                  </p>
                </div>
                <div className="liquid-glass rounded-2xl p-5">
                  <p className="text-white/40 text-xs uppercase tracking-wide">Deadline</p>
                  <p className="text-white text-2xl font-medium mt-2">{daysLeft(campaign.deadline)}</p>
                  <p className="text-white/30 text-xs mt-2">{formatDate(campaign.deadline)}</p>
                </div>
              </section>

              <section className="mt-8 flex flex-col gap-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-2">
                    {([
                      ['all', `All (${stats.total})`],
                      ['pending', `Pending (${stats.pending})`],
                      ['claimed', `Claimed (${stats.claimed})`],
                      ['expired', `Expired (${stats.expired})`],
                    ] as Array<[Filter, string]>).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className={`rounded-full px-4 py-2 text-sm transition-colors ${filter === key ? 'bg-white/15 text-white' : 'liquid-glass text-white/50 hover:text-white'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <label className="liquid-glass rounded-full px-4 py-2 flex items-center gap-2 text-sm text-white/50">
                      <Search size={14} />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search recipients"
                        className="bg-transparent outline-none text-white placeholder:text-white/30 w-44"
                      />
                    </label>
                    <button onClick={exportCsv} className="liquid-glass rounded-full px-4 py-2 text-sm text-white/70 hover:text-white flex items-center gap-2">
                      <Download size={14} /> Export CSV
                    </button>
                  </div>
                </div>

                <div className="liquid-glass rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="text-white/30 text-xs uppercase tracking-wide border-b border-white/10">
                        <tr>
                          <th className="px-5 py-3 font-medium">Name</th>
                          <th className="px-5 py-3 font-medium">Amount</th>
                          <th className="px-5 py-3 font-medium">Status</th>
                          <th className="px-5 py-3 font-medium">Claimed at</th>
                          <th className="px-5 py-3 font-medium text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRecipients.map((recipient) => (
                          <tr key={recipient.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                            <td className="px-5 py-4 text-white text-sm">
                              <div>{recipient.name}</div>
                              <div className="text-white/30 text-xs font-mono">{recipient.wallet_address ? `${recipient.wallet_address.slice(0, 6)}...${recipient.wallet_address.slice(-4)}` : recipient.email}</div>
                            </td>
                            <td className="px-5 py-4 font-mono text-white text-sm">{amountOf(recipient, campaign).toFixed(2)} USDC</td>
                            <td className="px-5 py-4"><StatusBadge status={recipient.status} /></td>
                            <td className="px-5 py-4 text-white/30 text-xs">{recipient.claimed_at ? formatDate(recipient.claimed_at) : '—'}</td>
                            <td className="px-5 py-4 text-right">
                              <button onClick={() => copyLink(recipient)} className="liquid-glass text-white/50 hover:text-white text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1.5">
                                {copiedId === recipient.id ? <Check size={13} className="text-green-300" /> : <Copy size={13} />}
                                Copy link
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredRecipients.length === 0 && (
                          <tr><td colSpan={5} className="px-5 py-10 text-center text-white/40 text-sm">No recipients match this filter.</td></tr>
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
    </div>
  );
}
