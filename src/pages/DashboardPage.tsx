import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { RecipientsTable, type Recipient } from '../components/RecipientsTable';
import { Plus, ArrowUpRight, Loader2 } from 'lucide-react';
import { useCampaignStore } from '@/stores/campaign.store';
import { CLAIM_LINK_BASE_URL } from '@/config/constants';

export function DashboardPage() {
  const {
    campaigns,
    recipients,
    activeCampaign,
    isLoading,
    error,
    fetchCampaigns,
    selectCampaign,
  } = useCampaignStore();

  // ── Fetch campaigns on mount ─────────────────────────────────────────────
  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // ── Auto-select first campaign when campaigns load ───────────────────────
  useEffect(() => {
    if (campaigns.length > 0 && !activeCampaign) {
      selectCampaign(campaigns[0].id);
    }
  }, [campaigns, activeCampaign, selectCampaign]);

  // ── Compute stats from real recipient data ───────────────────────────────
  const stats = useMemo(() => {
    const totalRecipients = recipients.length;
    let claimedCount = 0;
    let pendingCount = 0;
    let expiredCount = 0;
    let totalDistributed = 0;

    for (const r of recipients) {
      const amount = parseFloat(
        (r as any).amount ?? activeCampaign?.amount_per_recipient ?? '0'
      );

      if (r.status === 'claimed') {
        claimedCount++;
        totalDistributed += amount;
      } else if (r.status === 'expired') {
        expiredCount++;
      } else {
        pendingCount++;
      }
    }

    const claimRate = totalRecipients > 0
      ? ((claimedCount / totalRecipients) * 100).toFixed(1)
      : '0.0';

    return {
      totalDistributed: totalDistributed.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      activeLinks: pendingCount,
      claimRate,
      totalRecipients,
      pendingCount,
    };
  }, [recipients, activeCampaign]);

  // ── Map Supabase recipients to RecipientsTable display format ────────────
  const displayRecipients: Recipient[] = useMemo(() => {
    return recipients.map((r: any) => {
      const walletAddr = r.wallet_address || '—';
      const truncatedWallet = walletAddr.length > 12
        ? `${walletAddr.slice(0, 4)}...${walletAddr.slice(-4)}`
        : walletAddr;

      const amount = r.amount ?? activeCampaign?.amount_per_recipient ?? '0';

      return {
        id: r.id,
        recipient: truncatedWallet,
        amount: `${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC`,
        status: r.status === 'claimed' ? 'Claimed' : r.status === 'expired' ? 'Expired' : 'Pending',
        claimedOn: r.claimed_at
          ? new Date(r.claimed_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : '—',
        claimUrl: r.claim_link_token
          ? `${CLAIM_LINK_BASE_URL}/claim/${r.claim_link_token}`
          : undefined,
      } satisfies Recipient;
    });
  }, [recipients, activeCampaign]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">
      {/* Persistent Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 px-6 sm:px-8 border-b border-white/10 flex items-center justify-between gap-4 sticky top-0 bg-[#0a0a0a]/90 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <h1 className="text-white font-medium text-lg">
              {activeCampaign?.name || 'Dashboard'}
            </h1>
            <span className="liquid-glass rounded-full px-2.5 py-0.5 text-xs text-white/50">
              Stellar Testnet
            </span>
          </div>

          <Link
            to="/payouts/new"
            className="bg-white text-black font-medium text-sm rounded-full px-4 py-2 hover:bg-white/90 transition-colors flex items-center gap-1.5"
          >
            <Plus size={16} strokeWidth={1.5} />
            <span>New Payout</span>
          </Link>
        </header>

        {/* Dashboard Body */}
        <main className="p-6 sm:p-8 flex flex-col gap-8 max-w-7xl">
          {/* Loading State */}
          {isLoading && recipients.length === 0 && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} strokeWidth={1.5} className="animate-spin text-white/40" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="liquid-glass rounded-2xl p-6 text-center">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && campaigns.length === 0 && !error && (
            <div className="liquid-glass rounded-2xl p-12 text-center flex flex-col items-center gap-4">
              <p className="text-white/40 text-sm">No campaigns yet. Create your first payout to get started.</p>
              <Link
                to="/payouts/new"
                className="bg-white text-black font-medium text-sm rounded-full px-6 py-2.5 hover:bg-white/90 transition-colors flex items-center gap-1.5"
              >
                <Plus size={16} strokeWidth={1.5} />
                <span>Create Payout</span>
              </Link>
            </div>
          )}

          {/* Stat Cards Row */}
          {(campaigns.length > 0 || recipients.length > 0) && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="liquid-glass rounded-2xl p-6 flex flex-col justify-between gap-2">
                  <span className="text-white/40 text-xs uppercase tracking-wide font-medium">
                    Total Distributed
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-white text-3xl sm:text-4xl font-medium tracking-tight">
                      {stats.totalDistributed}
                    </span>
                    <span className="text-white/60 text-sm font-medium">USDC</span>
                  </div>
                  <span className="text-white/40 text-xs mt-1">
                    {stats.totalRecipients} total recipients
                  </span>
                </div>

                <div className="liquid-glass rounded-2xl p-6 flex flex-col justify-between gap-2">
                  <span className="text-white/40 text-xs uppercase tracking-wide font-medium">
                    Active Claim Links
                  </span>
                  <span className="text-white text-3xl sm:text-4xl font-medium tracking-tight">
                    {stats.activeLinks}
                  </span>
                  <span className="text-white/40 text-xs mt-1">
                    {stats.pendingCount} pending recipient claims
                  </span>
                </div>

                <div className="liquid-glass rounded-2xl p-6 flex flex-col justify-between gap-2">
                  <span className="text-white/40 text-xs uppercase tracking-wide font-medium">
                    Claim Rate
                  </span>
                  <span className="text-white text-3xl sm:text-4xl font-medium tracking-tight">
                    {stats.claimRate}%
                  </span>
                  <span className="text-white/40 text-xs mt-1">
                    Across all campaigns
                  </span>
                </div>
              </div>

              {/* Campaign Selector (if multiple) */}
              {campaigns.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {campaigns.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => selectCampaign(c.id)}
                      className={`px-4 py-2 rounded-full text-xs font-medium transition-colors ${
                        activeCampaign?.id === c.id
                          ? 'bg-white/15 text-white'
                          : 'liquid-glass text-white/50 hover:text-white'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Recent Payouts Section */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-white/70 text-sm font-medium">
                    Recipients{activeCampaign ? ` — ${activeCampaign.name}` : ''}
                  </h2>
                  {displayRecipients.length > 5 && (
                    <span className="text-white/40 text-xs flex items-center gap-1">
                      <span>Showing {Math.min(displayRecipients.length, 20)} of {displayRecipients.length}</span>
                      <ArrowUpRight size={12} />
                    </span>
                  )}
                </div>

                {/* Reusable Recipients Table */}
                <RecipientsTable data={displayRecipients} limit={20} />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
