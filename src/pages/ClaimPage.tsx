import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CheckCircle,
  ExternalLink,
  Loader2,
  Lock,
  Monitor,
  XCircle,
} from 'lucide-react';
import { WalletButton } from '@/components/WalletButton';
import { useWalletStore } from '@/stores/wallet.store';
import {
  accountExists,
  buildClaimInnerTransaction,
  buildTrustlineInnerTransaction,
  hasTrustline,
} from '@/lib/stellar';
import { USDC_ASSET } from '@/config/stellar';
import { CLAIM_POLL_INTERVAL_MS, EXPLORER_TX_BASE_URL, PUBLIC_BG_VIDEO } from '@/config/constants';

type PageState =
  | 'loading'
  | 'invalid'
  | 'already-claimed'
  | 'expired'
  | 'pending'
  | 'signing'
  | 'submitting'
  | 'success'
  | 'error';

/** Wallet readiness, PRD states 1–4 plus the wrong-wallet guard. */
type Readiness =
  | 'checking'
  | 'no-wallet'
  | 'not-connected'
  | 'wrong-wallet'
  | 'no-account'
  | 'no-trustline'
  | 'ready';

interface ClaimData {
  name?: string;
  amount: string;
  asset_code: string;
  campaign_name?: string;
  balance_id?: string | null;
  /** The address the claimable balance names as claimant. Only it can claim. */
  wallet_address?: string | null;
  deadline?: string | null;
  claimed_at?: string | null;
  tx_hash?: string | null;
}

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * What the recipient is told at each blocked state. `ready` and `checking`
 * have no guide — one shows the claim button, the other a spinner.
 */
const STEP_GUIDES: Partial<Record<Readiness, string[]>> = {
  'no-wallet': [
    'Install a Stellar wallet (Freighter, xBull, Hana or Lobstr)',
    'Create a wallet and save your recovery phrase',
    'This page detects it automatically — no refresh needed',
  ],
  'not-connected': [
    'Connect the wallet this payout was addressed to',
    'ReRail never asks for your recovery phrase',
    'You will approve one signature, and pay no fee',
  ],
  'wrong-wallet': [
    'This payout is locked to one specific Stellar address',
    'Switch to that address in your wallet, then reconnect',
    'Only that address can claim — no one else can take it',
  ],
  'no-account': [
    'Your Stellar address is not activated on the network yet',
    'ReRail can activate it for you and cover the reserve',
    'You pay no XLM and receive one signature request',
  ],
  'no-trustline': [
    'Stellar asks you to opt in to each asset once',
    'Approve the USDC trustline signature',
    'ReRail pays this network fee',
  ],
};

const isMobileDevice = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

