import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Shield,
  Cpu,
  Code2,
  TrendingUp,
  HelpCircle,
  Check,
  Copy,
  ExternalLink,
  Search,
  ArrowLeft,
  Lock,
  Server,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { ReRailLogo } from '@/components/ReRailLogo';
import { PUBLIC_BG_VIDEO } from '@/config/constants';

interface Section {
  id: string;
  title: string;
  category: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  description: string;
}

const SECTIONS: Section[] = [
  {
    id: 'overview',
    title: 'Overview & Status',
    category: 'Getting Started',
    icon: BookOpen,
    description: 'What is live today, what is testnet-only, and what reviewers should verify.',
  },
  {
    id: 'review-runbook',
    title: 'Testnet Review Runbook',
    category: 'Reviewer Guide',
    icon: CheckCircle2,
    description: 'Fast checklist for creating a campaign and claiming as a recipient on testnet.',
  },
  {
    id: 'architecture',
    title: 'Stellar Gasless Architecture',
    category: 'Protocol Primitives',
    icon: Cpu,
    description: 'Native Claimable Balances, Fee-Bump envelopes, and Sponsored Accounts.',
  },
  {
    id: 'security',
    title: 'Gasless Security & Rate Limits',
    category: 'Security & Integrity',
    icon: Shield,
    description: 'Atomic attempt caps (begin_gasless_op), token hashing, and RLS policies.',
  },
  {
    id: 'api-reference',
    title: 'Serverless API Reference',
    category: 'Developer API',
    icon: Code2,
    description: 'Detailed specifications for all Vercel serverless endpoints.',
  },
  {
    id: 'defi-integrations',
    title: 'DeFi Feeds & Yield Intelligence',
    category: 'DeFi Ecosystem',
    icon: TrendingUp,
    description: 'Reflector Oracle price feeds, Blend Protocol APY, and SoroSwap quotes.',
  },
  {
    id: 'faq',
    title: 'FAQ & Troubleshooting',
    category: 'Support',
    icon: HelpCircle,
    description: 'Common questions, testnet USDC setup, and wallet resolution steps.',
  },
];

