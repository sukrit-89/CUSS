import { useState } from 'react';
import { X, CheckCircle2, Lock, Shield, ArrowRight, Wallet, Sparkles } from 'lucide-react';
import { ReRailLogo } from '@/components/ReRailLogo';

interface ClaimPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignName?: string;
  amount?: string;
  assetCode?: string;
}

type SimulationState = 'sponsor' | 'trustline' | 'ready' | 'claimed';

export function ClaimPreviewModal({
  isOpen,
  onClose,
  campaignName = 'Demo Hackathon Grant',
  amount = '50.00',
  assetCode = 'USDC',
}: ClaimPreviewModalProps) {
  const [simState, setSimState] = useState<SimulationState>('ready');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 font-sans">
      <div
        className="liquid-glass rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-white/15 shadow-2xl flex flex-col gap-6 relative animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-white" />
            <span className="text-sm font-semibold text-white">Recipient Claim Page Preview</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* State Simulator Switcher */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-mono text-white/50 uppercase tracking-wider">
            Simulate Recipient Wallet State:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 liquid-glass rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => setSimState('sponsor')}
              className={`py-1.5 px-2 rounded-lg transition-all text-center ${
                simState === 'sponsor' ? 'bg-white/15 text-white font-medium shadow-sm' : 'text-white/50 hover:text-white'
              }`}
            >
              New Account
            </button>
            <button
              onClick={() => setSimState('trustline')}
              className={`py-1.5 px-2 rounded-lg transition-all text-center ${
                simState === 'trustline' ? 'bg-white/15 text-white font-medium shadow-sm' : 'text-white/50 hover:text-white'
              }`}
            >
              Add Trustline
            </button>
            <button
              onClick={() => setSimState('ready')}
              className={`py-1.5 px-2 rounded-lg transition-all text-center ${
                simState === 'ready' ? 'bg-white/15 text-white font-medium shadow-sm' : 'text-white/50 hover:text-white'
              }`}
            >
              Ready to Claim
            </button>
            <button
              onClick={() => setSimState('claimed')}
              className={`py-1.5 px-2 rounded-lg transition-all text-center ${
                simState === 'claimed' ? 'bg-white/15 text-white font-medium shadow-sm' : 'text-white/50 hover:text-white'
              }`}
            >
              Claimed
            </button>
          </div>
        </div>

        {/* Simulated Recipient Device Card */}
        <div className="relative rounded-3xl p-6 liquid-glass border border-white/20 shadow-2xl flex flex-col gap-5 bg-black/40">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ReRailLogo size={20} className="text-white" />
              <span className="text-xs font-semibold text-white">ReRail Payouts</span>
            </div>
            <span className="liquid-glass text-[10px] text-green-400 px-2.5 py-0.5 rounded-full border border-green-500/20 font-mono">
              0 XLM GAS
            </span>
          </div>

          {/* Amount Card */}
          <div className="text-center py-4 flex flex-col items-center">
            <div className="text-[11px] text-white/50 uppercase tracking-widest font-mono mb-1">
              {campaignName}
            </div>
            <div className="text-4xl font-semibold text-white tracking-tight">
              {amount} <span className="text-2xl text-white/70 font-normal">{assetCode}</span>
            </div>
            <div className="text-xs text-white/40 mt-1">Recipient: Alice Chen</div>
          </div>

          {/* Dynamic simulated step */}
          {simState === 'sponsor' && (
            <div className="liquid-glass rounded-2xl p-4 flex flex-col gap-3 border border-purple-500/30 bg-purple-500/5">
              <div className="flex items-center gap-2 text-xs font-semibold text-purple-300">
                <Shield size={14} />
                <span>Sponsored Account Activation</span>
              </div>
              <p className="text-[11px] text-white/70 leading-relaxed">
                Your wallet is brand new. ReRail will sponsor your 1.5 XLM account reserve and open your USDC trustline for free.
              </p>
              <button
                type="button"
                className="w-full bg-white text-black font-medium text-xs py-2.5 rounded-full shadow-lg"
              >
                Activate Account (0 XLM) →
              </button>
            </div>
          )}

          {simState === 'trustline' && (
            <div className="liquid-glass rounded-2xl p-4 flex flex-col gap-3 border border-blue-500/30 bg-blue-500/5">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-300">
                <Wallet size={14} />
                <span>Add USDC Trustline</span>
              </div>
              <p className="text-[11px] text-white/70 leading-relaxed">
                Enable USDC asset receiving in your wallet. Network fee covered by ReRail fee-bump.
              </p>
              <button
                type="button"
                className="w-full bg-white text-black font-medium text-xs py-2.5 rounded-full shadow-lg"
              >
                Enable USDC Trustline (Free) →
              </button>
            </div>
          )}

          {simState === 'ready' && (
            <div className="flex flex-col gap-3">
              <div className="liquid-glass rounded-xl p-3 flex items-center justify-between text-xs border border-white/10">
                <span className="text-white/60 flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-green-400" /> Connected: G...4K3A
                </span>
                <span className="text-white/40 font-mono text-[10px]">Stellar Verified</span>
              </div>
              <button
                type="button"
                className="w-full bg-white text-black font-medium text-xs py-3 rounded-full hover:bg-white/90 transition-colors shadow-lg flex items-center justify-center gap-2"
              >
                <span>Claim {amount} {assetCode}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}

          {simState === 'claimed' && (
            <div className="liquid-glass rounded-2xl p-5 text-center flex flex-col items-center gap-2 border border-green-500/30 bg-green-500/5">
              <div className="w-10 h-10 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center mb-1">
                <CheckCircle2 size={22} />
              </div>
              <div className="text-sm font-semibold text-white">Payout Claimed Successfully</div>
              <div className="text-[11px] text-white/60 font-mono">
                Tx: 8f3a91...c4b2 (Stellar Testnet)
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-white/30 font-mono">
            <Lock size={10} /> Non-custodial Stellar Native Claimable Balance
          </div>
        </div>
      </div>
    </div>
  );
}
