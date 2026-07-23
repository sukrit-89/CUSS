import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Wallet,
  Loader2,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { useWalletStore } from '@/stores/wallet.store';
import { buildClaimInnerTransaction } from '@/lib/stellar';

type ClaimState = 'loading' | 'idle' | 'signing' | 'submitting' | 'success' | 'error' | 'already-claimed' | 'expired';

interface ClaimData {
  name: string;
  amount: string;
  asset_code: string;
  campaign_name: string;
  balance_id: string | null;
  wallet_address: string | null;
  deadline: string | null;
}

export function ClaimPage() {
  const { id } = useParams<{ id: string }>();
  const token = id || '';

  const [claimState, setClaimState] = useState<ClaimState>('loading');
  const [claimData, setClaimData] = useState<ClaimData | null>(null);
  const [txHash, setTxHash] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedTx, setCopiedTx] = useState(false);

  const wallet = useWalletStore();

  // ── Resolve claim link on mount ──────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setClaimState('error');
      setErrorMessage('No claim token provided.');
      return;
    }

    const resolve = async () => {
      try {
        const res = await fetch(`/api/claim/${token}/resolve`);
        const data = await res.json();

        if (!res.ok) {
          if (res.status === 410 && data.error === 'Already claimed') {
            setClaimState('already-claimed');
          } else if (res.status === 410) {
            setClaimState('expired');
            setErrorMessage(data.error || 'This claim link has expired.');
          } else {
            setClaimState('error');
            setErrorMessage(data.error || 'Claim not found.');
          }
          return;
        }

        setClaimData(data);
        setClaimState('idle');
      } catch {
        setClaimState('error');
        setErrorMessage('Failed to load claim details. Please try again.');
      }
    };

    resolve();
  }, [token]);

  // ── Check Freighter on mount ─────────────────────────────────────────────
  useEffect(() => {
    wallet.checkFreighter();
  }, []);

  // ── Claim handler ────────────────────────────────────────────────────────
  const handleClaim = useCallback(async () => {
    if (!wallet.isConnected || !wallet.publicKey || !claimData?.balance_id) return;

    try {
      setClaimState('signing');

      // 1. Build inner transaction for the recipient
      const innerTxXdr = await buildClaimInnerTransaction(
        wallet.publicKey,
        claimData.balance_id,
      );

      // 2. Sign with Freighter
      const signedXdr = await wallet.signTransaction(innerTxXdr);

      setClaimState('submitting');

      // 3. Submit to our serverless fee-bump endpoint
      const res = await fetch(`/api/claim/${token}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signed_inner_tx_xdr: signedXdr }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Claim transaction failed.');
      }

      setTxHash(result.tx_hash || result.hash);
      setClaimState('success');
    } catch (err: unknown) {
      setClaimState('error');
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
    }
  }, [wallet, claimData, token]);

  const handleCopyTx = () => {
    navigator.clipboard.writeText(txHash);
    setCopiedTx(true);
    setTimeout(() => setCopiedTx(false), 2000);
  };

  const displayAmount = claimData
    ? `${claimData.amount} ${claimData.asset_code || 'USDC'}`
    : '';

  const explorerUrl = txHash
    ? `https://stellar.expert/explorer/testnet/tx/${txHash}`
    : '';

  const truncatedHash = txHash
    ? `${txHash.slice(0, 6)}...${txHash.slice(-4)}`
    : '';

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] text-white flex flex-col justify-between items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />

      {/* Header link */}
      <header className="w-full max-w-md flex justify-between items-center py-4">
        <Link to="/" className="text-white/40 hover:text-white text-xs transition-colors">
          ← ReRail
        </Link>
      </header>

      {/* Main Centered Card */}
      <main className="w-full max-w-md my-auto">
        <div className="liquid-glass rounded-2xl p-8 flex flex-col gap-1 shadow-2xl">
          {/* STATE: LOADING */}
          {claimState === 'loading' && (
            <div className="py-10 flex flex-col items-center justify-center text-center gap-4">
              <Loader2 size={40} strokeWidth={1.5} className="animate-spin text-white/80" />
              <div className="flex flex-col gap-1">
                <h3 className="text-white text-lg font-medium">Loading claim...</h3>
                <p className="text-white/40 text-xs">Resolving your payout details</p>
              </div>
            </div>
          )}

          {/* STATE: IDLE */}
          {claimState === 'idle' && claimData && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-white/40 text-xs uppercase tracking-wide">
                  You've received a payout
                </span>
                <span className="text-white/30 font-mono text-[10px]">
                  #{token.slice(0, 8)}
                </span>
              </div>
              <h1 className="text-white text-5xl font-medium tracking-tight mt-1 mb-1">
                {displayAmount}
              </h1>
              <p className="text-white/60 text-sm">
                from <span className="text-white font-medium">{claimData.campaign_name}</span>
              </p>

              <div className="border-t border-white/10 my-6" />

              {/* Wallet Connection */}
              {!wallet.isConnected ? (
                <button
                  onClick={wallet.connect}
                  className="liquid-glass rounded-xl px-4 py-3 text-white text-sm font-medium flex items-center justify-center gap-2.5 hover:bg-white/5 transition-colors mb-3"
                >
                  <Wallet size={18} strokeWidth={1.5} />
                  <span>Connect Freighter Wallet</span>
                </button>
              ) : (
                <div className="liquid-glass rounded-xl px-4 py-3 flex items-center justify-between text-sm mb-3">
                  <div className="flex items-center gap-2">
                    <Wallet size={16} strokeWidth={1.5} className="text-[#22c55e]" />
                    <span className="text-white/80 font-mono text-xs">
                      {wallet.publicKey?.slice(0, 4)}...{wallet.publicKey?.slice(-4)}
                    </span>
                  </div>
                  <span className="text-xs text-[#22c55e] font-medium">Connected</span>
                </div>
              )}

              {/* Claim Action Button */}
              <button
                onClick={handleClaim}
                disabled={!wallet.isConnected || !claimData.balance_id}
                className={`w-full font-medium rounded-full px-6 py-3 text-sm transition-colors ${
                  wallet.isConnected && claimData.balance_id
                    ? 'bg-white text-black hover:bg-white/90 cursor-pointer'
                    : 'bg-white/20 text-white/40 cursor-not-allowed'
                }`}
              >
                {!claimData.balance_id ? 'Balance not yet created' : 'Claim USDC'}
              </button>

              <p className="text-white/30 text-xs text-center mt-4">
                No XLM required. Gas covered by ReRail.
              </p>
            </>
          )}

          {/* STATE: SIGNING */}
          {claimState === 'signing' && (
            <div className="py-10 flex flex-col items-center justify-center text-center gap-4">
              <Loader2 size={40} strokeWidth={1.5} className="animate-spin text-white/80" />
              <div className="flex flex-col gap-1">
                <h3 className="text-white text-lg font-medium">Waiting for signature...</h3>
                <p className="text-white/40 text-xs">Please sign the transaction in Freighter</p>
              </div>
            </div>
          )}

          {/* STATE: SUBMITTING */}
          {claimState === 'submitting' && (
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
                  {displayAmount} has been transferred to your wallet
                </p>
              </div>

              <div className="border-t border-white/10 w-full my-3" />

              <div className="w-full flex items-center justify-between liquid-glass rounded-xl px-4 py-3 text-xs">
                <span className="text-white/40">Tx Hash</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-white/80">{truncatedHash}</span>
                  <button
                    onClick={handleCopyTx}
                    className="text-white/50 hover:text-white transition-colors"
                  >
                    {copiedTx ? <Check size={14} className="text-[#22c55e]" /> : <Copy size={14} />}
                  </button>
                  {explorerUrl && (
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white/50 hover:text-white transition-colors"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STATE: ERROR / ALREADY CLAIMED / EXPIRED */}
          {(claimState === 'error' || claimState === 'already-claimed' || claimState === 'expired') && (
            <div className="py-4 flex flex-col items-center justify-center text-center gap-4">
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
                <XCircle size={32} strokeWidth={1.5} />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-white text-2xl font-medium tracking-tight">
                  {claimState === 'already-claimed'
                    ? 'Already Claimed'
                    : claimState === 'expired'
                      ? 'Link Expired'
                      : 'Claim Failed'}
                </h2>
                <p className="text-white/60 text-sm">
                  {claimState === 'already-claimed'
                    ? 'This payout link has already been claimed.'
                    : errorMessage || 'This payout link is invalid or has expired.'}
                </p>
              </div>

              <div className="border-t border-white/10 w-full my-3" />

              <Link
                to="/"
                className="text-white/50 hover:text-white text-xs underline transition-colors"
              >
                Return to ReRail
              </Link>
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
