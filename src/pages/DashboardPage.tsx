import { Link } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { RecipientsTable, type Recipient } from '../components/RecipientsTable';
import { Plus, ArrowUpRight } from 'lucide-react';

const mockPayouts: Recipient[] = [
  {
    id: 'pay_101',
    recipient: 'GBA7...9X21',
    amount: '250.00 USDC',
    status: 'Claimed',
    claimedOn: 'Today, 10:42 AM',
  },
  {
    id: 'pay_102',
    recipient: 'GD82...4M90',
    amount: '1,200.00 USDC',
    status: 'Pending',
    claimedOn: '—',
  },
  {
    id: 'pay_103',
    recipient: 'GC19...7P34',
    amount: '500.00 USDC',
    status: 'Claimed',
    claimedOn: 'Yesterday, 4:15 PM',
  },
  {
    id: 'pay_104',
    recipient: 'GBL4...1K88',
    amount: '150.00 USDC',
    status: 'Expired',
    claimedOn: 'Jul 20, 2026',
  },
  {
    id: 'pay_105',
    recipient: 'GDM9...3Q12',
    amount: '850.00 USDC',
    status: 'Pending',
    claimedOn: '—',
  },
];

export function DashboardPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">
      {/* Persistent Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 px-6 sm:px-8 border-b border-white/10 flex items-center justify-between gap-4 sticky top-0 bg-[#0a0a0a]/90 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <h1 className="text-white font-medium text-lg">Acme Crypto Org</h1>
            <span className="liquid-glass rounded-full px-2.5 py-0.5 text-xs text-white/50">
              Stellar Mainnet
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
          {/* Stat Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="liquid-glass rounded-2xl p-6 flex flex-col justify-between gap-2">
              <span className="text-white/40 text-xs uppercase tracking-wide font-medium">
                Total Distributed
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-white text-3xl sm:text-4xl font-medium tracking-tight">
                  142,850.00
                </span>
                <span className="text-white/60 text-sm font-medium">USDC</span>
              </div>
              <span className="text-[#22c55e] text-xs flex items-center gap-1 mt-1 font-medium">
                <ArrowUpRight size={14} /> +12.4% from last month
              </span>
            </div>

            <div className="liquid-glass rounded-2xl p-6 flex flex-col justify-between gap-2">
              <span className="text-white/40 text-xs uppercase tracking-wide font-medium">
                Active Claim Links
              </span>
              <span className="text-white text-3xl sm:text-4xl font-medium tracking-tight">
                24
              </span>
              <span className="text-white/40 text-xs mt-1">18 pending recipient claims</span>
            </div>

            <div className="liquid-glass rounded-2xl p-6 flex flex-col justify-between gap-2">
              <span className="text-white/40 text-xs uppercase tracking-wide font-medium">
                Claim Rate
              </span>
              <span className="text-white text-3xl sm:text-4xl font-medium tracking-tight">
                94.8%
              </span>
              <span className="text-white/40 text-xs mt-1">Avg claim time: 4m 12s</span>
            </div>
          </div>

          {/* Recent Payouts Section */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-white/70 text-sm font-medium">Recent Payouts</h2>
              <Link
                to="/dashboard"
                className="text-white/40 hover:text-white text-xs transition-colors flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowUpRight size={12} />
              </Link>
            </div>

            {/* Reusable Recipients Table */}
            <RecipientsTable data={mockPayouts} limit={5} />
          </div>
        </main>
      </div>
    </div>
  );
}
