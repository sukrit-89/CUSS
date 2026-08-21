import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ExternalLink, Loader2, Plus } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { StatusBadge } from '@/components/StatusBadge';
import { getCampaigns } from '@/lib/supabase/queries/campaigns';
import { getRecipientsForCampaigns } from '@/lib/supabase/queries/recipients';
import { CIRCLE_FAUCET_URL } from '@/config/constants';
import { getPrice } from '@/lib/defi/reflector';
import { NetworkBadge } from '@/components/NetworkBadge';
import type { Database } from '@/lib/supabase/database.types';

type Campaign = Database['public']['Tables']['campaigns']['Row'];
type Recipient = Database['public']['Tables']['recipients']['Row'];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function amountOf(recipient: Recipient, campaign: Campaign | undefined) {
  return parseFloat(recipient.amount ?? campaign?.amount_per_recipient ?? '0') || 0;
}

function deadlineLabel(deadline: string | null) {
  if (!deadline) return 'No deadline';
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return 'Expired';
  if (days === 0) return 'Ends today';
  return `${days} day${days === 1 ? '' : 's'} left`;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [usdcPrice, setUsdcPrice] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const campaignRows = await getCampaigns();
        setCampaigns(campaignRows);
        setRecipients(await getRecipientsForCampaigns(campaignRows.map((c) => c.id)));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard.');
      } finally {
        setIsLoading(false);
      }
    })();

    getPrice().then(setUsdcPrice);
  }, []);

  const campaignById = useMemo(
    () => new Map(campaigns.map((campaign) => [campaign.id, campaign])),
    [campaigns],
  );

  const stats = useMemo(() => {
    let totalDistributed = 0;
    let pendingClaims = 0;
    let claimedThisWeek = 0;

    for (const recipient of recipients) {
      const campaign = campaignById.get(recipient.campaign_id);

      if (recipient.status === 'claimed') {
        totalDistributed += amountOf(recipient, campaign);
        if (recipient.claimed_at && Date.now() - new Date(recipient.claimed_at).getTime() < WEEK_MS) {
          claimedThisWeek += 1;
        }
      } else if (recipient.status !== 'expired') {
        pendingClaims += 1;
      }
    }

    return {
      totalDistributed,
      activeCampaigns: campaigns.filter((c) => c.status === 'active').length,
      pendingClaims,
      claimedThisWeek,
    };
  }, [recipients, campaigns, campaignById]);

  const perCampaign = useMemo(
    () =>
      campaigns.map((campaign) => {
        const rows = recipients.filter((r) => r.campaign_id === campaign.id);
        const claimed = rows.filter((r) => r.status === 'claimed').length;
        return { campaign, total: rows.length, claimed };
      }),
    [campaigns, recipients],
  );

  const statCards = [
    {
      label: 'Total Distributed',
      value: stats.totalDistributed.toLocaleString('en-US', { minimumFractionDigits: 2 }),
      sub:
        usdcPrice !== null
          ? `≈ $${(stats.totalDistributed * usdcPrice).toFixed(2)} via Reflector`
          : 'USDC claimed by recipients',
    },
    {
      label: 'Active Campaigns',
      value: String(stats.activeCampaigns),
      sub: `${campaigns.length} total`,
    },
    { label: 'Pending Claims', value: String(stats.pendingClaims), sub: 'Links not yet claimed' },
    { label: 'Claimed This Week', value: String(stats.claimedThisWeek), sub: 'Last 7 days' },
  ];

  return (
    <div className="min-h-screen bg-[#080808] text-white flex pb-20 md:pb-0">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 px-6 sm:px-8 liquid-glass border-b border-white/5 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <h1 className="text-white font-medium text-lg">Dashboard</h1>
            <NetworkBadge />
          </div>
          <Link
            to="/campaigns/new"
            className="bg-white text-black font-medium text-sm rounded-full px-4 py-2 hover:bg-white/90 transition-colors flex items-center gap-1.5"
          >
            <Plus size={16} strokeWidth={1.5} /> New Campaign
          </Link>
        </header>

        <main className="p-6 sm:p-8 flex flex-col gap-8 max-w-7xl">
          {isLoading && (
            <div className="flex justify-center py-20 text-white/40">
              <Loader2 size={32} className="animate-spin" />
            </div>
          )}

          {!isLoading && error && (
            <div className="liquid-glass rounded-2xl p-6 text-center text-red-300 text-sm">
              {error}
            </div>
          )}

          {!isLoading && !error && (
            <>
              <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {statCards.map((card) => (
                  <div key={card.label} className="liquid-glass rounded-2xl p-5 flex flex-col gap-2">
                    <span className="text-white/40 text-xs uppercase tracking-wide">
                      {card.label}
                    </span>
                    <span className="text-white text-2xl font-medium font-mono">{card.value}</span>
                    <span className="text-white/30 text-xs">{card.sub}</span>
                  </div>
                ))}
              </section>

              <a
                href={CIRCLE_FAUCET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="liquid-glass rounded-xl px-4 py-3 text-xs text-white/50 hover:text-white flex items-center gap-2 self-start transition-colors"
              >
                💡 Need testnet USDC? Get it free from Circle&apos;s faucet
                <ExternalLink size={12} />
              </a>

              {campaigns.length === 0 ? (
                <div className="liquid-glass rounded-2xl p-8 text-center flex flex-col items-center gap-4">
                  <p className="text-white/40 text-sm">
                    No campaigns yet. Create your first payout to get started.
                  </p>
                  <Link
                    to="/campaigns/new"
                    className="bg-white text-black font-medium text-sm rounded-full px-6 py-2.5 hover:bg-white/90 transition-colors"
                  >
                    Start distributing
                  </Link>
                </div>
              ) : (
                <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {perCampaign.map(({ campaign, total, claimed }) => (
                    <button
                      key={campaign.id}
                      onClick={() => navigate(`/campaigns/${campaign.id}`)}
                      className="liquid-glass rounded-2xl p-5 hover:bg-white/5 transition-colors cursor-pointer text-left flex flex-col gap-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-white font-medium">{campaign.name}</span>
                        <StatusBadge status={campaign.status} />
                      </div>
                      <div className="bg-white/10 rounded-full h-1 overflow-hidden">
                        <div
                          className="bg-white h-full"
                          style={{ width: `${total ? (claimed / total) * 100 : 0}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-white/40 text-xs">
                        <span>
                          {claimed}/{total} claimed
                        </span>
                        <span>{deadlineLabel(campaign.deadline)}</span>
                      </div>
                    </button>
                  ))}
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
