import { useState, useEffect } from 'react';
import { Sidebar } from '../components/Sidebar';
import {
  Key,
  Users,
  Check,
  Zap,
  Copy,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/stores/toast.store';
import {
  HORIZON_URL,
  STELLAR_NETWORK,
  USDC_ISSUER,
} from '@/config/constants';

const FEE_PAYER_PUBLIC_KEY = 'GCKXRI3QTRCNLLSHJRBBAGHIXW26WTQIYQKUYAZNDWXOX6T256TY5D2S';

export function SettingsPage() {
  const auth = useAuthStore();
  const userEmail = auth.user?.email ?? 'organizer@rerail.app';

  const [orgName, setOrgName] = useState(() => {
    return localStorage.getItem('rerail_org_name') || 'Default Organization';
  });
  const [defaultExpiryDays, setDefaultExpiryDays] = useState(() => {
    return localStorage.getItem('rerail_default_expiry') || '30';
  });

  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedFeePayer, setCopiedFeePayer] = useState(false);

  useEffect(() => {
    localStorage.setItem('rerail_org_name', orgName);
  }, [orgName]);

  useEffect(() => {
    localStorage.setItem('rerail_default_expiry', defaultExpiryDays);
  }, [defaultExpiryDays]);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(auth.user?.id ?? '');
    setCopiedKey(true);
    toast.success('Organizer User ID copied to clipboard');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyFeePayer = () => {
    navigator.clipboard.writeText(FEE_PAYER_PUBLIC_KEY);
    setCopiedFeePayer(true);
    toast.success('Fee Payer public address copied');
    setTimeout(() => setCopiedFeePayer(false), 2000);
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('rerail_org_name', orgName);
    localStorage.setItem('rerail_default_expiry', defaultExpiryDays);
    toast.success('Organization settings saved successfully');
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white flex font-sans pb-20 md:pb-0">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 px-6 sm:px-8 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#080808]/90 backdrop-blur-md z-10">
          <h1 className="text-white font-medium text-lg">Organization Settings</h1>
          <span className="liquid-glass text-xs text-white/70 px-3 py-1 rounded-full border border-white/10 font-mono">
            {STELLAR_NETWORK || 'Testnet'}
          </span>
        </header>

        <main className="p-6 sm:p-8 flex flex-col gap-8 max-w-3xl">
          {/* Section 1: Organization Profile */}
          <div>
            <h2 className="text-white/70 text-sm font-medium mb-3 flex items-center gap-2">
              <Users size={16} strokeWidth={1.5} />
              <span>Organization & Account</span>
            </h2>
            <form
              onSubmit={handleSavePreferences}
              className="liquid-glass rounded-2xl p-6 flex flex-col gap-5 border border-white/10"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-white/50 text-xs font-medium uppercase tracking-wider">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. Stellar Community Grants"
                    className="liquid-glass rounded-xl px-4 py-2.5 text-white text-xs outline-none focus:ring-1 focus:ring-white/20 border border-white/10"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-white/50 text-xs font-medium uppercase tracking-wider">
                    Default Claim Expiry
                  </label>
                  <select
                    value={defaultExpiryDays}
                    onChange={(e) => setDefaultExpiryDays(e.target.value)}
                    className="liquid-glass rounded-xl px-4 py-2.5 text-white text-xs outline-none focus:ring-1 focus:ring-white/20 border border-white/10 bg-[#080808]"
                  >
                    <option value="7">7 Days</option>
                    <option value="14">14 Days</option>
                    <option value="30">30 Days (Standard)</option>
                    <option value="90">90 Days (Quarterly)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-t border-white/5 pt-4">
                <div>
                  <div className="text-white/80 text-xs font-medium">{userEmail}</div>
                  <div className="text-white/40 text-[11px]">Primary Organizer Account</div>
                </div>
                <span className="liquid-glass rounded-full px-3 py-1 text-xs text-white/60 font-medium border border-white/10">
                  Owner
                </span>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="bg-white text-black font-medium text-xs px-5 py-2 rounded-full hover:bg-white/90 transition-colors shadow-md cursor-pointer"
                >
                  Save Preferences
                </button>
              </div>
            </form>
          </div>

          {/* Section 2: Gasless Infrastructure & Fee Payer */}
          <div>
            <h2 className="text-white/70 text-sm font-medium mb-3 flex items-center gap-2">
              <Zap size={16} strokeWidth={1.5} />
              <span>Gasless Infrastructure Status</span>
            </h2>
            <div className="liquid-glass rounded-2xl p-6 flex flex-col gap-4 border border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-white text-xs font-medium block">
                    Serverless Fee Payer
                  </span>
                  <span className="text-white/40 text-[11px]">
                    Sponsors account reserves, trustlines, and fee-bump claim envelopes
                  </span>
                </div>
                <span className="liquid-glass text-xs text-green-400 px-2.5 py-0.5 rounded-full border border-green-500/20 font-mono">
                  ● Active & Funded
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-white/50 text-[11px] font-mono uppercase tracking-wider">
                  Fee Payer Public Key
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={FEE_PAYER_PUBLIC_KEY}
                    className="flex-1 liquid-glass rounded-xl px-4 py-2 text-white/80 text-xs font-mono outline-none border border-white/10 select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopyFeePayer}
                    className="liquid-glass rounded-xl px-3 py-2 text-xs text-white/80 hover:text-white transition-colors border border-white/10 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedFeePayer ? (
                      <Check size={14} className="text-green-400" />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                <div className="liquid-glass rounded-xl p-3 border border-white/5 text-xs">
                  <div className="text-white/40 text-[10px] font-mono uppercase">Network</div>
                  <div className="text-white font-medium mt-0.5">Stellar Testnet</div>
                </div>
                <div className="liquid-glass rounded-xl p-3 border border-white/5 text-xs">
                  <div className="text-white/40 text-[10px] font-mono uppercase">USDC Issuer</div>
                  <div className="text-white font-mono text-[11px] mt-0.5 truncate" title={USDC_ISSUER}>
                    {USDC_ISSUER.slice(0, 8)}...{USDC_ISSUER.slice(-6)}
                  </div>
                </div>
                <div className="liquid-glass rounded-xl p-3 border border-white/5 text-xs">
                  <div className="text-white/40 text-[10px] font-mono uppercase">Horizon RPC</div>
                  <a
                    href={HORIZON_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/80 hover:text-white flex items-center gap-1 mt-0.5 font-mono text-[11px]"
                  >
                    <span>Online</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Developer Identifiers */}
          <div>
            <h2 className="text-white/70 text-sm font-medium mb-3 flex items-center gap-2">
              <Key size={16} strokeWidth={1.5} />
              <span>Developer Identifiers & Access</span>
            </h2>
            <div className="liquid-glass rounded-2xl p-6 flex flex-col gap-4 border border-white/10">
              <div className="flex flex-col gap-1.5">
                <label className="text-white/50 text-[11px] font-mono uppercase tracking-wider">
                  Organizer UUID
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={auth.user?.id ?? '—'}
                    className="flex-1 liquid-glass rounded-xl px-4 py-2.5 text-white/80 text-xs font-mono outline-none border border-white/10"
                  />
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="liquid-glass rounded-xl px-3 py-2.5 text-xs text-white/80 hover:text-white transition-colors border border-white/10 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey ? (
                      <Check size={14} className="text-green-400" />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                </div>
              </div>

              <div className="border-t border-white/5 pt-3 flex items-center justify-between text-xs text-white/40">
                <span>Every campaign you create is bound to this organizer ID with Row Level Security.</span>
                <span className="flex items-center gap-1 text-green-400 font-mono text-[11px]">
                  <ShieldCheck size={13} /> RLS Protected
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
