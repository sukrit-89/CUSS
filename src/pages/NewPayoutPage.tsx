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
  Mail,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { WalletButton } from '@/components/WalletButton';
import { Sidebar } from '@/components/Sidebar';
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
import { isValidAmount, isValidStellarAddress, isValidEmail } from '@/lib/utils/validation';
import {
  getXlmToUsdcQuote,
  quoteFailureMessage,
  type SwapQuote,
} from '@/lib/defi/soroswap';
import { SUPPORTED_ASSETS } from '@/config/stellar';
import {
  CIRCLE_FAUCET_URL,
  CLAIM_LINK_BASE_URL,
  DEFAULT_CLAIM_EXPIRY_SECONDS,
  NETWORK_PASSPHRASE,
  XLM_RESERVE_PER_BALANCE,
} from '@/config/constants';
import { Asset, Transaction } from '@stellar/stellar-sdk';

interface ParsedRecipient {
  id: string;
  name: string;
  email?: string;
  wallet_address?: string;
  amount: string;
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

const STEP_LABELS = ['Details', 'Recipients', 'Fund', 'Review'];

export function NewPayoutPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<WizardStep>(1);

  // ── Step 1: details ──────────────────────────────────────────────────────
  const [campaignName, setCampaignName] = useState('');
  const [selectedToken, setSelectedToken] = useState('USDC');
  const [hasDeadline, setHasDeadline] = useState(true);
  const [deadline, setDeadline] = useState(defaultDeadlineValue);

  // ── Step 2: recipients ───────────────────────────────────────────────────
  const [inputMode, setInputMode] = useState<'upload' | 'single' | 'bulk'>('upload');
  const [manualName, setManualName] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [parsedRecipients, setParsedRecipients] = useState<ParsedRecipient[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  // ── Step 3: funding ──────────────────────────────────────────────────────
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

  // ── Step 4: creation ─────────────────────────────────────────────────────
  const [genState, setGenState] = useState<GenerationState>('idle');
  const [genError, setGenError] = useState('');
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedFormatted, setCopiedFormatted] = useState(false);
  const [copiedLinkMap, setCopiedLinkMap] = useState<Record<string, boolean>>({});
  const [searchLinkQuery, setSearchLinkQuery] = useState('');
  const [registryProgress, setRegistryProgress] = useState('');
  const [registryWarning, setRegistryWarning] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<{ sent: number; total: number; simulated?: boolean } | null>(null);
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

  const currentAssetOption = useMemo(
    () => SUPPORTED_ASSETS.find((a) => a.code === selectedToken) ?? SUPPORTED_ASSETS[0],
    [selectedToken],
  );

  const totalDistribution = useMemo(
    () =>
      parsedRecipients.reduce((sum, r) => {
        const amount = parseFloat(r.amount || '0');
        return sum + (Number.isNaN(amount) ? 0 : amount);
      }, 0),
    [parsedRecipients],
  );

  const xlmReserve = useMemo(
    () => parsedRecipients.length * XLM_RESERVE_PER_BALANCE,
    [parsedRecipients.length],
  );

  const detailsValid =
    campaignName.trim().length > 0 &&
    (!hasDeadline || new Date(deadline).getTime() > Date.now());

  const usdcBalanceNumber = parseFloat(balances.usdc ?? '0');

  // ── Step 3 funding: read organizer balances from Horizon ──────────────────
  const refreshBalances = useCallback(async () => {
    if (!wallet.publicKey) return;

    setBalanceState('loading');
    setBalanceError('');

    try {
      const [usdc, xlm] = await Promise.all([
        getAssetBalance(wallet.publicKey, currentAssetOption.asset),
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
  }, [wallet.publicKey, currentAssetOption.asset]);

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

  // ── Step 2: Recipient Addition Handlers ───────────────────────────────────
  const handleCSVUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = parseRecipientsCSV(await file.text());

    setParseErrors(
      result.errors.length > 0
        ? result.errors.map((err) => `Row ${err.row}: ${err.message}`)
        : [],
    );

    const validNewRecipients: ParsedRecipient[] = [];
    result.valid.forEach((row, i) => {
      if (row.amount && isValidAmount(row.amount)) {
        validNewRecipients.push({
          id: `csv_${Date.now()}_${i}`,
          name: row.name,
          email: row.email,
          wallet_address: row.wallet_address,
          amount: row.amount,
        });
      }
    });

    setParsedRecipients((prev) => [...prev, ...validNewRecipients]);

    if (fileInputRef.current) fileInputRef.current.value = '';
    if (validNewRecipients.length > 0) {
      toast.success(`Imported ${validNewRecipients.length} recipient(s) from CSV`);
    }
  }, []);

  const handleAddSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) {
      toast.error('Recipient name is required.');
      return;
    }
    if (!manualAmount || !isValidAmount(manualAmount) || parseFloat(manualAmount) <= 0) {
      toast.error('Please enter a valid positive payout amount.');
      return;
    }
    if (manualAddress && !isValidStellarAddress(manualAddress)) {
      toast.error('Invalid Stellar wallet address.');
      return;
    }
    if (manualEmail && !isValidEmail(manualEmail)) {
      toast.error('Invalid email address.');
      return;
    }

