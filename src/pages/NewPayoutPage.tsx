import { useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { RecipientsTable, type Recipient } from '../components/RecipientsTable';
import {
  Upload,
  Plus,
  CheckCircle2,
  Copy,
  Download,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useCampaignStore } from '@/stores/campaign.store';
import { useWalletStore } from '@/stores/wallet.store';
import { useAuthStore } from '@/stores/auth.store';
import { parseRecipientsCSV } from '@/features/campaigns/utils/csv-parser';
import {
  exportRecipientsCSV,
  downloadCSV,
} from '@/features/campaigns/utils/csv-export';
import { CampaignActivationService } from '@/features/campaigns/services/campaign-activation.service';
import { getHorizonServer } from '@/lib/stellar';
import { USDC_ISSUER, CLAIM_LINK_BASE_URL } from '@/config/constants';
import { CONTRACTS_ENABLED } from '@/config/contracts';
import { Transaction } from '@stellar/stellar-sdk';
import { NETWORK_PASSPHRASE } from '@/config/constants';

interface ParsedRecipient {
  id: string;
  name: string;
  email?: string;
  wallet_address?: string;
  amount?: string;
}

type WizardStep = 1 | 2;
type GenerationState = 'idle' | 'creating' | 'activating' | 'signing' | 'submitting' | 'done' | 'error';

export function NewPayoutPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<WizardStep>(1);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualAmount, setManualAmount] = useState('');

  // Campaign fields
  const [campaignName, setCampaignName] = useState('');
  const [defaultAmount, setDefaultAmount] = useState('');

  // Parsed recipients
  const [parsedRecipients, setParsedRecipients] = useState<ParsedRecipient[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  // Generation state
  const [genState, setGenState] = useState<GenerationState>('idle');
  const [genError, setGenError] = useState('');
  const [createdCampaignId, setCreatedCampaignId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const campaignStore = useCampaignStore();
  const wallet = useWalletStore();
  const auth = useAuthStore();

  // ── CSV Upload Handler ───────────────────────────────────────────────────
  const handleCSVUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const result = parseRecipientsCSV(text);

    if (result.errors.length > 0) {
      setParseErrors(result.errors.map((err) => `Row ${err.row}: ${err.message}`));
    } else {
      setParseErrors([]);
    }

    const newRecipients: ParsedRecipient[] = result.valid.map((row, i) => ({
      id: `csv_${Date.now()}_${i}`,
      name: row.name,
      email: row.email,
      wallet_address: row.wallet_address,
      amount: row.amount,
    }));

    setParsedRecipients((prev) => [...prev, ...newRecipients]);

    // Reset file input so the same file can be re-uploaded
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // ── Manual Add Handler ───────────────────────────────────────────────────
  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName) return;
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

  // ── Compute totals ──────────────────────────────────────────────────────
  const totalDistribution = useMemo(() => {
    return parsedRecipients.reduce((sum, r) => {
      const amount = parseFloat(r.amount || defaultAmount || '0');
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
  }, [parsedRecipients, defaultAmount]);

  // ── Map to RecipientsTable display format ────────────────────────────────
  const displayRecipients: Recipient[] = useMemo(() => {
    return parsedRecipients.map((r) => {
      const amt = r.amount || defaultAmount || '0';
      const wallet = r.wallet_address || '—';
      const truncated = wallet.length > 12 ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}` : wallet;
      return {
        id: r.id,
        recipient: truncated,
        amount: `${parseFloat(amt).toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC`,
        status: 'Pending' as const,
        claimedOn: '—',
      };
    });
  }, [parsedRecipients, defaultAmount]);

  // ── Generate Claim Links (Full Pipeline) ─────────────────────────────────
  const handleGenerateClaimLinks = useCallback(async () => {
    if (!auth.user || parsedRecipients.length === 0) return;

    try {
      // Step 1: Create campaign in Supabase
      setGenState('creating');
      const campaign = await campaignStore.createCampaign({
        organizer_id: auth.user.id,
        name: campaignName || `Payout ${new Date().toLocaleDateString()}`,
        token: 'USDC',
        issuer: USDC_ISSUER,
        amount_per_recipient: defaultAmount || '0',
        total_pool: totalDistribution.toString(),
        status: 'draft',
      });
      setCreatedCampaignId(campaign.id);

      // Step 2: Insert recipients into Supabase
      await campaignStore.uploadRecipients(campaign.id, new File(
        [generateCSVFromParsed(parsedRecipients, defaultAmount)],
        'recipients.csv',
        { type: 'text/csv' },
      ));

      // Step 3: Build claimable balance transactions if wallet connected
      if (wallet.isConnected && wallet.publicKey) {
        setGenState('activating');

        try {
          const draft = await CampaignActivationService.buildActivationTransactions({
            campaignId: campaign.id,
            organizerPublicKey: wallet.publicKey,
          });

          if (draft.unsignedTransactionXdrs.length > 0) {
            setGenState('signing');

            const server = getHorizonServer();

            for (const txXdr of draft.unsignedTransactionXdrs) {
              const signedXdr = await wallet.signTransaction(txXdr);

              setGenState('submitting');

              const tx = new Transaction(signedXdr, NETWORK_PASSPHRASE);
              const result = await server.submitTransaction(tx);

              if (result.successful) {
                // Mark campaign as active
                await CampaignActivationService.markCampaignActive(campaign.id);
              }
            }
          }
        } catch (stellarError) {
          // Non-fatal: campaign created, recipients inserted, but on-chain tx failed
          console.warn('Stellar activation skipped or failed:', stellarError);
        }
      }

      setGenState('done');
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : 'Failed to generate claim links.');
      setGenState('error');
    }
  }, [auth.user, parsedRecipients, campaignName, defaultAmount, totalDistribution, campaignStore, wallet]);

  // ── Copy all links ──────────────────────────────────────────────────────
  const handleCopyAllLinks = () => {
    const links = parsedRecipients
      .map((r) => `${CLAIM_LINK_BASE_URL}/claim/${r.id}`)
      .join('\n');
    navigator.clipboard.writeText(links);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  // ── CSV Export ──────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    // Build a minimal Recipient array for the export utility
    const exportData = parsedRecipients.map((r) => ({
      id: r.id,
      campaign_id: createdCampaignId || '',
      name: r.name,
      email: r.email ?? null,
      wallet_address: r.wallet_address ?? null,
      amount: r.amount ?? defaultAmount ?? null,
      claimable_balance_id: null,
      claim_link_token: r.id,
      status: 'pending' as const,
      claim_token_hash: null,
      registry_status: null,
      registry_tx_hash: null,
      claimed_at: null,
      created_at: new Date().toISOString(),
    }));

    const csv = exportRecipientsCSV(exportData, campaignName, CLAIM_LINK_BASE_URL);
    downloadCSV(csv, `${campaignName || 'payout'}-claim-links.csv`);
  };

  const genStateLabel: Record<GenerationState, string> = {
    idle: '',
    creating: 'Creating campaign...',
    activating: 'Building on-chain transactions...',
    signing: 'Waiting for wallet signature...',
    submitting: 'Submitting to Stellar network...',
    done: '',
    error: '',
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 px-6 sm:px-8 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#0a0a0a]/90 backdrop-blur-md z-10">
          <h1 className="text-white font-medium text-lg">Create New Payout</h1>

          {/* Step Indicator */}
          <div className="liquid-glass rounded-lg p-1 flex items-center gap-1">
            <button
              onClick={() => setStep(1)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                step === 1 ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white'
              }`}
            >
              1. Recipients
            </button>
            <button
              onClick={() => setStep(2)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                step === 2 ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white'
              }`}
            >
              2. Review & Confirm
            </button>
          </div>
        </header>

        {/* Wizard Main Content */}
        <main className="p-6 sm:p-8 flex flex-col gap-6 max-w-4xl">
          {/* STEP 1: RECIPIENTS */}
          {step === 1 && (
            <div className="flex flex-col gap-6">
              {/* Campaign Name + Default Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-white/50 text-xs block mb-1.5 font-medium">Campaign Name</label>
                  <input
                    type="text"
                    placeholder="Q3 Hackathon Prizes"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="w-full liquid-glass rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/40 outline-none focus:ring-1 focus:ring-white/20"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs block mb-1.5 font-medium">Default Amount (USDC)</label>
                  <input
                    type="text"
                    placeholder="250.00"
                    value={defaultAmount}
                    onChange={(e) => setDefaultAmount(e.target.value)}
                    className="w-full liquid-glass rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/40 outline-none focus:ring-1 focus:ring-white/20"
                  />
                </div>
              </div>

              {/* Wallet Connection Status */}
              {!wallet.isConnected ? (
                <button
                  onClick={wallet.connect}
                  className="liquid-glass rounded-xl px-4 py-3 text-white text-sm font-medium flex items-center justify-center gap-2.5 hover:bg-white/5 transition-colors"
                >
                  Connect Wallet to Sign Transactions
                </button>
              ) : (
                <div className="liquid-glass rounded-xl px-4 py-2.5 flex items-center justify-between text-sm">
                  <span className="text-white/60 text-xs">
                    Wallet: <span className="font-mono text-white/80">{wallet.publicKey?.slice(0, 6)}...{wallet.publicKey?.slice(-4)}</span>
                  </span>
                  <span className="text-xs text-[#22c55e] font-medium">Connected</span>
                </div>
              )}

              {/* CSV Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="liquid-glass rounded-2xl border-dashed border border-white/15 p-10 text-center flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/70">
                  <Upload size={22} strokeWidth={1.5} />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-white font-medium text-sm">
                    Drop CSV or click to upload
                  </p>
                  <p className="text-white/40 text-xs">
                    Columns: <code className="font-mono text-white/60">name, email, wallet_address, amount</code>
                  </p>
                </div>
              </div>

              {/* Parse Errors */}
              {parseErrors.length > 0 && (
                <div className="liquid-glass rounded-xl p-4 border border-red-500/20">
                  <div className="flex items-center gap-2 text-red-400 text-xs font-medium mb-2">
                    <AlertCircle size={14} />
                    <span>CSV Parsing Errors</span>
                  </div>
                  <ul className="text-red-400/80 text-xs space-y-1">
                    {parseErrors.slice(0, 5).map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                    {parseErrors.length > 5 && (
                      <li>...and {parseErrors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Manual Add Fallback */}
              {!showManualInput ? (
                <button
                  onClick={() => setShowManualInput(true)}
                  className="self-start text-white/70 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Plus size={14} strokeWidth={1.5} />
                  <span>Add recipient manually</span>
                </button>
              ) : (
                <form
                  onSubmit={handleAddManual}
                  className="liquid-glass rounded-xl p-4 flex flex-col sm:flex-row gap-3 items-end"
                >
                  <div className="flex-1 w-full">
                    <label className="text-white/50 text-xs block mb-1">Name</label>
                    <input
                      type="text"
                      placeholder="Alice"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      required
                      className="w-full liquid-glass rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/40 outline-none focus:ring-1 focus:ring-white/20"
                    />
                  </div>
                  <div className="flex-1 w-full">
                    <label className="text-white/50 text-xs block mb-1">Stellar Address</label>
                    <input
                      type="text"
                      placeholder="GBA7..."
                      value={manualAddress}
                      onChange={(e) => setManualAddress(e.target.value)}
                      className="w-full liquid-glass rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/40 outline-none focus:ring-1 focus:ring-white/20 font-mono"
                    />
                  </div>
                  <div className="w-full sm:w-40">
                    <label className="text-white/50 text-xs block mb-1">Amount (USDC)</label>
                    <input
                      type="text"
                      placeholder="250.00"
                      value={manualAmount}
                      onChange={(e) => setManualAmount(e.target.value)}
                      className="w-full liquid-glass rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/40 outline-none focus:ring-1 focus:ring-white/20"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="bg-white text-black font-medium text-xs rounded-xl px-4 py-2 hover:bg-white/90 transition-colors"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowManualInput(false)}
                      className="text-white/40 hover:text-white text-xs px-2 py-2"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Parsed Recipients Preview */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-white/70 text-xs uppercase tracking-wide font-medium">
                    Recipients ({parsedRecipients.length})
                  </h3>
                  {parsedRecipients.length > 0 && (
                    <button
                      onClick={() => setParsedRecipients([])}
                      className="text-white/40 hover:text-white text-xs"
                    >
                      Clear list
                    </button>
                  )}
                </div>
                <RecipientsTable data={displayRecipients} />
              </div>

              {/* Step 1 Footer Navigation */}
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <span className="text-white/40 text-xs">Step 1 of 2</span>
                <button
                  onClick={() => setStep(2)}
                  disabled={parsedRecipients.length === 0}
                  className={`font-medium rounded-full px-6 py-2.5 text-sm flex items-center gap-1.5 transition-colors ${
                    parsedRecipients.length > 0
                      ? 'bg-white text-black hover:bg-white/90 cursor-pointer'
                      : 'bg-white/20 text-white/40 cursor-not-allowed'
                  }`}
                >
                  <span>Continue to Review</span>
                  <ArrowRight size={16} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: REVIEW & CONFIRM */}
          {step === 2 && (
            <div className="flex flex-col gap-6">
              {genState === 'idle' || genState === 'error' ? (
                <>
                  {/* Summary Card */}
                  <div className="liquid-glass rounded-2xl p-6 flex flex-col gap-4">
                    <h3 className="text-white font-medium text-lg">Payout Summary</h3>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-2 border-y border-white/10">
                      <div>
                        <span className="text-white/40 text-xs block">Total Recipients</span>
                        <span className="text-white text-xl font-medium">{parsedRecipients.length}</span>
                      </div>
                      <div>
                        <span className="text-white/40 text-xs block">Total Distribution</span>
                        <span className="text-white text-xl font-medium">
                          {totalDistribution.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC
                        </span>
                      </div>
                      <div>
                        <span className="text-white/40 text-xs block">Estimated Gas</span>
                        <span className="liquid-glass rounded-full px-3 py-1 text-xs text-white/60 inline-block mt-1 font-medium">
                          Gas covered by ReRail
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <span className="text-white/50 text-xs">Recipient Breakdown</span>
                      <RecipientsTable data={displayRecipients} />
                    </div>

                    {genState === 'error' && (
                      <div className="rounded-xl p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                        {genError}
                      </div>
                    )}

                    <button
                      onClick={handleGenerateClaimLinks}
                      disabled={!auth.user}
                      className="w-full bg-white text-black font-medium rounded-full px-6 py-3 text-sm hover:bg-white/90 transition-colors mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {auth.user ? 'Generate Claim Links' : 'Sign in to Generate Links'}
                    </button>
                  </div>

                  {/* Step Nav */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setStep(1)}
                      className="text-white/70 hover:text-white text-sm font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <ArrowLeft size={16} strokeWidth={1.5} />
                      <span>Back to Recipients</span>
                    </button>
                  </div>
                </>
              ) : genState === 'done' ? (
                /* Success State After Link Generation */
                <div className="liquid-glass rounded-2xl p-8 flex flex-col items-center text-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-[#22c55e]/15 flex items-center justify-center text-[#22c55e]">
                    <CheckCircle2 size={32} strokeWidth={1.5} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h2 className="text-white text-2xl font-medium tracking-tight">
                      Links Generated Successfully!
                    </h2>
                    <p className="text-white/60 text-sm">
                      {parsedRecipients.length} gasless payout links are now active and ready for distribution.
                    </p>
                    {CONTRACTS_ENABLED && (
                      <p className="text-white/40 text-xs mt-1">
                        Campaign registered on-chain via Soroban registry
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3 mt-4">
                    <button
                      onClick={handleCopyAllLinks}
                      className="bg-white text-black font-medium rounded-full px-6 py-2.5 text-sm hover:bg-white/90 transition-colors flex items-center gap-2"
                    >
                      {copiedAll ? <Check size={16} className="text-[#22c55e]" /> : <Copy size={16} strokeWidth={1.5} />}
                      <span>{copiedAll ? 'Copied All!' : 'Copy All Links'}</span>
                    </button>
                    <button
                      onClick={handleExportCSV}
                      className="liquid-glass text-white font-medium rounded-full px-6 py-2.5 text-sm hover:bg-white/5 transition-colors flex items-center gap-2"
                    >
                      <Download size={16} strokeWidth={1.5} />
                      <span>Export CSV</span>
                    </button>
                  </div>

                  <button
                    onClick={() => navigate('/dashboard')}
                    className="mt-4 text-white/40 hover:text-white text-xs transition-colors underline"
                  >
                    Go to Dashboard →
                  </button>
                </div>
              ) : (
                /* Processing States */
                <div className="liquid-glass rounded-2xl p-12 flex flex-col items-center text-center gap-4">
                  <Loader2 size={40} strokeWidth={1.5} className="animate-spin text-white/80" />
                  <div className="flex flex-col gap-1">
                    <h3 className="text-white text-lg font-medium">
                      {genStateLabel[genState]}
                    </h3>
                    <p className="text-white/40 text-xs">
                      Please don't close this tab
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/** Helper: generate a CSV string from parsed recipients for the upload pipeline */
function generateCSVFromParsed(recipients: ParsedRecipient[], defaultAmount: string): string {
  const header = 'name,email,wallet_address,amount';
  const rows = recipients.map((r) =>
    [r.name, r.email ?? '', r.wallet_address ?? '', r.amount ?? defaultAmount ?? ''].join(',')
  );
  return [header, ...rows].join('\n');
}
