import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Wallet, Loader2, CheckCircle2, XCircle, Copy, Check, RefreshCw } from 'lucide-react';

type ClaimState = 'idle' | 'loading' | 'success' | 'error' | 'already-claimed';

export function ClaimPage() {
  const { id } = useParams<{ id: string }>();
  const claimId = id || 'demo';

  const [claimState, setClaimState] = useState<ClaimState>('idle');
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [copiedTx, setCopiedTx] = useState(false);

  const mockTxHash = '0x8f3a...c91e';
  const orgName = 'Acme Corp';
  const payoutAmount = '250.00 USDC';

  const handleConnectWallet = () => {
    // Simulate Freighter wallet connection
    setWalletConnected(true);
    setWalletAddress('GBA7...9X21');
  };

  const handleClaim = () => {
    if (!walletConnected) return;
    setClaimState('loading');
    setTimeout(() => {
      setClaimState('success');
    }, 1800);
  };

  const handleCopyTx = () => {
    navigator.clipboard.writeText('0x8f3a74b92c1048d2e68a3f91c9e');
    setCopiedTx(true);
    setTimeout(() => setCopiedTx(false), 2000);
  };

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] text-white flex flex-col justify-between items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />

      {/* Header link */}
      <header className="w-full max-w-md flex justify-between items-center py-4">
        <Link to="/" className="text-white/40 hover:text-white text-xs transition-colors">
          ← ReRail
        </Link>
        {/* Quick state switcher for demonstration */}
        <div className="flex gap-1 text-[10px] bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setClaimState('idle')}
            className={`px-2 py-0.5 rounded ${claimState === 'idle' ? 'bg-white/20 text-white' : 'text-white/40'}`}
          >
            Idle
          </button>
          <button
            onClick={() => setClaimState('success')}
            className={`px-2 py-0.5 rounded ${claimState === 'success' ? 'bg-white/20 text-white' : 'text-white/40'}`}
          >
            Success
          </button>
          <button
            onClick={() => setClaimState('error')}
            className={`px-2 py-0.5 rounded ${claimState === 'error' ? 'bg-white/20 text-white' : 'text-white/40'}`}
          >
            Expired
          </button>
        </div>
      </header>

      {/* Main Centered Card */}
      <main className="w-full max-w-md my-auto">
        <div className="liquid-glass rounded-2xl p-8 flex flex-col gap-1 shadow-2xl">
          {/* STATE: IDLE */}
          {claimState === 'idle' && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-white/40 text-xs uppercase tracking-wide">
                  You've received a payout
                </span>
                <span className="text-white/30 font-mono text-[10px]">#{claimId}</span>
              </div>
              <h1 className="text-white text-5xl font-medium tracking-tight mt-1 mb-1">
                {payoutAmount}
              </h1>
              <p className="text-white/60 text-sm">
                from <span className="text-white font-medium">{orgName}</span>
              </p>

              <div className="border-t border-white/10 my-6" />

              {/* Wallet Connection */}
              {!walletConnected ? (
                <button
                  onClick={handleConnectWallet}
                  className="liquid-glass rounded-xl px-4 py-3 text-white text-sm font-medium flex items-center justify-center gap-2.5 hover:bg-white/5 transition-colors mb-3"
                >
                  <Wallet size={18} strokeWidth={1.5} />
                  <span>Connect Freighter Wallet</span>
                </button>
              ) : (
                <div className="liquid-glass rounded-xl px-4 py-3 flex items-center justify-between text-sm mb-3">
                  <div className="flex items-center gap-2">
                    <Wallet size={16} strokeWidth={1.5} className="text-[#22c55e]" />
                    <span className="text-white/80 font-mono text-xs">{walletAddress}</span>
                  </div>
                  <span className="text-xs text-[#22c55e] font-medium">Connected</span>
                </div>
              )}

              {/* Claim Action Button */}
              <button
                onClick={handleClaim}
                disabled={!walletConnected}
                className={`w-full font-medium rounded-full px-6 py-3 text-sm transition-colors ${
                  walletConnected
                    ? 'bg-white text-black hover:bg-white/90 cursor-pointer'
                    : 'bg-white/20 text-white/40 cursor-not-allowed'
                }`}
              >
                Claim USDC
              </button>

              <p className="text-white/30 text-xs text-center mt-4">
                No XLM required. Gas covered by ReRail.
              </p>
            </>
          )}

          {/* STATE: LOADING */}
          {claimState === 'loading' && (
            <div className="py-10 flex flex-col items-center justify-center text-center gap-4">
              <Loader2 size={40} strokeWidth={1.5} className="animate-spin text-white/80" />
              <div className="flex flex-col gap-1">
                <h3 className="text-white text-lg font-medium">Submitting claim...</h3>
                <p className="text-white/40 text-xs">Broadcasting transaction to Stellar network</p>
              </div>
            </div>
          )}

          {/* STATE: SUCCESS */}
          {claimState === 'success' && (
            <div className="py-4 flex flex-col items-center justify-center text-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[#22c55e]/15 flex items-center justify-center text-[#22c55e]">
                <CheckCircle2 size={32} strokeWidth={1.5} />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-white text-2xl font-medium tracking-tight">
                  Claimed Successfully
                </h2>
                <p className="text-white/60 text-sm">
                  {payoutAmount} transferred from {orgName}
                </p>
              </div>

              <div className="border-t border-white/10 w-full my-3" />

              <div className="w-full flex items-center justify-between liquid-glass rounded-xl px-4 py-3 text-xs">
                <span className="text-white/40">Tx Hash</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-white/80">{mockTxHash}</span>
                  <button
                    onClick={handleCopyTx}
                    className="text-white/50 hover:text-white transition-colors"
                  >
                    {copiedTx ? <Check size={14} className="text-[#22c55e]" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <button
                onClick={() => setClaimState('idle')}
                className="mt-2 text-white/40 hover:text-white text-xs flex items-center gap-1 transition-colors"
              >
                <RefreshCw size={12} />
                <span>Reset demo</span>
              </button>
            </div>
          )}

          {/* STATE: ERROR / ALREADY CLAIMED */}
          {(claimState === 'error' || claimState === 'already-claimed') && (
            <div className="py-4 flex flex-col items-center justify-center text-center gap-4">
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
                <XCircle size={32} strokeWidth={1.5} />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-white text-2xl font-medium tracking-tight">
                  {claimState === 'already-claimed' ? 'Already Claimed' : 'Link Expired'}
                </h2>
                <p className="text-white/60 text-sm">
                  {claimState === 'already-claimed'
                    ? 'This payout link has already been claimed.'
                    : 'This payout link is invalid or has expired.'}
                </p>
              </div>

              <div className="border-t border-white/10 w-full my-3" />

              <button
                onClick={() => setClaimState('idle')}
                className="text-white/50 hover:text-white text-xs underline transition-colors"
              >
                Try again or contact {orgName}
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-4">
        <p className="text-white/20 text-xs">Powered by ReRail</p>
      </footer>
    </div>
  );
}
