import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Plus,
  Upload,
} from 'lucide-react';
import { WalletButton } from '@/components/WalletButton';
import { Sidebar } from '@/components/Sidebar';
import { RecipientsTable, type Recipient } from '@/components/RecipientsTable';
import { useCampaignStore } from '@/stores/campaign.store';
import { useWalletStore } from '@/stores/wallet.store';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/stores/toast.store';
import { parseRecipientsCSV } from '@/features/campaigns/utils/csv-parser';
import { downloadCSV, exportRecipientsCSV } from '@/features/campaigns/utils/csv-export';
import { CampaignActivationService } from '@/features/campaigns/services/campaign-activation.service';
import { RegistryService } from '@/features/campaigns/services/registry.service';
import { getRecipientsByCampaign } from '@/lib/supabase/queries/recipients';
import { getAssetBalance, getHorizonServer } from '@/lib/stellar';
import { isValidAmount } from '@/lib/utils/validation';
import {
  getXlmToUsdcQuote,
  quoteFailureMessage,
  type SwapQuote,
} from '@/lib/defi/soroswap';
import { USDC_ASSET } from '@/config/stellar';
import {
  CIRCLE_FAUCET_URL,
  CLAIM_LINK_BASE_URL,
  DEFAULT_CLAIM_EXPIRY_SECONDS,
  NETWORK_PASSPHRASE,
  USDC_ISSUER,
  XLM_RESERVE_PER_BALANCE,
} from '@/config/constants';
import { Asset, Transaction } from '@stellar/stellar-sdk';

interface ParsedRecipient {
  id: string;
  name: string;
  email?: string;
  wallet_address?: string;
  amount?: string;
}

type WizardStep = 1 | 2 | 3 | 4;

type GenerationState =
  | 'idle'
  | 'creating'
  | 'registering'
  | 'activating'
  | 'signing'
  | 'submitting'
  | 'syncing'
  | 'done'
  | 'error';

/** Ordered progress rows shown while the campaign is being created. */
const getProgressSteps = (): Array<{ key: GenerationState; label: string }> => [
  { key: 'creating', label: 'Creating campaign record' },
  ...(RegistryService.isEnabled
    ? [{ key: 'registering' as const, label: 'Recording campaign on Soroban registry' }]
    : []),
  { key: 'activating', label: 'Building claimable balance transactions' },
  { key: 'signing', label: 'Waiting for organizer signature' },
  { key: 'submitting', label: 'Submitting to Stellar' },
  { key: 'syncing', label: 'Linking claim links to on-chain balances' },
];