export function DocsPage() {
  const [activeSection, setActiveSection] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const filteredSections = SECTIONS.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#080808] text-white flex flex-col font-sans">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header className="h-16 px-6 sm:px-12 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#080808]/90 backdrop-blur-md z-30">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm mr-2"
          >
            <ArrowLeft size={16} /> Back to Home
          </Link>
          <div className="h-4 w-[1px] bg-white/10 hidden sm:block" />
          <Link to="/" className="flex items-center gap-2.5 text-white font-medium text-lg">
            <ReRailLogo size={22} strokeWidth={1.5} className="text-white" />
            <span>ReRail</span>
            <span className="liquid-glass text-xs text-white/60 px-2 py-0.5 rounded-full font-mono font-normal border border-white/10">
              Docs v1.0
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {/* Search bar */}
          <div className="relative hidden md:block">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="liquid-glass rounded-full pl-9 pr-4 py-1.5 text-xs text-white placeholder-white/40 outline-none focus:ring-1 focus:ring-white/20 w-56"
            />
          </div>

          <Link
            to="/login"
            className="bg-white text-black font-medium text-xs px-4 py-2 rounded-full hover:bg-white/90 transition-colors"
          >
            Start Distributing
          </Link>
        </div>
      </header>

      {/* ── HERO BANNER ─────────────────────────────────────────────────── */}
      <div className="relative border-b border-white/10 overflow-hidden bg-gradient-to-b from-white/[0.03] to-transparent py-10 px-6 sm:px-12">
        <video
          className="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none"
          autoPlay
          muted
          loop
          playsInline
          src={PUBLIC_BG_VIDEO}
        />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex items-center gap-2 text-white/50 text-xs font-mono mb-2 uppercase tracking-widest">
            <BookOpen size={14} /> Documentation & Technical Specs
          </div>
          <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-white mb-3">
            ReRail Developer & Protocol Guide
          </h1>
          <p className="text-white/60 text-sm max-w-2xl leading-relaxed">
            Gasless USDC payout infrastructure on Stellar. Learn how ReRail eliminates XLM gas friction, sponsors recipient account reserves, and guarantees non-custodial distributions via native Stellar primitives.
          </p>
        </div>
      </div>

      {/* ── MAIN CONTENT AREA ───────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col md:flex-row px-6 sm:px-12 py-8 gap-8">
        {/* ── SIDEBAR NAVIGATION ─────────────────────────────────────────── */}
        <aside className="w-full md:w-64 shrink-0 flex flex-col gap-6">
          <div className="md:sticky md:top-24 flex flex-col gap-4">
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider px-2">
              Navigation
            </p>

            <nav className="flex flex-col gap-1">
              {filteredSections.map((s) => {
                const Icon = s.icon;
                const isActive = activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    className={`flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                      isActive
                        ? 'liquid-glass bg-white/10 text-white font-medium border-l-2 border-white'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon size={16} className={`mt-0.5 shrink-0 ${isActive ? 'text-white' : 'text-white/40'}`} />
                    <div>
                      <div className="text-xs font-medium leading-snug">{s.title}</div>
                      <div className="text-[10px] text-white/40 font-mono mt-0.5">{s.category}</div>
                    </div>
                  </button>
                );
              })}
            </nav>

            <div className="liquid-glass rounded-xl p-4 flex flex-col gap-2 mt-4 border border-white/10">
              <div className="flex items-center gap-2 text-xs font-medium text-white">
                <Lock size={12} className="text-green-400" /> Security Status
              </div>
              <p className="text-[11px] text-white/50 leading-relaxed">
                Zero custodial keys held. Service role keys isolated in Vercel serverless functions.
              </p>
              <a
                href="https://github.com/sukrit-89/CUSS"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-white/70 hover:text-white inline-flex items-center gap-1 mt-1 font-mono"
              >
                View GitHub Repository <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </aside>

        {/* ── SECTION CONTENT PANE ──────────────────────────────────────── */}
        <main className="flex-1 min-w-0 flex flex-col gap-12">
          {/* SECTION 1: OVERVIEW */}
          {activeSection === 'overview' && (
            <div className="flex flex-col gap-6">
              <div className="border-b border-white/10 pb-4">
                <span className="text-white/40 text-xs font-mono uppercase tracking-wider">
                  Getting Started
                </span>
                <h2 className="text-2xl font-medium text-white mt-1 flex items-center gap-3">
                  Overview & Status
                  <span className="liquid-glass text-xs text-green-400 px-2.5 py-0.5 rounded-full border border-green-500/30">
                    Testnet MVP
                  </span>
                </h2>
              </div>

              <p className="text-white/70 text-sm leading-relaxed">
                ReRail solves the onboarding wall in crypto payouts. When organizations distribute hackathon prizes, community grants, or open-source bounties, recipients often lack Stellar accounts or XLM gas tokens to claim their funds.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="liquid-glass rounded-xl p-4 flex flex-col gap-2">
                  <div className="text-xs font-medium text-white/50 uppercase tracking-wider">Implemented</div>
                  <div className="text-sm font-medium text-white">Organizer payout flow</div>
                  <p className="text-xs text-white/50">
                    Google-auth dashboard, CSV/manual recipients, USDC treasury checks, claimable balance batch creation, and Horizon sync.
                  </p>
                </div>
                <div className="liquid-glass rounded-xl p-4 flex flex-col gap-2">
                  <div className="text-xs font-medium text-white/50 uppercase tracking-wider">Implemented</div>
                  <div className="text-sm font-medium text-white">Gasless recipient claim</div>
                  <p className="text-xs text-white/50">
                    Public claim links resolve status, guide wallet setup, sponsor account/trustline prerequisites, and fee-bump final claims.
                  </p>
                </div>
                <div className="liquid-glass rounded-xl p-4 flex flex-col gap-2">
                  <div className="text-xs font-medium text-white/50 uppercase tracking-wider">Optional</div>
                  <div className="text-sm font-medium text-white">Soroban registry mirror</div>
                  <p className="text-xs text-white/50">
                    Registry contract is built and tested. Payouts still work if registry env vars are left blank.
                  </p>
                </div>
              </div>

              <div className="liquid-glass rounded-xl p-5 border border-amber-500/20 flex flex-col gap-3">
                <h3 className="text-sm font-medium text-amber-200">Current testnet limits</h3>
                <ul className="text-xs text-white/60 leading-relaxed space-y-2">
                  <li>• SoroSwap is quote-only here; campaigns must be funded with testnet USDC directly.</li>
                  <li>• Email delivery is not enabled; organizers export or copy claim links manually.</li>
                  <li>• Production monitoring, Sentry, and public user-review metrics are still follow-up work.</li>
                </ul>
              </div>

              <div className="liquid-glass rounded-xl p-5 border border-white/10 flex flex-col gap-3">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                  <ReRailLogo size={16} /> One-Line Pitch
                </h3>
                <blockquote className="text-sm italic text-white/80 border-l-2 border-white/30 pl-4 py-1">
                  &ldquo;Set up a grant. Send a link. Get paid — no XLM or prior wallet friction required.&rdquo;
                </blockquote>
              </div>
            </div>
          )}

          {/* SECTION 2: TESTNET REVIEW RUNBOOK */}
          {activeSection === 'review-runbook' && (
            <div className="flex flex-col gap-6">
              <div className="border-b border-white/10 pb-4">
                <span className="text-white/40 text-xs font-mono uppercase tracking-wider">
                  Reviewer Guide
                </span>
                <h2 className="text-2xl font-medium text-white mt-1">
                  Testnet Review Runbook
                </h2>
              </div>

              <div className="liquid-glass rounded-xl p-5 border border-white/10">
                <h3 className="text-sm font-medium text-white mb-3">Before you start</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-white/60">
                  <div className="liquid-glass rounded-lg p-3">1. Use Stellar Testnet in your wallet.</div>
                  <div className="liquid-glass rounded-lg p-3">2. Fund the organizer wallet with testnet USDC.</div>
                  <div className="liquid-glass rounded-lg p-3">3. Keep the recipient wallet address ready.</div>
                  <div className="liquid-glass rounded-lg p-3">4. Run on desktop for wallet extension support.</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="liquid-glass rounded-xl p-5 border border-white/10 flex flex-col gap-3">
                  <h3 className="text-sm font-medium text-white">Organizer path</h3>
                  <ol className="text-xs text-white/60 leading-relaxed space-y-2 list-decimal list-inside">
                    <li>Log in with Google and open Dashboard.</li>
                    <li>Create a new campaign with a future deadline.</li>
                    <li>Connect the funded organizer wallet.</li>
                    <li>Add recipients by CSV or manual input.</li>
                    <li>Sign the claimable balance transaction batch.</li>
                    <li>Copy or export generated claim links from the review screen.</li>
                  </ol>
                </div>

                <div className="liquid-glass rounded-xl p-5 border border-white/10 flex flex-col gap-3">
                  <h3 className="text-sm font-medium text-white">Recipient path</h3>
                  <ol className="text-xs text-white/60 leading-relaxed space-y-2 list-decimal list-inside">
                    <li>Open the claim link on desktop.</li>
                    <li>Connect the wallet matching the recipient address.</li>
                    <li>If needed, let ReRail sponsor account activation.</li>
                    <li>If needed, enable the USDC trustline with a fee-bumped transaction.</li>
                    <li>Claim USDC and open the Stellar Explorer transaction link.</li>
                  </ol>
                </div>
              </div>

              <div className="liquid-glass rounded-xl p-5 border border-white/10 flex flex-col gap-3">
                <h3 className="text-sm font-medium text-white">What counts as a successful review</h3>
                <ul className="text-xs text-white/60 leading-relaxed space-y-2">
                  <li>• Campaign status becomes active after Horizon sync finds claimable balance IDs.</li>
                  <li>• Recipient receives USDC with no XLM fee paid by the recipient wallet.</li>
                  <li>• Campaign detail shows claimed status and an exportable recipient report.</li>
                  <li>• Reviewer can share one friction point or bug for the documented iteration.</li>
                </ul>
              </div>
            </div>
          )}

          {/* SECTION 3: ARCHITECTURE */}
          {activeSection === 'architecture' && (
            <div className="flex flex-col gap-6">
              <div className="border-b border-white/10 pb-4">
                <span className="text-white/40 text-xs font-mono uppercase tracking-wider">
                  Protocol Primitives
                </span>
                <h2 className="text-2xl font-medium text-white mt-1">
                  Stellar Gasless Architecture
                </h2>
              </div>

              <p className="text-white/70 text-sm leading-relaxed">
                ReRail relies directly on first-class native Stellar protocol primitives without smart contract risk:
              </p>

              <div className="flex flex-col gap-4">
                {/* Primitive 1 */}
                <div className="liquid-glass rounded-xl p-5 border border-white/10 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white flex items-center gap-2">
                      <Layers size={16} /> 1. Native Claimable Balances
                    </span>
                    <span className="text-[11px] font-mono text-white/40">Protocol 15</span>
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Funds are locked in native on-chain entries with relative time predicates. Recipient can claim anytime before deadline; organizer can reclaim expired funds after deadline.
                  </p>
                  <div className="bg-black/50 rounded-lg p-3 font-mono text-xs text-white/80 overflow-x-auto">
                    <pre>{`Operation.createClaimableBalance({
  asset: USDC_ASSET,
  amount: "50.0000000",
  claimants: [
    new Claimant(recipientAddress, Claimant.predicateBeforeRelativeTime(deadlineSeconds)),
    new Claimant(organizerAddress, Claimant.predicateNot(Claimant.predicateBeforeRelativeTime(deadlineSeconds)))
  ]
})`}</pre>
                  </div>
                </div>

                {/* Primitive 2 */}
                <div className="liquid-glass rounded-xl p-5 border border-white/10 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white flex items-center gap-2">
                      <Server size={16} /> 2. Fee-Bump Envelopes
                    </span>
                    <span className="text-[11px] font-mono text-white/40">Protocol 13</span>
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Recipients sign an inner transaction with Freighter. ReRail&apos;s serverless fee-payer signs an outer envelope, paying network gas fees so the recipient pays 0 XLM.
                  </p>
                </div>

                {/* Primitive 3 */}
                <div className="liquid-glass rounded-xl p-5 border border-white/10 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white flex items-center gap-2">
                      <Lock size={16} /> 3. Sponsored Account & Trustline Creation
                    </span>
                    <span className="text-[11px] font-mono text-white/40">Protocol 19</span>
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed">
                    For brand-new wallets, ReRail executes <code className="text-white/80">beginSponsoringFutureReserves</code> + <code className="text-white/80">createAccount</code> + <code className="text-white/80">changeTrust</code> + <code className="text-white/80">endSponsoringFutureReserves</code>. ReRail covers account reserves; recipient pays nothing.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: SECURITY */}
          {activeSection === 'security' && (
            <div className="flex flex-col gap-6">
              <div className="border-b border-white/10 pb-4">
                <span className="text-white/40 text-xs font-mono uppercase tracking-wider">
                  Security & Integrity
                </span>
                <h2 className="text-2xl font-medium text-white mt-1">
                  Gasless Security & Rate Limits
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="liquid-glass rounded-xl p-5 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Shield size={16} className="text-green-400" /> Atomic Attempt Caps
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Database function <code className="text-white/80">begin_gasless_op</code> limits gasless attempts (trustline, sponsor) per link to reduce fee-payer drainage risk.
                  </p>
                </div>

                <div className="liquid-glass rounded-xl p-5 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Lock size={16} className="text-blue-400" /> Row Level Security (RLS)
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Supabase enforces <code className="text-white/80">organizer_id = auth.uid()</code> across all campaigns and recipients. Organizers can never view or modify other campaigns.
                  </p>
                </div>
              </div>

              <div className="liquid-glass rounded-xl p-5 border border-white/10">
                <h3 className="text-sm font-medium text-white mb-3">Threat Mitigation Matrix</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="text-white/40 uppercase font-mono border-b border-white/10">
                      <tr>
                        <th className="py-2 px-3">Threat Vector</th>
                        <th className="py-2 px-3">Mitigation Strategy</th>
                        <th className="py-2 px-3">Severity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-white/70">
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-white">Early Organizer Reclaim</td>
                        <td className="py-2.5 px-3">Protocol-level relative time predicates</td>
                        <td className="py-2.5 px-3 text-green-400">Mitigated</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-white">Claim Link Enumeration</td>
                        <td className="py-2.5 px-3">UUID v4 (122-bit entropy) + SHA-256 token hashing</td>
                        <td className="py-2.5 px-3 text-green-400">Negligible</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-white">Fee Payer Replay Flood</td>
                        <td className="py-2.5 px-3">begin_gasless_op attempt caps and strict inner transaction validation</td>
                        <td className="py-2.5 px-3 text-amber-300">Reduced</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-white">CSV Formula Injection</td>
                        <td className="py-2.5 px-3">Sanitizes =, +, -, @ formula characters</td>
                        <td className="py-2.5 px-3 text-green-400">Mitigated</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5: API REFERENCE */}
          {activeSection === 'api-reference' && (
            <div className="flex flex-col gap-6">
              <div className="border-b border-white/10 pb-4">
                <span className="text-white/40 text-xs font-mono uppercase tracking-wider">
                  Developer API
                </span>
                <h2 className="text-2xl font-medium text-white mt-1">
                  Serverless API Reference
                </h2>
              </div>

              <p className="text-white/70 text-sm leading-relaxed">
                ReRail exposes Vercel serverless functions for claim resolution, gasless fee-bumping, and sponsored account creation.
              </p>

              {/* Endpoint 1 */}
              <div className="liquid-glass rounded-xl p-5 border border-white/10 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="bg-green-500/20 text-green-400 font-mono text-xs px-2.5 py-1 rounded-md font-medium">
                      GET
                    </span>
                    <code className="text-white text-xs font-mono">/api/claim/:token/resolve</code>
                  </div>
                  <span className="text-[11px] text-white/40 font-mono">Public</span>
                </div>
                <p className="text-xs text-white/60">
                  Resolves claim token metadata (amount, status, deadline, recipient address) for the recipient claim page.
                </p>
                <div className="relative">
                  <button
                    onClick={() =>
                      copyCode(
                        `curl http://localhost:5173/api/claim/68916417-5ea8-4869-9a38-1c9a14771182/resolve`,
                        'api-1'
                      )
                    }
                    className="absolute right-2 top-2 text-white/40 hover:text-white text-xs flex items-center gap-1 bg-white/10 px-2 py-1 rounded"
                  >
                    {copiedSnippet === 'api-1' ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  </button>
                  <pre className="bg-black/50 rounded-lg p-3 font-mono text-xs text-white/80 overflow-x-auto">
{`{
  "name": "Alice Chen",
  "amount": "50.00",
  "asset_code": "USDC",
  "token": "68916417-5ea8-4869-9a38-1c9a14771182",
  "status": "pending",
  "campaign_name": "ETH Global Grants",
  "deadline": "2026-09-01T00:00:00Z",
  "balance_id": "00000000a39c812..."
}`}
                  </pre>
                </div>
              </div>

              {/* Endpoint 2 */}
              <div className="liquid-glass rounded-xl p-5 border border-white/10 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-500/20 text-blue-400 font-mono text-xs px-2.5 py-1 rounded-md font-medium">
                      POST
                    </span>
                    <code className="text-white text-xs font-mono">/api/claim/:token/execute</code>
                  </div>
                  <span className="text-[11px] text-white/40 font-mono">Fee Payer Signed</span>
                </div>
                <p className="text-xs text-white/60">
                  Submits recipient signed claim inner transaction inside a Fee-Bump envelope.
                </p>
              </div>

              {/* Endpoint 3 */}
              <div className="liquid-glass rounded-xl p-5 border border-white/10 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="bg-purple-500/20 text-purple-400 font-mono text-xs px-2.5 py-1 rounded-md font-medium">
                      POST
                    </span>
                    <code className="text-white text-xs font-mono">/api/account/:token/sponsor</code>
                  </div>
                  <span className="text-[11px] text-white/40 font-mono">Sponsored Creation</span>
                </div>
                <p className="text-xs text-white/60">
                  Builds and co-signs sponsored account activation & USDC trustline creation for new recipient wallets.
                </p>
              </div>

              <div className="liquid-glass rounded-xl p-5 border border-white/10 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-500/20 text-blue-400 font-mono text-xs px-2.5 py-1 rounded-md font-medium">
                      POST
                    </span>
                    <code className="text-white text-xs font-mono">/api/campaign/sync</code>
                  </div>
                  <span className="text-[11px] text-white/40 font-mono">Organizer Auth</span>
                </div>
                <p className="text-xs text-white/60">
                  Reads Horizon effects after a funding transaction and writes claimable balance IDs back to recipients.
                </p>
              </div>
            </div>
          )}

          {/* SECTION 6: DEFI INTEGRATIONS */}
          {activeSection === 'defi-integrations' && (
            <div className="flex flex-col gap-6">
              <div className="border-b border-white/10 pb-4">
                <span className="text-white/40 text-xs font-mono uppercase tracking-wider">
                  DeFi Ecosystem
                </span>
                <h2 className="text-2xl font-medium text-white mt-1">
                  DeFi Feeds & Yield Intelligence
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="liquid-glass rounded-xl p-5 flex flex-col gap-3">
                  <div className="text-xs font-mono text-amber-400 uppercase tracking-wider">Oracle Feed</div>
                  <h3 className="text-sm font-medium text-white">Reflector Oracle</h3>
                  <p className="text-xs text-white/60">
                    Reads live Stellar DEX price feeds directly from the Reflector Soroban contract to display USD equivalents.
                  </p>
                </div>

                <div className="liquid-glass rounded-xl p-5 flex flex-col gap-3">
                  <div className="text-xs font-mono text-cyan-400 uppercase tracking-wider">Yield Pool</div>
                  <h3 className="text-sm font-medium text-white">Blend Protocol APY</h3>
                  <p className="text-xs text-white/60">
                    Queries Blend money market pools to project yield earned on unclaimed campaign treasuries.
                  </p>
                </div>

                <div className="liquid-glass rounded-xl p-5 flex flex-col gap-3">
                  <div className="text-xs font-mono text-green-400 uppercase tracking-wider">DEX Router</div>
                  <h3 className="text-sm font-medium text-white">SoroSwap Pricing</h3>
                  <p className="text-xs text-white/60">
                    Calculates XLM-to-USDC rates during campaign funding. Execution is intentionally disabled on testnet until liquidity and routing are verified.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 7: FAQ */}
          {activeSection === 'faq' && (
            <div className="flex flex-col gap-6">
              <div className="border-b border-white/10 pb-4">
                <span className="text-white/40 text-xs font-mono uppercase tracking-wider">
                  Support
                </span>
                <h2 className="text-2xl font-medium text-white mt-1">
                  FAQ & Troubleshooting
                </h2>
              </div>

              <div className="flex flex-col gap-4">
                <div className="liquid-glass rounded-xl p-5 flex flex-col gap-2">
                  <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-green-400" /> Do recipients need XLM to claim?
                  </h3>
                  <p className="text-xs text-white/60 leading-relaxed">
                    No. ReRail wraps every claim transaction in a native Stellar Fee-Bump envelope. ReRail pays network gas fees; recipients spend 0 XLM.
                  </p>
                </div>

                <div className="liquid-glass rounded-xl p-5 flex flex-col gap-2">
                  <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-green-400" /> What happens if a recipient never claims before the deadline?
                  </h3>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Claimable Balance time predicates grant the organizer permission to reclaim unclaimed funds back to their treasury after the deadline passes.
                  </p>
                </div>

                <div className="liquid-glass rounded-xl p-5 flex flex-col gap-2">
                  <h3 className="text-sm font-medium text-white flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-green-400" /> Which wallets are supported?
                  </h3>
                  <p className="text-xs text-white/60 leading-relaxed">
                    ReRail supports all major Stellar wallets through Stellar Wallets Kit: Freighter, Albedo, Hana, xBull, and Lobstr.
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="bg-[#080808] border-t border-white/10 mt-auto py-8">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
          <div className="flex items-center gap-2">
            <ReRailLogo size={16} className="text-white/60" />
            <span className="text-white/60 font-medium">ReRail Documentation</span>
            <span>© 2026</span>
          </div>

          <div className="flex items-center gap-6">
            <Link to="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <Link to="/login" className="hover:text-white transition-colors">
              Dashboard
            </Link>
            <a
              href="https://github.com/sukrit-89/CUSS"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