    setParsedRecipients((prev) => [
      ...prev,
      {
        id: `man_${Date.now()}`,
        name: manualName.trim(),
        amount: manualAmount.trim(),
        wallet_address: manualAddress.trim() || undefined,
        email: manualEmail.trim() || undefined,
      },
    ]);

    setManualName('');
    setManualAmount('');
    setManualAddress('');
    setManualEmail('');
    toast.success('Recipient added');
  };

  const handleAddBulk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkText.trim()) return;

    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
    const added: ParsedRecipient[] = [];
    const errors: string[] = [];

    lines.forEach((line, index) => {
      // Split by comma or tab
      const parts = line.split(/[,	]/).map((p) => p.trim());
      const name = parts[0];
      const amount = parts[1];
      const addressOrEmail1 = parts[2];
      const addressOrEmail2 = parts[3];

      if (!name) {
        errors.push(`Line ${index + 1}: Name is missing`);
        return;
      }
      if (!amount || !isValidAmount(amount) || parseFloat(amount) <= 0) {
        errors.push(`Line ${index + 1} (${name}): Invalid amount '${amount || ''}'`);
        return;
      }

      let wallet_address: string | undefined;
      let email: string | undefined;

      [addressOrEmail1, addressOrEmail2].filter(Boolean).forEach((val) => {
        if (isValidStellarAddress(val)) wallet_address = val;
        else if (isValidEmail(val)) email = val;
      });

      added.push({
        id: `bulk_${Date.now()}_${index}`,
        name,
        amount,
        wallet_address,
        email,
      });
    });

    if (errors.length > 0) {
      setParseErrors(errors);
    } else {
      setParseErrors([]);
    }

    if (added.length > 0) {
      setParsedRecipients((prev) => [...prev, ...added]);
      setBulkText('');
      toast.success(`Added ${added.length} recipient(s) from quick paste`);
    }
  };

  const handleRemoveRecipient = (id: string) => {
    setParsedRecipients((prev) => prev.filter((r) => r.id !== id));
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

    const deadlineSeconds = Math.floor((deadlineDate.getTime() - Date.now()) / 1000);

    try {
      if (!wallet.isConnected || !wallet.publicKey) {
        throw new Error(
          'Connect your Stellar wallet before creating the campaign — the payout must be funded on-chain.',
        );
      }

      const treasuryBalance = await getAssetBalance(wallet.publicKey, currentAssetOption.asset);

      if (treasuryBalance === null) {
        throw new Error('This Stellar account does not exist yet. Fund it before creating a campaign.');
      }

      if (parseFloat(treasuryBalance) < totalDistribution) {
        throw new Error(
          `Treasury holds ${treasuryBalance} ${currentAssetOption.code} but this campaign needs ${totalDistribution.toFixed(2)} ${currentAssetOption.code}.`,
        );
      }

      setGenState('creating');
      const campaign = await campaignStore.createCampaign({
        organizer_id: auth.user.id,
        name: campaignName || `Payout ${new Date().toLocaleDateString()}`,
        token: currentAssetOption.code,
        issuer: currentAssetOption.issuer,
        amount_per_recipient: '0',
        total_pool: totalDistribution.toString(),
        deadline: deadlineDate.toISOString(),
        treasury_address: wallet.publicKey,
        status: 'draft',
      });
      setCreatedCampaignId(campaign.id);

      await campaignStore.uploadRecipients(
        campaign.id,
        new File([generateCSVFromParsed(parsedRecipients)], 'recipients.csv', {
          type: 'text/csv',
        }),
      );

      const dbRecipients = await getRecipientsByCampaign(campaign.id);
      setCreatedRecipients(dbRecipients.map(toCreatedRecipient));

      if (RegistryService.isEnabled) {
        setGenState('registering');
        try {
          await RegistryService.mirrorCampaign({
            campaignId: campaign.id,
            organizerPublicKey: wallet.publicKey,
            name: campaign.name,
            defaultAmount: '0',
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
        asset: currentAssetOption.asset,
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

        setGenState('syncing');
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
      toast.success('Campaign created and claim links generated!');
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : 'Failed to create the campaign.');
      setGenState('error');
    }
  }, [
    auth.user,
    auth.accessToken,
    parsedRecipients,
    campaignName,
    deadline,
    hasDeadline,
    totalDistribution,
    currentAssetOption,
    campaignStore,
    wallet,
  ]);

  // ── Share & Copy Handlers ────────────────────────────────────────────────
  const handleCopySingleLink = (token: string, recipientName: string) => {
    const url = `${CLAIM_LINK_BASE_URL}/claim/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedLinkMap((prev) => ({ ...prev, [token]: true }));
    toast.success(`Claim link for ${recipientName} copied!`);
    setTimeout(() => {
      setCopiedLinkMap((prev) => ({ ...prev, [token]: false }));
    }, 2000);
  };

  const handleCopyAllRawLinks = () => {
    const links = createdRecipients
      .map((r) => `${CLAIM_LINK_BASE_URL}/claim/${r.claim_link_token}`)
      .join('\n');
    navigator.clipboard.writeText(links);
    setCopiedAll(true);
    toast.success(`Copied ${createdRecipients.length} raw claim links!`);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCopyFormattedList = () => {
    const formatted = createdRecipients
      .map(
        (r, idx) =>
          `${idx + 1}. ${r.name} (${parseFloat(r.amount || '0').toFixed(2)} ${selectedToken}): ${CLAIM_LINK_BASE_URL}/claim/${r.claim_link_token}`,
      )
      .join('\n');
    navigator.clipboard.writeText(formatted);
    setCopiedFormatted(true);
    toast.success('Copied formatted claim list to clipboard (ready for Discord/Slack/Notion)!');
    setTimeout(() => setCopiedFormatted(false), 2000);
  };

  const handleExportCSV = () => {
    const exportData = createdRecipients.map((r) => ({
      id: r.id,
      campaign_id: createdCampaignId || '',
      name: r.name,
      email: r.email,
      wallet_address: r.wallet_address,
      amount: r.amount ?? null,
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

  const filteredCreatedRecipients = useMemo(() => {
    if (!searchLinkQuery.trim()) return createdRecipients;
    const q = searchLinkQuery.toLowerCase().trim();
    return createdRecipients.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.email && r.email.toLowerCase().includes(q)) ||
        (r.wallet_address && r.wallet_address.toLowerCase().includes(q)),
    );
  }, [createdRecipients, searchLinkQuery]);

  const isCreating = genState !== 'idle' && genState !== 'error' && genState !== 'done';
  const progressSteps = useMemo(() => getProgressSteps(), []);
  const progressOrder = useMemo(() => progressSteps.map((s) => s.key), [progressSteps]);
  const currentProgressIndex = progressOrder.indexOf(genState);

  return (
    <div className="min-h-screen bg-[#080808] text-white flex pb-20 md:pb-0 font-sans">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 px-6 sm:px-8 border-b border-white/10 flex items-center sticky top-0 bg-[#080808]/90 backdrop-blur-md z-10">
          <h1 className="text-white font-medium text-lg">New Payout Campaign</h1>
        </header>

        <main className="flex-1 p-4 sm:p-8 flex justify-center">
          <div className="w-full max-w-[660px] liquid-glass rounded-2xl p-6 sm:p-8 border border-white/10">
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
                            ? 'bg-white text-black font-semibold'
                            : isDone
                              ? 'bg-white/20 text-white/70'
                              : 'border border-white/20 text-white/30'
                        }`}
                      >
                        {isDone ? '✓' : stepNumber}
                      </div>
                      <span
                        className={`text-xs hidden sm:block ${isActive ? 'text-white font-medium' : 'text-white/40'}`}
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
              <div className="flex flex-col gap-6">
                <div>
                  <label className="text-white/50 text-xs font-medium uppercase tracking-wide block mb-2">
                    Campaign name
                  </label>
                  <input
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g. Q3 Hackathon Prizes / Core Contributor Grants"
                    className="w-full liquid-glass rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm outline-none focus:ring-1 focus:ring-white/20"
                  />
                </div>

                <div>
                  <label className="text-white/50 text-xs font-medium uppercase tracking-wide block mb-2">
                    Payout Asset
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {SUPPORTED_ASSETS.map((asset) => {
                      const isSelected = selectedToken === asset.code;
                      return (
                        <button
                          key={asset.code}
                          type="button"
                          onClick={() => setSelectedToken(asset.code)}
                          className={`liquid-glass rounded-xl p-3.5 flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                            isSelected
                              ? 'border-white bg-white/10 text-white'
                              : 'border-white/10 text-white/50 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <span className="text-base font-semibold font-mono">{asset.symbol}</span>
                          <span className="text-xs font-medium">{asset.code}</span>
                          <span className="text-[10px] text-white/30">{asset.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-white/50 text-xs font-medium uppercase tracking-wide">
                        Claim deadline & Reclaim
                      </label>
                      <p className="text-white/30 text-[11px] mt-0.5">
                        Enforce a window after which unclaimed funds return to you.
                      </p>
                    </div>
                    <button
                      onClick={() => setHasDeadline(!hasDeadline)}
                      className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${hasDeadline ? 'bg-white' : 'bg-white/15'}`}
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
                      className="w-full liquid-glass rounded-xl px-4 py-3 text-white text-sm mt-3 outline-none focus:ring-1 focus:ring-white/20 [color-scheme:dark]"
                    />
                  )}
                </div>

                <div className="liquid-glass rounded-xl p-3.5 border border-white/5 bg-white/[0.02]">
                  <p className="text-white/40 text-xs flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-400 shrink-0" />
                    <span>Amounts are specified individually for each recipient in the next step.</span>
                  </p>
                </div>
              </div>
            )}

            {/* ── STEP 2: RECIPIENTS ─────────────────────────────────────── */}
            {step === 2 && (
              <div className="flex flex-col gap-5">
                {/* Method selector tabs */}
                <div className="flex gap-1.5 liquid-glass p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setInputMode('upload')}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      inputMode === 'upload' ? 'bg-white text-black font-semibold shadow-sm' : 'text-white/50 hover:text-white'
                    }`}
                  >
                    <Upload size={13} />
                    <span>Upload CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('single')}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      inputMode === 'single' ? 'bg-white text-black font-semibold shadow-sm' : 'text-white/50 hover:text-white'
                    }`}
                  >
                    <Plus size={13} />
                    <span>Single Add</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('bulk')}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      inputMode === 'bulk' ? 'bg-white text-black font-semibold shadow-sm' : 'text-white/50 hover:text-white'
                    }`}
                  >
                    <Sparkles size={13} />
                    <span>Quick Paste</span>
                  </button>
                </div>

                {/* Mode 1: CSV Upload */}
                {inputMode === 'upload' && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="liquid-glass rounded-xl border border-dashed border-white/20 p-8 text-center flex flex-col items-center gap-2.5 cursor-pointer hover:bg-white/[0.03] transition-colors"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleCSVUpload}
                      className="hidden"
                    />
                    <Upload size={24} className="text-white/40" strokeWidth={1.5} />
                    <p className="text-white text-sm font-medium">Drop CSV file here or click to browse</p>
                    <p className="text-white/40 text-xs font-mono">
                      Expected columns: name, amount, wallet_address (optional), email (optional)
                    </p>
                  </div>
                )}

                {/* Mode 2: Single Manual Form */}
                {inputMode === 'single' && (
                  <form onSubmit={handleAddSingle} className="liquid-glass rounded-xl p-4 flex flex-col gap-3 border border-white/10">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-white/40 text-[11px] uppercase tracking-wide block mb-1">
                          Name *
                        </label>
                        <input
                          value={manualName}
                          onChange={(e) => setManualName(e.target.value)}
                          placeholder="e.g. Alice Chen"
                          required
                          className="w-full liquid-glass rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-white/30 outline-none focus:ring-1 focus:ring-white/20"
                        />
                      </div>
                      <div>
                        <label className="text-white/40 text-[11px] uppercase tracking-wide block mb-1">
                          Amount ({selectedToken}) *
                        </label>
                        <input
                          value={manualAmount}
                          onChange={(e) => setManualAmount(e.target.value)}
                          placeholder="e.g. 100.00"
                          required
                          className="w-full liquid-glass rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-white/30 font-mono outline-none focus:ring-1 focus:ring-white/20"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-white/40 text-[11px] uppercase tracking-wide block mb-1">
                        Wallet Address <span className="text-white/20">(Optional)</span>
                      </label>
                      <input
                        value={manualAddress}
                        onChange={(e) => setManualAddress(e.target.value)}
                        placeholder="GBA7... (Stellar public key)"
                        className="w-full liquid-glass rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-white/30 font-mono outline-none focus:ring-1 focus:ring-white/20"
                      />
                    </div>
                    <div>
                      <label className="text-white/40 text-[11px] uppercase tracking-wide block mb-1">
                        Email Address <span className="text-white/20">(Optional, for notification)</span>
                      </label>
                      <input
                        type="email"
                        value={manualEmail}
                        onChange={(e) => setManualEmail(e.target.value)}
                        placeholder="alice@domain.com"
                        className="w-full liquid-glass rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-white/30 outline-none focus:ring-1 focus:ring-white/20"
                      />
                    </div>
                    <button
                      type="submit"
                      className="bg-white text-black text-xs font-semibold rounded-full px-5 py-2.5 self-start mt-1 cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus size={14} /> Add Recipient
                    </button>
                  </form>
                )}

                {/* Mode 3: Quick Multi-Paste */}
                {inputMode === 'bulk' && (
                  <form onSubmit={handleAddBulk} className="liquid-glass rounded-xl p-4 flex flex-col gap-3 border border-white/10">
                    <label className="text-white/40 text-xs">
                      Paste rows formatted as: <code className="text-white/80 font-mono">Name, Amount, Address/Email (optional)</code>
                    </label>
                    <textarea
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      rows={4}
                      placeholder={`Alice, 50.00\nBob, 100.00, GBA7EXAMPLEKEY...\nCharlie, 75.00, charlie@email.com`}
                      className="w-full liquid-glass rounded-xl p-3 text-white text-xs font-mono placeholder-white/25 outline-none focus:ring-1 focus:ring-white/20"
                    />
                    <button
                      type="submit"
                      disabled={!bulkText.trim()}
                      className="bg-white text-black text-xs font-semibold rounded-full px-5 py-2.5 self-start cursor-pointer disabled:opacity-40"
                    >
                      Parse & Add Rows
                    </button>
                  </form>
                )}

                {/* Parsing Errors */}
                {parseErrors.length > 0 && (
                  <div className="liquid-glass rounded-xl p-4 border border-red-500/20 bg-red-500/5">
                    <div className="flex items-center gap-2 text-red-300 text-xs font-medium mb-1.5">
                      <AlertCircle size={14} /> Parsing Issues
                    </div>
                    <ul className="text-red-300/80 text-xs space-y-1">
                      {parseErrors.slice(0, 4).map((err) => (
                        <li key={err}>• {err}</li>
                      ))}
                      {parseErrors.length > 4 && <li>...and {parseErrors.length - 4} more</li>}
                    </ul>
                  </div>
                )}

                {/* Recipients Table Preview */}
                <div className="flex flex-col gap-3 mt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-sm">
                        Recipients ({parsedRecipients.length})
                      </span>
                      {parsedRecipients.length > 0 && (
                        <span className="text-xs font-mono text-white/50 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10">
                          Total: {totalDistribution.toFixed(2)} {selectedToken}
                        </span>
                      )}
                    </div>
                    {parsedRecipients.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setParsedRecipients([])}
                        className="text-white/40 hover:text-red-400 text-xs transition-colors cursor-pointer"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  {parsedRecipients.length === 0 ? (
                    <div className="liquid-glass rounded-xl p-8 text-center text-white/30 text-xs border border-white/5">
                      No recipients added yet. Upload a CSV or use the manual forms above.
                    </div>
                  ) : (
                    <div className="liquid-glass rounded-xl overflow-hidden border border-white/10 max-h-60 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="text-white/30 font-mono uppercase text-[10px] tracking-wider border-b border-white/10 sticky top-0 bg-[#121212]">
                          <tr>
                            <th className="px-4 py-2.5">Name</th>
                            <th className="px-4 py-2.5">Amount</th>
                            <th className="px-4 py-2.5">Destination</th>
                            <th className="px-4 py-2.5 text-right"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {parsedRecipients.map((r) => (
                            <tr key={r.id} className="hover:bg-white/[0.02]">
                              <td className="px-4 py-2.5 font-medium text-white">{r.name}</td>
                              <td className="px-4 py-2.5 font-mono text-white/90">
                                {parseFloat(r.amount).toFixed(2)} {selectedToken}
                              </td>
                              <td className="px-4 py-2.5 text-white/40 font-mono text-[11px]">
                                {r.wallet_address
                                  ? `${r.wallet_address.slice(0, 4)}...${r.wallet_address.slice(-4)}`
                                  : r.email || 'Direct claim link'}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRecipient(r.id)}
                                  className="text-white/30 hover:text-red-400 p-1 transition-colors cursor-pointer"
                                  title="Remove recipient"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── STEP 3: FUND ───────────────────────────────────────────── */}
            {step === 3 && (
              <div className="flex flex-col gap-5">
                <div className="liquid-glass rounded-xl p-4 border border-white/10 flex items-center justify-between">
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wide">Required Campaign Pool</p>
                    <p className="text-white text-xl font-mono font-medium mt-0.5">
                      {totalDistribution.toFixed(2)} {selectedToken}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-white/40 text-xs uppercase tracking-wide">Est. XLM Reserve</p>
                    <p className="text-white/80 text-sm font-mono mt-0.5">
                      ≈ {xlmReserve.toFixed(1)} XLM
                    </p>
                  </div>
                </div>

                {!wallet.isConnected ? (
                  <WalletButton
                    variant="glass"
                    className="w-full justify-center"
                    connectLabel="Connect wallet to verify treasury funding"
                  />
                ) : (
                  <>
                    <div className="liquid-glass rounded-xl px-4 py-3 flex items-center justify-between text-sm">
                      <span className="text-white/60 text-xs font-mono">
                        {wallet.publicKey?.slice(0, 6)}...{wallet.publicKey?.slice(-4)}
                      </span>
                      <button
                        onClick={refreshBalances}
                        className="text-white/50 hover:text-white text-xs cursor-pointer"
                      >
                        {balanceState === 'loading' ? 'Checking...' : 'Refresh balance'}
                      </button>
                    </div>

                    <div className="liquid-glass rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-white/40 text-xs uppercase tracking-wide">Your USDC</p>
                        <p className="text-white text-lg font-mono">
                          {balanceState === 'loaded' ? (balances.usdc ?? '0.00') : '—'}
                        </p>
                      </div>
                      <ArrowRight size={16} className="text-white/30" />
                      <div className="text-right">
                        <p className="text-white/40 text-xs uppercase tracking-wide">Your XLM</p>
                        <p className="text-white text-lg font-mono">
                          {balanceState === 'loaded' ? (balances.xlm ?? '0.00') : '—'}
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

                {/* SoroSwap Quote Integration */}
                <div className="flex flex-col gap-3">
                  <label className="text-white/50 text-xs font-medium uppercase tracking-wide">
                    Convert XLM → USDC Quote (SoroSwap)
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={xlmToSwap}
                      onChange={(e) => setXlmToSwap(e.target.value)}
                      placeholder="e.g. 250"
                      className="flex-1 liquid-glass rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm font-mono outline-none focus:ring-1 focus:ring-white/20"
                    />
                    <button
                      onClick={fetchQuote}
                      className="liquid-glass rounded-xl px-4 text-sm text-white/70 hover:text-white transition-colors cursor-pointer"
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
                        <p className="text-white/40 text-xs">You receive</p>
                        <p className="text-white font-mono">{quote.amountOut.toFixed(2)} USDC</p>
                      </div>
                    </div>
                  )}

                  {quoteState === 'unavailable' && (
                    <p className="text-amber-200 text-xs text-center">{quoteMessage}</p>
                  )}
                </div>

                <a
                  href={CIRCLE_FAUCET_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="liquid-glass rounded-xl px-4 py-3 text-xs text-white/70 hover:text-white flex items-center justify-center gap-2 transition-colors border border-white/5"
                >
                  💡 Need testnet USDC? Get it free from Circle&apos;s faucet
                  <ExternalLink size={12} />
                </a>
              </div>
            )}

            {/* ── STEP 4: REVIEW & CREATE ────────────────────────────────── */}
            {step === 4 && (
              <div className="flex flex-col gap-5">
                {genState === 'done' ? (
                  <div className="flex flex-col gap-6 py-2">
                    {/* Success Header */}
                    <div className="flex flex-col items-center text-center gap-2">
                      <CheckCircle2 size={36} className="text-green-400" strokeWidth={1.5} />
                      <h2 className="text-white text-xl font-medium">
                        {createdRecipients.length} Claim Links Ready!
                      </h2>
                      <p className="text-white/40 text-xs max-w-md">
                        Funds are safely locked in Stellar Claimable Balances. Share the links with your recipients below.
                      </p>
                    </div>

                    {registryWarning && (
                      <div className="w-full rounded-xl p-3 bg-amber-500/10 text-amber-200 text-xs text-left border border-amber-500/20">
                        {registryWarning}
                      </div>
                    )}

                    {/* Quick Bulk Action Bar */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <button
                        onClick={handleCopyFormattedList}
                        className="bg-white text-black text-xs font-semibold rounded-xl p-3 flex items-center justify-center gap-2 hover:bg-white/90 transition-colors cursor-pointer"
                      >
                        {copiedFormatted ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                        <span>{copiedFormatted ? 'Copied List!' : 'Copy Formatted List'}</span>
                      </button>

                      <button
                        onClick={handleCopyAllRawLinks}
                        className="liquid-glass text-white text-xs font-medium rounded-xl p-3 flex items-center justify-center gap-2 hover:bg-white/10 transition-colors border border-white/10 cursor-pointer"
                      >
                        {copiedAll ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                        <span>{copiedAll ? 'Copied Links' : 'Copy All Links'}</span>
                      </button>

                      <button
                        onClick={handleExportCSV}
                        className="liquid-glass text-white text-xs font-medium rounded-xl p-3 flex items-center justify-center gap-2 hover:bg-white/10 transition-colors border border-white/10 cursor-pointer"
                      >
                        <Download size={14} />
                        <span>Export CSV</span>
                      </button>
                    </div>

                    {/* Automated Email Action if emails exist */}
                    {createdRecipients.some((r) => r.email && r.email.includes('@')) && (
                      <div className="liquid-glass rounded-xl p-4 border border-white/10 flex flex-col gap-2.5 text-left">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-white/80 font-medium">
                            <Mail size={14} className="text-white/60" />
                            <span>Automated Email Dispatch</span>
                          </div>
                          {emailResult && (
                            <span className="text-[11px] text-green-300 font-mono">
                              {emailResult.sent}/{emailResult.total} Sent {emailResult.simulated ? '(Preview Mode)' : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-white/40 text-xs">
                          Send direct claim link emails to recipients with registered email addresses.
                        </p>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!createdCampaignId) return;
                            setEmailSending(true);
                            try {
                              const res = await fetch('/api/notify/email', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ campaignId: createdCampaignId, baseUrl: CLAIM_LINK_BASE_URL }),
                              });
                              const data = await res.json();
                              if (!res.ok) throw new Error(data.error || 'Failed to send emails');
                              setEmailResult(data);
                              toast.success(
                                data.simulated
                                  ? `Dispatched claim emails to ${data.sent} recipient(s) (Preview Mode)`
                                  : `Sent claim emails to ${data.sent} recipient(s)!`,
                              );
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : 'Failed to send emails.');
                            } finally {
                              setEmailSending(false);
                            }
                          }}
                          disabled={emailSending}
                          className="bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-full px-4 py-2 self-start transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {emailSending ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                          {emailSending ? 'Sending emails...' : 'Send claim emails to recipients'}
                        </button>
                      </div>
                    )}

                    {/* Interactive Claim Links Directory */}
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-white/50 text-xs font-mono uppercase tracking-wide">
                          Claim Links Directory ({createdRecipients.length})
                        </span>
                        {createdRecipients.length > 3 && (
                          <div className="flex items-center gap-1.5 liquid-glass rounded-full px-3 py-1 border border-white/10">
                            <Search size={11} className="text-white/40" />
                            <input
                              value={searchLinkQuery}
                              onChange={(e) => setSearchLinkQuery(e.target.value)}
                              placeholder="Search recipient..."
                              className="bg-transparent text-xs text-white placeholder-white/30 outline-none w-28 sm:w-36"
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1">
                        {filteredCreatedRecipients.map((r) => {
                          const claimUrl = `${CLAIM_LINK_BASE_URL}/claim/${r.claim_link_token}`;
                          const isCopied = !!copiedLinkMap[r.claim_link_token];
                          const shareMsg = `Hi ${r.name}, your ${parseFloat(r.amount || '0').toFixed(2)} ${selectedToken} payout is ready to claim on ReRail: ${claimUrl}`;
                          const waUrl = `https://wa.me/?text=${encodeURIComponent(shareMsg)}`;
                          const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(claimUrl)}&text=${encodeURIComponent(shareMsg)}`;
                          const mailUrl = `mailto:${r.email || ''}?subject=${encodeURIComponent(`Your ${campaignName || 'ReRail'} Grant`)}&body=${encodeURIComponent(shareMsg)}`;

                          return (
                            <div
                              key={r.id}
                              className="liquid-glass rounded-xl p-3.5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left hover:border-white/20 transition-all"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-white text-xs sm:text-sm truncate">
                                    {r.name}
                                  </span>
                                  <span className="text-[11px] font-mono font-medium text-white/90 bg-white/10 px-2 py-0.5 rounded">
                                    {parseFloat(r.amount || '0').toFixed(2)} {selectedToken}
                                  </span>
                                </div>
                                <div className="text-white/30 font-mono text-[11px] truncate mt-0.5">
                                  {claimUrl}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                <button
                                  onClick={() => handleCopySingleLink(r.claim_link_token, r.name)}
                                  className="liquid-glass rounded-full px-3 py-1.5 text-xs text-white/80 hover:text-white flex items-center gap-1.5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                                  title="Copy Claim Link"
                                >
                                  {isCopied ? (
                                    <Check size={12} className="text-green-400" />
                                  ) : (
                                    <Copy size={12} />
                                  )}
                                  <span>{isCopied ? 'Copied' : 'Copy'}</span>
                                </button>

                                <a
                                  href={claimUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="liquid-glass rounded-full p-2 text-white/60 hover:text-white border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                                  title="Open & Test Claim Link"
                                >
                                  <ExternalLink size={12} />
                                </a>

                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="liquid-glass rounded-full p-2 text-white/60 hover:text-green-400 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                                  title="Share on WhatsApp"
                                >
                                  <Send size={12} />
                                </a>

                                <a
                                  href={tgUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="liquid-glass rounded-full p-2 text-white/60 hover:text-sky-400 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                                  title="Share on Telegram"
                                >
                                  <Sparkles size={12} />
                                </a>

                                <a
                                  href={mailUrl}
                                  className="liquid-glass rounded-full p-2 text-white/60 hover:text-blue-400 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                                  title="Share via Email"
                                >
                                  <Mail size={12} />
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/10 flex justify-center">
                      <button
                        onClick={() =>
                          navigate(createdCampaignId ? `/campaigns/${createdCampaignId}` : '/dashboard')
                        }
                        className="text-white/60 hover:text-white text-xs underline cursor-pointer"
                      >
                        View Full Campaign Dashboard →
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col">
                      {[
                        ['Campaign', campaignName],
                        ['Recipients', String(parsedRecipients.length)],
                        [
                          `Total ${selectedToken}`,
                          `${totalDistribution.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${selectedToken}`,
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
                        <div className="rounded-xl p-3 bg-amber-500/10 text-amber-200 text-xs border border-amber-500/20">
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
                      <div className="rounded-xl p-3 bg-red-500/10 text-red-300 text-xs border border-red-500/20">
                        {genError}
                      </div>
                    )}

                    <button
                      onClick={handleGenerateClaimLinks}
                      disabled={!auth.user || isCreating || parsedRecipients.length === 0}
                      className="w-full bg-white text-black text-sm font-semibold rounded-full px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:bg-white/90 transition-colors"
                    >
                      {isCreating
                        ? 'Creating & Locking Funds on Stellar...'
                        : auth.user
                          ? 'Create Campaign & Lock Funds'
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
                  className="liquid-glass rounded-full px-6 py-2.5 text-sm text-white disabled:opacity-40 cursor-pointer"
                >
                  Back
                </button>
                {step < 4 && (
                  <button
                    onClick={() => {
                      if (step === 1 && !detailsValid) return;
                      if (step === 2 && parsedRecipients.length === 0) {
                        toast.error('Add at least one recipient with an amount.');
                        return;
                      }
                      if (step === 2 && wallet.isConnected && balanceState === 'idle') {
                        refreshBalances();
                      }
                      setStep((prev) => (prev + 1) as WizardStep);
                    }}
                    disabled={
                      (step === 1 && !detailsValid) ||
                      (step === 2 && parsedRecipients.length === 0)
                    }
                    className="bg-white text-black rounded-full px-6 py-2.5 text-sm font-semibold disabled:bg-white/20 disabled:text-white/40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
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
    return JSON.parse(text);
  } catch {
    return null;
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
function generateCSVFromParsed(recipients: ParsedRecipient[]): string {
  const header = 'name,email,wallet_address,amount';
  const escapeField = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const rows = recipients.map((r) =>
    [
      escapeField(r.name),
      escapeField(r.email ?? ''),
      escapeField(r.wallet_address ?? ''),
      escapeField(r.amount ?? '0'),
    ].join(','),
  );
  return [header, ...rows].join('\n');
}