function formatDate(value?: string | null) {
  if (!value) return 'an earlier date';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ClaimPage() {
  const { id } = useParams<{ id: string }>();
  const token = id || '';

  const [pageState, setPageState] = useState<PageState>('loading');
  const [claimData, setClaimData] = useState<ClaimData | null>(null);
  const [message, setMessage] = useState('');
  const [txHash, setTxHash] = useState('');
  const [readiness, setReadiness] = useState<Readiness>('checking');
  const [busy, setBusy] = useState(false);
  const [stepError, setStepError] = useState('');

  const wallet = useWalletStore();
  const checkWallets = useWalletStore((state) => state.checkWallets);
  const isMobile = useMemo(() => isMobileDevice(), []);

  // ── Resolve the claim link ───────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setPageState('invalid');
      setMessage('This link is invalid.');
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/claim/${token}/resolve`);
        const data = await res.json();

        if (res.ok) {
          setClaimData(data);
          setPageState('pending');
          return;
        }

        setClaimData({
          amount: data.amount ?? '—',
          asset_code: data.asset_code ?? 'USDC',
          campaign_name: data.campaign_name,
          claimed_at: data.claimed_at,
          tx_hash: data.tx_hash,
          deadline: data.deadline,
        });

        if (res.status === 410 && data.status === 'claimed') {
          setPageState('already-claimed');
        } else if (res.status === 410) {
          setPageState('expired');
          setMessage(
            `This link expired on ${formatDate(data.deadline)}. Contact the organizer.`,
          );
        } else {
          setPageState('invalid');
          setMessage(data.error || 'This link is invalid.');
        }
      } catch {
        setPageState('invalid');
        setMessage('Could not load this claim link. Please try again.');
      }
    })();
  }, [token]);

  // ── Discover installed wallets once ─────────────────────────────────────
  useEffect(() => {
    if (!isMobile) checkWallets();
  }, [checkWallets, isMobile]);

  // ── Wallet state machine ────────────────────────────────────────────────
  const expectedAddress = claimData?.wallet_address ?? null;

  const evaluateReadiness = useCallback(async () => {
    if (!wallet.isWalletAvailable && !wallet.isConnected) {
      setReadiness('no-wallet');
      return;
    }

    if (!wallet.publicKey) {
      setReadiness('not-connected');
      return;
    }

    // The claimable balance names one claimant. Checking the account and
    // trustline of any other connected wallet would walk the recipient all the
    // way to a signature the server is guaranteed to reject.
    if (expectedAddress && wallet.publicKey !== expectedAddress) {
      setReadiness('wrong-wallet');
      return;
    }

    try {
      if (!(await accountExists(wallet.publicKey))) {
        setReadiness('no-account');
        return;
      }

      if (!(await hasTrustline(wallet.publicKey, USDC_ASSET))) {
        setReadiness('no-trustline');
        return;
      }

      setReadiness('ready');
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Could not read your account.');
    }
  }, [expectedAddress, wallet.isWalletAvailable, wallet.isConnected, wallet.publicKey]);

  useEffect(() => {
    if (isMobile || pageState !== 'pending') return;
    evaluateReadiness();
  }, [evaluateReadiness, isMobile, pageState]);

  // ── Poll while the recipient is still setting their wallet up ───────────
  const readinessRef = useRef(readiness);
  readinessRef.current = readiness;

  useEffect(() => {
    if (isMobile || pageState !== 'pending') return;

    const interval = setInterval(() => {
      if (readinessRef.current === 'ready') return;
      checkWallets();
      evaluateReadiness();
    }, CLAIM_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [checkWallets, evaluateReadiness, isMobile, pageState]);

  // ── Wrong wallet: let the recipient pick a different one ────────────────
  const handleSwitchWallet = useCallback(async () => {
    setStepError('');
    await wallet.disconnect();
    await wallet.connect();
  }, [wallet]);

  // ── State 2: activate the account, sponsored by ReRail ──────────────────
  // The sponsorship opens the USDC trustline in the same transaction, so a
  // successful run lands the recipient straight on `ready`.
  const handleSponsorAccount = useCallback(async () => {
    if (!wallet.publicKey) return;
    setBusy(true);
    setStepError('');

    try {
      const buildRes = await fetch(`/api/account/${token}/sponsor`, { method: 'POST' });
      const built = await buildRes.json();

      if (!buildRes.ok || !built.unsigned_tx_xdr) {
        throw new Error(built.error || 'Could not prepare your account activation.');
      }

      const signedXdr = await wallet.signTransaction(built.unsigned_tx_xdr);

      const submitRes = await fetch(`/api/account/${token}/sponsor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signed_tx_xdr: signedXdr }),
      });
      const result = await submitRes.json();

      if (!submitRes.ok || !result.success) {
        throw new Error(result.error || 'Failed to activate your account.');
      }

      await evaluateReadiness();
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Failed to activate your account.');
    } finally {
      setBusy(false);
    }
  }, [wallet, token, evaluateReadiness]);

  // ── State 3: enable USDC (fee-bumped by ReRail) ─────────────────────────
  const handleAddTrustline = useCallback(async () => {
    if (!wallet.publicKey) return;
    setBusy(true);
    setStepError('');

    try {
      const innerTxXdr = await buildTrustlineInnerTransaction(wallet.publicKey, USDC_ASSET);
      const signedXdr = await wallet.signTransaction(innerTxXdr);

      const res = await fetch(`/api/trustline/${token}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signed_inner_tx_xdr: signedXdr }),
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to enable USDC.');
      }

      await evaluateReadiness();
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Failed to enable USDC.');
    } finally {
      setBusy(false);
    }
  }, [wallet, token, evaluateReadiness]);

  // ── State 4: claim ──────────────────────────────────────────────────────
  const handleClaim = useCallback(async () => {
    if (!wallet.publicKey || !claimData?.balance_id) return;

    try {
      setPageState('signing');
      const innerTxXdr = await buildClaimInnerTransaction(wallet.publicKey, claimData.balance_id);
      const signedXdr = await wallet.signTransaction(innerTxXdr);

      setPageState('submitting');
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
      setPageState('success');
    } catch (err) {
      setPageState('error');
      setMessage(err instanceof Error ? err.message : 'Claim failed.');
    }
  }, [wallet, claimData, token]);

  const stepGuide = STEP_GUIDES[readiness] ?? [];
  const shortToken = token.length > 12 ? `${token.slice(0, 4)}...${token.slice(-3)}` : token;
  const displayHash = txHash || claimData?.tx_hash || '';
  const explorerUrl = displayHash ? `${EXPLORER_TX_BASE_URL}/${displayHash}` : '';

  return (
    <div className="min-h-screen w-full text-white relative overflow-hidden">
      <video
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        src={PUBLIC_BG_VIDEO}
      />
      <div className="absolute inset-0 bg-black/20 pointer-events-none" />

      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div className="liquid-glass rounded-3xl p-7 w-full max-w-sm flex flex-col gap-5">
          {/* Trust signal */}
          <div className="liquid-glass rounded-lg px-3 py-2 flex items-center gap-2">
            <Lock size={11} className="text-white/40" />
            <span className="font-mono text-xs text-white/40">rerail.app/claim/{shortToken}</span>
          </div>

          {isMobile ? (
            <div className="flex flex-col gap-3 py-4">
              <Monitor size={24} className="text-white/40 mx-auto" />
              <p className="text-white text-base font-medium text-center">
                Open on desktop to claim
              </p>
              <p className="text-white/40 text-sm text-center">
                Stellar browser wallets require a desktop browser.
              </p>
            </div>
          ) : (
            <>
              {/* Persistent amount display */}
              {claimData && (
                <div>
                  <p className="text-white text-4xl font-medium font-mono">{claimData.amount}</p>
                  <p className="text-white/40 text-sm">
                    {claimData.asset_code || 'USDC'}
                    {claimData.campaign_name ? ` · ${claimData.campaign_name}` : ''}
                  </p>
                </div>
              )}

              {pageState === 'loading' && (
                <div className="flex items-center gap-2 text-white/50 text-sm py-6 justify-center">
                  <Loader2 size={16} className="animate-spin" /> Resolving your claim link...
                </div>
              )}

              {(pageState === 'invalid' || pageState === 'error') && (
                <div className="flex flex-col items-center gap-3 py-2 text-center">
                  <XCircle size={28} className="text-red-300" />
                  <p className="text-white/60 text-sm">{message || 'This link is invalid.'}</p>
                </div>
              )}

              {pageState === 'expired' && (
                <div className="flex flex-col items-center gap-3 py-2 text-center">
                  <XCircle size={28} className="text-red-300" />
                  <p className="text-white/60 text-sm">{message}</p>
                </div>
              )}

              {pageState === 'already-claimed' && (
                <div className="flex flex-col gap-3">
                  <p className="text-white/60 text-sm">
                    Already claimed on {formatDate(claimData?.claimed_at)}
                  </p>
                  {displayHash && (
                    <>
                      <div className="liquid-glass rounded-xl px-4 py-3 font-mono text-white/40 text-xs break-all">
                        {displayHash}
                      </div>
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="liquid-glass rounded-full flex items-center justify-center gap-2 mx-auto px-4 py-2 text-white/70 text-xs hover:text-white transition-colors"
                      >
                        <ExternalLink size={13} /> View on Stellar Explorer
                      </a>
                    </>
                  )}
                </div>
              )}

              {(pageState === 'signing' || pageState === 'submitting') && (
                <div className="flex items-center gap-2 text-white/50 text-sm py-6 justify-center">
                  <Loader2 size={16} className="animate-spin" />
                  {pageState === 'signing' ? 'Waiting for your signature...' : 'Submitting claim...'}
                </div>
              )}

              {pageState === 'success' && (
                <div className="flex flex-col gap-3">
                  <CheckCircle className="text-green-300 mx-auto" size={32} />
                  <p className="text-white text-lg font-medium text-center">
                    {claimData?.amount} {claimData?.asset_code || 'USDC'} received
                  </p>
                  <div className="liquid-glass rounded-xl px-4 py-3 font-mono text-white/40 text-xs break-all">
                    {displayHash}
                  </div>
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="liquid-glass rounded-full flex items-center justify-center gap-2 mx-auto px-4 py-2 text-white/70 text-xs hover:text-white transition-colors"
                  >
                    <ExternalLink size={13} /> View on Stellar Explorer
                  </a>
                </div>
              )}

              {pageState === 'pending' && (
                <>
                  {stepError && (
                    <div className="rounded-xl p-3 bg-red-500/10 text-red-300 text-xs">
                      {stepError}
                    </div>
                  )}

                  {/* States 1–3: guided step list */}
                  {stepGuide.length > 0 && (
                    <ul className="flex flex-col gap-0">
                      {stepGuide.map((text, index) => (
                        <li
                          key={text}
                          className="border-b border-white/10 py-2.5 flex items-start gap-3"
                        >
                          <span className="liquid-glass w-5 h-5 rounded-full text-white/50 text-xs flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <span className="text-white/60 text-sm">{text}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {readiness === 'checking' && (
                    <div className="flex items-center gap-2 text-white/40 text-xs justify-center">
                      <Loader2 size={13} className="animate-spin" /> Checking your wallet...
                    </div>
                  )}

                  {readiness === 'not-connected' && (
                    <WalletButton variant="primary" className="w-full" />
                  )}

                  {readiness === 'wrong-wallet' && expectedAddress && (
                    <>
                      <div className="liquid-glass rounded-xl px-4 py-3 flex flex-col gap-1.5">
                        <span className="text-white/40 text-xs">Addressed to</span>
                        <span className="font-mono text-white text-sm">
                          {truncateAddress(expectedAddress)}
                        </span>
                        <span className="text-white/40 text-xs mt-1">You connected</span>
                        <span className="font-mono text-red-300 text-sm">
                          {truncateAddress(wallet.publicKey as string)}
                        </span>
                      </div>
                      <button
                        onClick={handleSwitchWallet}
                        className="bg-white text-black rounded-full w-full px-6 py-3 text-sm font-medium hover:bg-white/90 transition-colors"
                      >
                        Switch wallet
                      </button>
                    </>
                  )}

                  {readiness === 'no-account' && (
                    <>
                      <button
                        onClick={handleSponsorAccount}
                        disabled={busy}
                        className="bg-white text-black rounded-full w-full px-6 py-3 text-sm font-medium disabled:opacity-50"
                      >
                        {busy ? 'Activating your account...' : 'Activate my Stellar account'}
                      </button>
                      <p className="text-white/30 text-xs text-center">
                        ReRail covers the account reserve — you pay nothing
                      </p>
                    </>
                  )}

                  {readiness === 'no-trustline' && (
                    <>
                      <button
                        onClick={handleAddTrustline}
                        disabled={busy}
                        className="bg-white text-black rounded-full w-full px-6 py-3 text-sm font-medium disabled:opacity-50"
                      >
                        {busy ? 'Enabling USDC...' : 'Enable USDC in my wallet'}
                      </button>
                      <p className="text-white/30 text-xs text-center">
                        ReRail pays this network fee — you pay nothing
                      </p>
                    </>
                  )}

                  {readiness === 'ready' && (
                    <>
                      <button
                        onClick={handleClaim}
                        disabled={!claimData?.balance_id}
                        className={`rounded-full w-full px-6 py-3 text-sm font-medium transition-colors ${
                          claimData?.balance_id
                            ? 'bg-white text-black hover:bg-white/90'
                            : 'bg-white/20 text-white/40 cursor-not-allowed'
                        }`}
                      >
                        {claimData?.balance_id
                          ? `Claim ${claimData.amount} ${claimData.asset_code || 'USDC'} →`
                          : 'Balance not yet created'}
                      </button>
                      <p className="text-white/30 text-xs text-center">
                        No XLM required · irreversible
                      </p>
                    </>
                  )}
                </>
              )}
            </>
          )}

          <Link to="/" className="text-white/25 hover:text-white/60 text-xs text-center transition-colors">
            Powered by ReRail
          </Link>
        </div>
      </div>
    </div>
  );
}
