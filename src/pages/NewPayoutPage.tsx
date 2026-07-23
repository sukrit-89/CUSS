import { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { RecipientsTable, type Recipient } from '../components/RecipientsTable';
import { Upload, Plus, CheckCircle2, Copy, Download, ArrowLeft, ArrowRight, Check } from 'lucide-react';

export function NewPayoutPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [isGenerated, setIsGenerated] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  const [recipients, setRecipients] = useState<Recipient[]>([
    {
      id: 'rec_1',
      recipient: 'GBA7...9X21',
      amount: '500.00 USDC',
      status: 'Pending',
      claimedOn: '—',
    },
    {
      id: 'rec_2',
      recipient: 'GD82...4M90',
      amount: '250.00 USDC',
      status: 'Pending',
      claimedOn: '—',
    },
  ]);

  const handleSimulateCSVUpload = () => {
    // Simulate parsing a CSV file
    const sampleRecipients: Recipient[] = [
      {
        id: 'rec_csv_1',
        recipient: 'GC19...7P34',
        amount: '1,000.00 USDC',
        status: 'Pending',
        claimedOn: '—',
      },
      {
        id: 'rec_csv_2',
        recipient: 'GBL4...1K88',
        amount: '750.00 USDC',
        status: 'Pending',
        claimedOn: '—',
      },
      {
        id: 'rec_csv_3',
        recipient: 'GDM9...3Q12',
        amount: '300.00 USDC',
        status: 'Pending',
        claimedOn: '—',
      },
    ];
    setRecipients((prev) => [...prev, ...sampleRecipients]);
  };

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualAddress || !manualAmount) return;
    setRecipients((prev) => [
      ...prev,
      {
        id: `rec_man_${Date.now()}`,
        recipient: manualAddress,
        amount: `${manualAmount} USDC`,
        status: 'Pending',
        claimedOn: '—',
      },
    ]);
    setManualAddress('');
    setManualAmount('');
    setShowManualInput(false);
  };

  const handleCopyAllLinks = () => {
    const links = recipients.map((r) => `${window.location.origin}/claim/${r.id}`).join('\n');
    navigator.clipboard.writeText(links);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
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
              {/* CSV Dropzone */}
              <div
                onClick={handleSimulateCSVUpload}
                className="liquid-glass rounded-2xl p-6 border-dashed border border-white/15 rounded-xl p-10 text-center flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/70">
                  <Upload size={22} strokeWidth={1.5} />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-white font-medium text-sm">
                    Drop CSV or click to upload
                  </p>
                  <p className="text-white/40 text-xs">
                    Support formatted columns: <code className="font-mono text-white/60">address, amount</code>
                  </p>
                </div>
              </div>

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
                    <label className="text-white/50 text-xs block mb-1">Stellar Address</label>
                    <input
                      type="text"
                      placeholder="GBA7..."
                      value={manualAddress}
                      onChange={(e) => setManualAddress(e.target.value)}
                      required
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
                      required
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
                    Recipients ({recipients.length})
                  </h3>
                  <button
                    onClick={() => setRecipients([])}
                    className="text-white/40 hover:text-white text-xs"
                  >
                    Clear list
                  </button>
                </div>
                <RecipientsTable data={recipients} />
              </div>

              {/* Step 1 Footer Navigation */}
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <span className="text-white/40 text-xs">Step 1 of 2</span>
                <button
                  onClick={() => setStep(2)}
                  disabled={recipients.length === 0}
                  className={`font-medium rounded-full px-6 py-2.5 text-sm flex items-center gap-1.5 transition-colors ${
                    recipients.length > 0
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
              {!isGenerated ? (
                <>
                  {/* Summary Card */}
                  <div className="liquid-glass rounded-2xl p-6 flex flex-col gap-4">
                    <h3 className="text-white font-medium text-lg">Payout Summary</h3>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-2 border-y border-white/10">
                      <div>
                        <span className="text-white/40 text-xs block">Total Recipients</span>
                        <span className="text-white text-xl font-medium">{recipients.length}</span>
                      </div>
                      <div>
                        <span className="text-white/40 text-xs block">Total Distribution</span>
                        <span className="text-white text-xl font-medium">2,800.00 USDC</span>
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
                      <RecipientsTable data={recipients} />
                    </div>

                    <button
                      onClick={() => setIsGenerated(true)}
                      className="w-full bg-white text-black font-medium rounded-full px-6 py-3 text-sm hover:bg-white/90 transition-colors mt-2"
                    >
                      Generate Claim Links
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
              ) : (
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
                      {recipients.length} gasless payout links are now active and ready for distribution.
                    </p>
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
                      onClick={() => alert('CSV file containing claim URLs exported!')}
                      className="liquid-glass text-white font-medium rounded-full px-6 py-2.5 text-sm hover:bg-white/5 transition-colors flex items-center gap-2"
                    >
                      <Download size={16} strokeWidth={1.5} />
                      <span>Export CSV</span>
                    </button>
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
