import { useState } from 'react';
import { ShieldCheck, Activity, Globe, Zap, ExternalLink } from 'lucide-react';
import { HORIZON_URL, STELLAR_NETWORK } from '@/config/constants';

interface NetworkBadgeProps {
  compact?: boolean;
  className?: string;
}

export function NetworkBadge({ compact = false, className = '' }: NetworkBadgeProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        onMouseEnter={() => setShowDetails(true)}
        onMouseLeave={() => setShowDetails(false)}
        className="liquid-glass border border-white/10 rounded-full px-3 py-1 flex items-center gap-2 hover:bg-white/10 transition-colors text-xs text-white/80 cursor-pointer"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        <span className="font-medium text-[11px] text-white/90">
          {compact ? 'Testnet' : `Stellar ${STELLAR_NETWORK || 'Testnet'}`}
        </span>
      </button>

      {showDetails && (
        <div
          onMouseEnter={() => setShowDetails(true)}
          onMouseLeave={() => setShowDetails(false)}
          className="absolute left-0 top-full mt-2 w-64 liquid-glass rounded-2xl p-4 border border-white/10 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <Globe size={13} className="text-green-400" />
              <span>Network Status</span>
            </div>
            <span className="liquid-glass text-[10px] text-green-400 px-2 py-0.5 rounded-full border border-green-500/20 font-mono">
              Operational
            </span>
          </div>

          <div className="flex flex-col gap-2 text-[11px]">
            <div className="flex items-center justify-between text-white/60">
              <span className="flex items-center gap-1">
                <Activity size={11} /> Horizon RPC
              </span>
              <span className="text-white/90 font-mono">5s finality</span>
            </div>

            <div className="flex items-center justify-between text-white/60">
              <span className="flex items-center gap-1">
                <Zap size={11} /> Fee Payer
              </span>
              <span className="text-green-400 font-mono font-medium">Gasless Active</span>
            </div>

            <div className="flex items-center justify-between text-white/60">
              <span className="flex items-center gap-1">
                <ShieldCheck size={11} /> Protocol
              </span>
              <span className="text-white/90 font-mono">Protocol 21/22</span>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between">
              <a
                href={HORIZON_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-white/40 hover:text-white flex items-center gap-1 font-mono transition-colors"
              >
                View Horizon <ExternalLink size={9} />
              </a>
              <span className="text-[10px] text-white/30 font-mono">SDF Network</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