/** `datetime-local` wants `YYYY-MM-DDTHH:mm` in local time, not an ISO string. */
function toDateTimeLocal(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

const defaultDeadlineValue = toDateTimeLocal(
  new Date(Date.now() + DEFAULT_CLAIM_EXPIRY_SECONDS * 1000),
);

const STEP_LABELS = ['Details', 'Fund', 'Recipients', 'Review'];

export function NewPayoutPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<WizardStep>(1);

  // ── Step 1: details ──────────────────────────────────────────────────────
  const [campaignName, setCampaignName] = useState('');
  const [defaultAmount, setDefaultAmount] = useState('');
  const [hasDeadline, setHasDeadline] = useState(true);
  const [deadline, setDeadline] = useState(defaultDeadlineValue);

  // ── Step 2: funding ──────────────────────────────────────────────────────
  const [balances, setBalances] = useState<{ usdc: string | null; xlm: string | null }>({
    usdc: null,
    xlm: null,
  });
  const [balanceState, setBalanceState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [balanceError, setBalanceError] = useState('');
  const [xlmToSwap, setXlmToSwap] = useState('');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [quoteState, setQuoteState] = useState<'idle' | 'loading' | 'loaded' | 'unavailable'>('idle');
  const [quoteMessage, setQuoteMessage] = useState('');

  // ── Step 3: recipients ───────────────────────────────────────────────────
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [parsedRecipients, setParsedRecipients] = useState<ParsedRecipient[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  // ── Step 4: creation ─────────────────────────────────────────────────────
  const [genState, setGenState] = useState<GenerationState>('idle');
  const [genError, setGenError] = useState('');
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [registryProgress, setRegistryProgress] = useState('');
  const [registryWarning, setRegistryWarning] = useState('');
  const [createdRecipients, setCreatedRecipients] = useState<
    Array<{
      id: string;
      name: string;
      email: string | null;
      wallet_address: string | null;
      amount: string | null;
      claim_link_token: string;
      status: string;
    }>
  >([]);

  const campaignStore = useCampaignStore();
  const wallet = useWalletStore();
  const auth = useAuthStore();

  // ── Derived values ───────────────────────────────────────────────────────
  const totalDistribution = useMemo(
    () =>
      parsedRecipients.reduce((sum, r) => {
        const amount = parseFloat(r.amount || defaultAmount || '0');
        return sum + (Number.isNaN(amount) ? 0 : amount);
      }, 0),
    [parsedRecipients, defaultAmount],
  );

  const xlmReserve = useMemo(
    () => parsedRecipients.length * XLM_RESERVE_PER_BALANCE,
    [parsedRecipients.length],
  );

  const displayRecipients: Recipient[] = useMemo(
    () =>
      parsedRecipients.map((r) => {
        const amt = r.amount || defaultAmount || '0';
        const address = r.wallet_address || '—';
        const truncated =
          address.length > 12 ? `${address.slice(0, 4)}...${address.slice(-4)}` : address;
        return {
          id: r.id,
          recipient: truncated,
          amount: `${parseFloat(amt).toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC`,
          status: 'Pending' as const,
          claimedOn: '—',
        };
      }),
    [parsedRecipients, defaultAmount],
  );

  const detailsValid =
    campaignName.trim().length > 0 &&
    isValidAmount(defaultAmount) &&
    (!hasDeadline || new Date(deadline).getTime() > Date.now());

  const usdcBalanceNumber = parseFloat(balances.usdc ?? '0');

  // ── Step 2: read organizer balances from Horizon ──────────────────────────
  const refreshBalances = useCallback(async () => {
    if (!wallet.publicKey) return;

    setBalanceState('loading');
    setBalanceError('');

    try {
      const [usdc, xlm] = await Promise.all([
        getAssetBalance(wallet.publicKey, USDC_ASSET),
        getAssetBalance(wallet.publicKey, Asset.native()),
      ]);

      setBalances({ usdc, xlm });
      setBalanceState('loaded');

      if (usdc === null) {
        setBalanceError('This account does not exist on the network yet.');
      }
    } catch (err) {
      setBalanceState('error');
      setBalanceError(err instanceof Error ? err.message : 'Could not read balances.');
    }
  }, [wallet.publicKey]);

  const fetchQuote = useCallback(async () => {
    const amount = parseFloat(xlmToSwap);
    if (!Number.isFinite(amount) || amount <= 0) return;

    setQuoteState('loading');
    setQuoteMessage('');

    const result = await getXlmToUsdcQuote(amount);

    if (result.ok) {
      setQuote(result.quote);
      setQuoteState('loaded');
      return;
    }

    setQuote(null);
    setQuoteMessage(quoteFailureMessage(result.reason));
    setQuoteState('unavailable');
  }, [xlmToSwap]);

  // ── Step 3: CSV upload ───────────────────────────────────────────────────
  const handleCSVUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = parseRecipientsCSV(await file.text());

    setParseErrors(
      result.errors.length > 0
        ? result.errors.map((err) => `Row ${err.row}: ${err.message}`)
        : [],
    );

    setParsedRecipients((prev) => [
      ...prev,
      ...result.valid.map((row, i) => ({
        id: `csv_${Date.now()}_${i}`,
        name: row.name,
        email: row.email,
        wallet_address: row.wallet_address,
        amount: row.amount,
      })),
    ]);

    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName) return;
    if (manualAmount && !isValidAmount(manualAmount)) {
      setParseErrors((prev) => [
        ...prev,
        'Manual amount must be positive and use at most 7 decimal places.',
      ]);
      return;
    }
    setParsedRecipients((prev) => [
      ...prev,
      {
        id: `man_${Date.now()}`,
        name: manualName,
        wallet_address: manualAddress || undefined,
        amount: manualAmount || undefined,
      },
    ]);
    setManualName('');
    setManualAddress('');
    setManualAmount('');
    setShowManualInput(false);
  };

  // ── Step 4: full creation pipeline ───────────────────────────────────────
  const handleGenerateClaimLinks = useCallback(async () => {
    if (!auth.user || parsedRecipients.length === 0) return;

    const deadlineDate = hasDeadline
      ? new Date(deadline)
      : new Date(Date.now() + DEFAULT_CLAIM_EXPIRY_SECONDS * 1000);

    if (Number.isNaN(deadlineDate.getTime()) || deadlineDate.getTime() <= Date.now()) {
      setGenError('Pick a claim deadline in the future.');
      setGenState('error');
      return;
    }

    // Claimable balance predicates take a duration, not a timestamp.
    const deadlineSeconds = Math.floor((deadlineDate.getTime() - Date.now()) / 1000);

    try {
      if (!wallet.isConnected || !wallet.publicKey) {
        throw new Error(
          'Connect your Stellar wallet before creating the campaign — the payout must be funded on-chain.',
        );
      }

      // Fail before writing anything: a campaign whose treasury cannot cover
      // the pool would create half a batch of claimable balances and leave the
      // remaining recipients with dead links.
      const treasuryUsdc = await getAssetBalance(wallet.publicKey, USDC_ASSET);

      if (treasuryUsdc === null) {
        throw new Error('This Stellar account does not exist yet. Fund it before creating a campaign.');
      }

      if (parseFloat(treasuryUsdc) < totalDistribution) {
        throw new Error(
          `Treasury holds ${treasuryUsdc} USDC but this campaign needs ${totalDistribution.toFixed(2)} USDC.`,
        );
      }

      setGenState('creating');
      const campaign = await campaignStore.createCampaign({
        organizer_id: auth.user.id,
        name: campaignName || `Payout ${new Date().toLocaleDateString()}`,
        token: 'USDC',
        issuer: USDC_ISSUER,
        amount_per_recipient: defaultAmount || '0',
        total_pool: totalDistribution.toString(),
        deadline: deadlineDate.toISOString(),
        treasury_address: wallet.publicKey,
        status: 'draft',
      });
      setCreatedCampaignId(campaign.id);

      await campaignStore.uploadRecipients(
        campaign.id,
        new File([generateCSVFromParsed(parsedRecipients, defaultAmount)], 'recipients.csv', {
          type: 'text/csv',
        }),
      );

      const dbRecipients = await getRecipientsByCampaign(campaign.id);
      setCreatedRecipients(dbRecipients.map(toCreatedRecipient));

      // Registry mirror is a proof layer — a contract failure downgrades the
      // campaign to "not on chain yet" rather than failing the payout.
      if (RegistryService.isEnabled) {
        setGenState('registering');
        try {
          await RegistryService.mirrorCampaign({
            campaignId: campaign.id,
            organizerPublicKey: wallet.publicKey,
            name: campaign.name,
            defaultAmount: defaultAmount || '0',
            totalPool: totalDistribution.toString(),
            deadline: deadlineDate,
            recipients: dbRecipients,
            signTransaction: wallet.signTransaction,
            onProgress: setRegistryProgress,
          });
        } catch (registryError) {
          console.warn('Registry mirror skipped:', registryError);
          setRegistryWarning(
            'Payout is live, but it could not be recorded on the Soroban registry.',
          );
        } finally {
          setRegistryProgress('');
        }
      }

      setGenState('activating');
      const draft = await CampaignActivationService.buildActivationTransactions({
        campaignId: campaign.id,
        organizerPublicKey: wallet.publicKey,
        deadlineSeconds,
      });

      const server = getHorizonServer();
      let totalSynced = 0;

      for (const txXdr of draft.unsignedTransactionXdrs) {
        setGenState('signing');
        const signedXdr = await wallet.signTransaction(txXdr);

        setGenState('submitting');
        const result = await server.submitTransaction(
          new Transaction(signedXdr, NETWORK_PASSPHRASE),
        );

        if (!result.successful) {
          throw new Error(`Stellar rejected the funding transaction (${result.hash}).`);
        }

        // Balance IDs only exist in Horizon's effects. Without this the
        // recipients' claimable_balance_id stays NULL and nobody can claim.
        setGenState('syncing');

        // The sync route writes with the service role key, so it needs proof
        // that the caller is the organizer who owns this campaign.
        const accessToken = auth.accessToken;

        if (!accessToken) {
          throw new Error('Your session expired. Sign in again to finish this campaign.');
        }

        const syncRes = await fetch(
          `/api/campaign/sync?txHash=${result.hash}&campaignId=${campaign.id}`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
        const syncText = await syncRes.text();
        const syncData = syncText ? safeJsonParse(syncText) : null;

        if (!syncRes.ok) {
          throw new Error(
            syncData?.error ||
              'Funds were locked on-chain but claim links could not be linked to them.',
          );
        }

        totalSynced += syncData?.synced ?? 0;
      }

      if (totalSynced === 0) {
        throw new Error('No claimable balances could be matched to recipients.');
      }

      await CampaignActivationService.markCampaignActive(campaign.id);

      const syncedRecipients = await getRecipientsByCampaign(campaign.id);
      setCreatedRecipients(syncedRecipients.map(toCreatedRecipient));

      setGenState('done');
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : 'Failed to create the campaign.');
      setGenState('error');
    }
  }, [
    auth.user,
    auth.accessToken,
    parsedRecipients,
    campaignName,
    defaultAmount,
    deadline,
    hasDeadline,
    totalDistribution,
    campaignStore,
    wallet,
  ]);

  const handleCopyAllLinks = () => {
    navigator.clipboard.writeText(
      createdRecipients
        .map((r) => `${CLAIM_LINK_BASE_URL}/claim/${r.claim_link_token}`)
        .join('\n'),
    );
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleExportCSV = () => {
    const exportData = createdRecipients.map((r) => ({
      id: r.id,
      campaign_id: createdCampaignId || '',
      name: r.name,
      email: r.email,
      wallet_address: r.wallet_address,
      amount: r.amount ?? defaultAmount ?? null,
      claimable_balance_id: null,
      claim_link_token: r.claim_link_token,
      status: r.status as 'pending',
      claim_token_hash: null,
      registry_status: null,
      registry_tx_hash: null,
      claimed_at: null,
      created_at: new Date().toISOString(),
    }));

    downloadCSV(
      exportRecipientsCSV(exportData as never, campaignName, CLAIM_LINK_BASE_URL),
      `${campaignName || 'payout'}-claim-links.csv`,
    );
    toast.success('Claim links CSV downloaded!');
  };

  const isCreating = genState !== 'idle' && genState !== 'error' && genState !== 'done';
  const progressSteps = useMemo(() => getProgressSteps(), []);
  const progressOrder = useMemo(() => progressSteps.map((s) => s.key), [progressSteps]);
  const currentProgressIndex = progressOrder.indexOf(genState);

  return (
    <div className="min-h-screen bg-[#080808] text-white flex">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 px-6 sm:px-8 border-b border-white/10 flex items-center sticky top-0 bg-[#080808]/90 backdrop-blur-md z-10">
          <h1 className="text-white font-medium text-lg">New Campaign</h1>
        </header>

        <main className="flex-1 p-6 sm:p-8 flex justify-center">
          <div className="w-full max-w-[600px] liquid-glass rounded-2xl p-6 sm:p-8">
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-8">
              {STEP_LABELS.map((label, index) => {
                const stepNumber = (index + 1) as WizardStep;
                const isActive = step === stepNumber;
                const isDone = step > stepNumber;
                return (
                  <div key={label} className="flex items-center gap-2 flex-1 last:flex-none">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          isActive
                            ? 'bg-white text-black'
                            : isDone
                              ? 'bg-white/20 text-white/60'
                              : 'border border-white/20 text-white/30'
                        }`}
                      >
                        {isDone ? '✓' : stepNumber}
                      </div>
                      <span
                        className={`text-xs hidden sm:block ${isActive ? 'text-white' : 'text-white/30'}`}
                      >
                        {label}
                      </span>
                    </div>
                    {index < STEP_LABELS.length - 1 && <div className="flex-1 h-px bg-white/10" />}
                  </div>
                );
              })}
            </div>

            {/* ── STEP 1: DETAILS ────────────────────────────────────────── */}
            {step === 1 && (
              <div className="flex flex-col gap-5">
                <div>
                  <label className="text-white/50 text-xs font-medium uppercase tracking-wide block mb-2">
                    Campaign name
                  </label>
                  <input
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="Q3 Hackathon Prizes"
                    className="w-full liquid-glass rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm outline-none focus:ring-1 focus:ring-white/20"
                  />
                </div>

                <div>
                  <label className="text-white/50 text-xs font-medium uppercase tracking-wide block mb-2">
                    Per-recipient amount (USDC)
                  </label>
                  <input
                    value={defaultAmount}
                    onChange={(e) => setDefaultAmount(e.target.value)}
                    placeholder="50.00"
                    className="w-full liquid-glass rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm font-mono outline-none focus:ring-1 focus:ring-white/20"
                  />
                  <p className="text-white/30 text-xs mt-2">
                    A per-row `amount` column in your CSV overrides this value.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-white/50 text-xs font-medium uppercase tracking-wide">
                      Claim deadline
                    </label>
                    <button
                      onClick={() => setHasDeadline(!hasDeadline)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${hasDeadline ? 'bg-white' : 'bg-white/15'}`}
                      aria-label="Toggle deadline"
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                          hasDeadline ? 'left-5 bg-black' : 'left-0.5 bg-white/60'
                        }`}
                      />
                    </button>
                  </div>
                  {hasDeadline && (
                    <input
                      type="datetime-local"
                      value={deadline}
                      min={toDateTimeLocal(new Date())}
                      onChange={(e) => setDeadline(e.target.value)}
                      className="w-full liquid-glass rounded-xl px-4 py-3 text-white text-sm mt-2 outline-none focus:ring-1 focus:ring-white/20 [color-scheme:dark]"
                    />
                  )}
                  <p className="text-white/30 text-xs mt-2">
                    After the deadline you can reclaim anything unclaimed — enforced by Stellar,
                    not by ReRail.
                  </p>
                </div>
              </div>
            )}

            {/* ── STEP 2: FUND ───────────────────────────────────────────── */}
            {step === 2 && (
              <div className="flex flex-col gap-5">
                {!wallet.isConnected ? (
                  <WalletButton
                    variant="glass"
                    className="w-full justify-center"
                    connectLabel="Connect wallet to fund this campaign"
                  />
                ) : (
                  <>
                    <div className="liquid-glass rounded-xl px-4 py-3 flex items-center justify-between text-sm">
                      <span className="text-white/60 text-xs font-mono">
                        {wallet.publicKey?.slice(0, 6)}...{wallet.publicKey?.slice(-4)}
                      </span>
                      <button
                        onClick={refreshBalances}
                        className="text-white/50 hover:text-white text-xs"
                      >
                        {balanceState === 'loading' ? 'Checking...' : 'Check balance'}
                      </button>
                    </div>

                    <div className="liquid-glass rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-white/40 text-xs uppercase tracking-wide">USDC</p>
                        <p className="text-white text-lg font-mono">
                          {balanceState === 'loaded' ? (balances.usdc ?? '—') : '—'}
                        </p>
                      </div>
                      <ArrowRight size={16} className="text-white/30" />
                      <div className="text-right">
                        <p className="text-white/40 text-xs uppercase tracking-wide">XLM</p>
                        <p className="text-white text-lg font-mono">
                          {balanceState === 'loaded' ? (balances.xlm ?? '—') : '—'}
                        </p>
                      </div>
                    </div>

                    {balanceError && (
                      <div className="rounded-xl p-3 bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                        {balanceError}
                      </div>
                    )}
                  </>
                )}

                <div className="flex flex-col gap-3">
                  <label className="text-white/50 text-xs font-medium uppercase tracking-wide">
                    XLM → USDC quote
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={xlmToSwap}
                      onChange={(e) => setXlmToSwap(e.target.value)}
                      placeholder="240"
                      className="flex-1 liquid-glass rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm font-mono outline-none focus:ring-1 focus:ring-white/20"
                    />
                    <button
                      onClick={fetchQuote}
                      className="liquid-glass rounded-xl px-4 text-sm text-white/70 hover:text-white transition-colors"
                    >
                      {quoteState === 'loading' ? 'Quoting...' : 'Get quote'}
                    </button>
                  </div>

                  {quoteState === 'loaded' && quote && (
                    <div className="liquid-glass rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-white/40 text-xs">You send</p>
                        <p className="text-white font-mono">{xlmToSwap} XLM</p>
                      </div>
                      <ArrowRight size={16} className="text-white/30" />
                      <div className="text-right">
                        <p className="text-white/40 text-xs">Campaign receives</p>
                        <p className="text-white font-mono">{quote.amountOut.toFixed(2)} USDC</p>
                      </div>
                    </div>
                  )}

                  {quoteState === 'loaded' && quote && (
                    <p className="text-white/30 text-xs text-center">
                      1 XLM = ${quote.rate.toFixed(4)} · via SoroSwap
                    </p>
                  )}

                  {quoteState === 'unavailable' && (
                    <p className="text-amber-200 text-xs text-center">{quoteMessage}</p>
                  )}

                  <p className="text-white/30 text-xs text-center">
                    Quotes are for pricing only — fund the treasury with USDC below.
                  </p>
                </div>

                <a
                  href={CIRCLE_FAUCET_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="liquid-glass rounded-xl px-4 py-3 text-xs text-white/60 hover:text-white flex items-center justify-center gap-2 transition-colors"
                >
                  💡 Need testnet USDC? Get it free from Circle&apos;s faucet
                  <ExternalLink size={12} />
                </a>
              </div>
            )}

            {/* ── STEP 3: RECIPIENTS ─────────────────────────────────────── */}
            {step === 3 && (
              <div className="flex flex-col gap-5">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="liquid-glass rounded-xl border border-dashed border-white/20 p-10 text-center flex flex-col items-center gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    className="hidden"
                  />
                  <Upload size={24} className="text-white/30" strokeWidth={1.5} />
                  <p className="text-white text-sm font-medium">Drop CSV here or click to upload</p>
                  <p className="text-white/40 text-xs font-mono">
                    name, email, wallet_address, amount
                  </p>
                </div>

                {parseErrors.length > 0 && (
                  <div className="liquid-glass rounded-xl p-4">
                    <div className="flex items-center gap-2 text-red-300 text-xs font-medium mb-2">
                      <AlertCircle size={14} /> CSV parsing errors
                    </div>
                    <ul className="text-red-300/80 text-xs space-y-1">
                      {parseErrors.slice(0, 5).map((err) => (
                        <li key={err}>• {err}</li>
                      ))}
                      {parseErrors.length > 5 && <li>...and {parseErrors.length - 5} more</li>}
                    </ul>
                  </div>
                )}

                {!showManualInput ? (
                  <button
                    onClick={() => setShowManualInput(true)}
                    className="self-start text-white/70 hover:text-white text-xs font-medium flex items-center gap-1.5"
                  >
                    <Plus size={14} strokeWidth={1.5} /> Add recipient manually
                  </button>
                ) : (
                  <form onSubmit={handleAddManual} className="liquid-glass rounded-xl p-4 flex flex-col gap-3">
                    <input
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="Name"
                      required
                      className="liquid-glass rounded-xl px-3 py-2 text-white text-sm placeholder-white/30 outline-none"
                    />
                    <input
                      value={manualAddress}
                      onChange={(e) => setManualAddress(e.target.value)}
                      placeholder="GBA7... (Stellar address)"
                      className="liquid-glass rounded-xl px-3 py-2 text-white text-sm placeholder-white/30 font-mono outline-none"
                    />
                    <input
                      value={manualAmount}
                      onChange={(e) => setManualAmount(e.target.value)}
                      placeholder="Amount (optional)"
                      className="liquid-glass rounded-xl px-3 py-2 text-white text-sm placeholder-white/30 outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="bg-white text-black text-xs font-medium rounded-full px-4 py-2"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowManualInput(false)}
                        className="text-white/40 hover:text-white text-xs px-2"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-white/50 text-xs uppercase tracking-wide font-medium">
                    Recipients ({parsedRecipients.length})
                  </span>
                  {parsedRecipients.length > 0 && (
                    <button
                      onClick={() => setParsedRecipients([])}
                      className="text-white/40 hover:text-white text-xs"
                    >
                      Clear list
                    </button>
                  )}
                </div>
                <RecipientsTable data={displayRecipients} limit={20} />
              </div>
            )}

            {/* ── STEP 4: REVIEW & CREATE ────────────────────────────────── */}
            {step === 4 && (
              <div className="flex flex-col gap-5">
                {genState === 'done' ? (
                  <div className="flex flex-col items-center text-center gap-4 py-4">
                    <CheckCircle2 size={32} className="text-green-300" strokeWidth={1.5} />
                    <h2 className="text-white text-lg font-medium">
                      {createdRecipients.length} claim links are live
                    </h2>

                    {registryWarning && (
                      <div className="w-full rounded-xl p-3 bg-amber-500/10 text-amber-200 text-xs text-left">
                        {registryWarning} Funds are locked on-chain and every link works — only the
                        registry mirror is missing.
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3 justify-center">
                      <button
                        onClick={handleCopyAllLinks}
                        className="bg-white text-black text-sm font-medium rounded-full px-6 py-2.5 flex items-center gap-2"
                      >
                        {copiedAll ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
                        {copiedAll ? 'Copied' : 'Copy all links'}
                      </button>
                      <button
                        onClick={handleExportCSV}
                        className="liquid-glass text-white text-sm font-medium rounded-full px-6 py-2.5 flex items-center gap-2"
                      >
                        <Download size={15} /> Export CSV
                      </button>
                    </div>

                    <button
                      onClick={() =>
                        navigate(createdCampaignId ? `/campaigns/${createdCampaignId}` : '/dashboard')
                      }
                      className="text-white/40 hover:text-white text-xs underline"
                    >
                      View campaign →
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col">
                      {[
                        ['Recipients', String(parsedRecipients.length)],
                        [
                          'Total USDC',
                          `${totalDistribution.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC`,
                        ],
                        ['XLM reserve', `≈ ${xlmReserve.toFixed(1)} XLM`],
                        [
                          'Deadline',
                          hasDeadline
                            ? new Date(deadline).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : 'None',
                        ],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="flex justify-between py-2.5 border-b border-white/10 text-sm"
                        >
                          <span className="text-white/40">{label}</span>
                          <span className="text-white font-medium font-mono">{value}</span>
                        </div>
                      ))}
                    </div>

                    {balanceState === 'loaded' &&
                      balances.usdc !== null &&
                      usdcBalanceNumber < totalDistribution && (
                        <div className="rounded-xl p-3 bg-amber-500/10 text-amber-200 text-xs">
                          Treasury holds {balances.usdc} USDC but this campaign needs{' '}
                          {totalDistribution.toFixed(2)} USDC. Fund the account before creating.
                        </div>
                      )}

                    {isCreating && (
                      <div className="flex flex-col gap-2">
                        {progressSteps.map((progressStep, index) => {
                          const isComplete = index < currentProgressIndex;
                          const isCurrent = index === currentProgressIndex;
                          if (
                            progressStep.key === 'registering' &&
                            !RegistryService.isEnabled
                          ) {
                            return null;
                          }
                          return (
                            <div
                              key={progressStep.key}
                              className="liquid-glass rounded-lg px-4 py-3 flex items-center gap-3"
                            >
                              {isComplete ? (
                                <CheckCircle2 size={14} className="text-green-300" />
                              ) : isCurrent ? (
                                <Loader2 size={14} className="animate-spin text-white/40" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full border border-white/15" />
                              )}
                              <span className="text-white/50 text-sm">
                                {progressStep.key === 'registering' && registryProgress
                                  ? registryProgress
                                  : progressStep.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {genState === 'error' && (
                      <div className="rounded-xl p-3 bg-red-500/10 text-red-300 text-xs">
                        {genError}
                      </div>
                    )}

                    <button
                      onClick={handleGenerateClaimLinks}
                      disabled={!auth.user || isCreating || parsedRecipients.length === 0}
                      className="w-full bg-white text-black text-sm font-medium rounded-full px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCreating
                        ? 'Creating campaign...'
                        : auth.user
                          ? 'Create campaign'
                          : 'Sign in to create'}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* ── BOTTOM NAV ─────────────────────────────────────────────── */}
            {genState !== 'done' && (
              <div className="border-t border-white/10 flex justify-between mt-8 pt-6">
                <button
                  onClick={() => setStep((prev) => (prev > 1 ? ((prev - 1) as WizardStep) : prev))}
                  disabled={step === 1 || isCreating}
                  className="liquid-glass rounded-full px-6 py-2.5 text-sm text-white disabled:opacity-40"
                >
                  Back
                </button>
                {step < 4 && (
                  <button
                    onClick={() => {
                      if (step === 1 && !detailsValid) return;
                      if (step === 2 && wallet.isConnected && balanceState === 'idle') {
                        refreshBalances();
                      }
                      setStep((prev) => (prev + 1) as WizardStep);
                    }}
                    disabled={
                      (step === 1 && !detailsValid) ||
                      (step === 3 && parsedRecipients.length === 0)
                    }
                    className="bg-white text-black rounded-full px-6 py-2.5 text-sm font-medium disabled:bg-white/20 disabled:text-white/40 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    Continue <ArrowRight size={15} strokeWidth={1.5} />
                  </button>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function toCreatedRecipient(r: {
  id: string;
  name: string;
  email: string | null;
  wallet_address: string | null;
  amount: string | null;
  claim_link_token: string;
  status: string;
}) {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    wallet_address: r.wallet_address,
    amount: r.amount,
    claim_link_token: r.claim_link_token,
    status: r.status,
  };
}

/** Helper: generate a CSV string from parsed recipients for the upload pipeline */
function generateCSVFromParsed(recipients: ParsedRecipient[], defaultAmount: string): string {
  const header = 'name,email,wallet_address,amount';
  const escapeField = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const rows = recipients.map((r) =>
    [
      escapeField(r.name),
      escapeField(r.email ?? ''),
      escapeField(r.wallet_address ?? ''),
      escapeField(r.amount ?? defaultAmount ?? ''),
    ].join(','),
  );
  return [header, ...rows].join('\n');
}
