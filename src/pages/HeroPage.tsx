import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  Infinity,
  Menu,
  X,
  ArrowRight,
  Zap,
  Link as LinkIcon,
  ShieldCheck,
} from 'lucide-react';

const BG_VIDEO = '/lv_0_20260723125159.mp4';

const navLinks = [
  { label: 'Home', active: true, path: '/' },
  { label: 'Features', dropdown: true, path: '#features' },
  { label: 'Claim Demo', path: '/claim/demo' },
  { label: 'Dashboard', path: '/dashboard' },
];

export function HeroPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* ---------------------------------------------------- */}
      {/* HERO SECTION WITH VIDEO BACKGROUND                   */}
      {/* ---------------------------------------------------- */}
      <section className="relative w-full h-screen overflow-hidden bg-[#0a0a0a] flex flex-col justify-between">
        {/* Background Video */}
        <video
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          src={BG_VIDEO}
        />

        {/* Dark overlay for contrast */}
        <div className="absolute inset-0 bg-black/25 pointer-events-none" />

        {/* Navbar */}
        <nav className="relative z-20 w-full max-w-7xl mx-auto px-6 sm:px-12 py-5 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 text-white font-medium text-base">
            <Infinity size={22} strokeWidth={1.5} />
            <span>ReRail</span>
          </Link>

          {/* Desktop Nav Pill */}
          <div className="hidden md:flex liquid-glass items-center gap-1 rounded-xl px-2 py-2">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.path}
                className={`flex items-center gap-0.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  link.active
                    ? 'bg-white/15 text-white'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                <span>{link.label}</span>
                {link.dropdown && <ChevronDown size={13} strokeWidth={1.5} className="mt-px" />}
              </a>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className="liquid-glass text-white text-sm font-medium px-4 py-2.5 rounded-full hover:bg-white/5 transition-colors"
            >
              Log in
            </Link>
            <Link
              to="/dashboard"
              className="bg-white text-black text-sm font-medium px-4 py-2.5 rounded-full hover:bg-white/90 transition-colors flex items-center gap-1.5"
            >
              <span>Begin Now</span>
              <ArrowRight size={14} strokeWidth={1.5} />
            </Link>
          </div>

          {/* Mobile Toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden liquid-glass text-white p-2 rounded-lg"
            aria-label="Toggle navigation menu"
          >
            {menuOpen ? <X size={18} strokeWidth={1.5} /> : <Menu size={18} strokeWidth={1.5} />}
          </button>
        </nav>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="absolute top-[72px] left-6 right-6 z-30 md:hidden liquid-glass rounded-2xl p-4 flex flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.path}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center justify-between w-full px-4 py-3 rounded-lg text-sm transition-colors ${
                  link.active
                    ? 'bg-white/15 text-white'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                <span>{link.label}</span>
                {link.dropdown && <ChevronDown size={13} strokeWidth={1.5} className="mt-px" />}
              </a>
            ))}
            <div className="flex gap-2 mt-2 pt-3 border-t border-white/10">
              <Link
                to="/login"
                className="flex-1 text-center liquid-glass text-white text-sm font-medium px-4 py-2.5 rounded-full hover:bg-white/5 transition-colors"
              >
                Log in
              </Link>
              <Link
                to="/dashboard"
                className="flex-1 text-center bg-white text-black text-sm font-medium px-4 py-2.5 rounded-full hover:bg-white/90 transition-colors"
              >
                Begin Now
              </Link>
            </div>
          </div>
        )}

        {/* Hero Content (bottom-left) */}
        <div className="relative z-20 w-full max-w-7xl mx-auto px-6 sm:px-12 pb-10 sm:pb-16 mt-auto">
          <div className="max-w-2xl">
            <h1 className="text-white text-4xl sm:text-5xl lg:text-6xl font-medium leading-tight tracking-tight mb-4">
              Gasless USDC Payouts on Stellar.
            </h1>
            <p className="text-white/60 text-sm leading-relaxed mb-7 max-w-md">
              Take charge of bulk payouts with zero gas friction for your recipients—create claim links, automate distribution, and track live payouts across your organization.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/payouts/new"
                className="bg-white text-black text-sm sm:text-base font-medium px-6 sm:px-7 py-3 rounded-full hover:bg-white/90 transition-colors flex items-center gap-2"
              >
                <span>Start Today</span>
                <ArrowRight size={16} strokeWidth={1.5} />
              </Link>
              <Link
                to="/claim/demo"
                className="liquid-glass text-white text-sm sm:text-base font-medium px-6 sm:px-7 py-3 rounded-full hover:bg-white/5 transition-colors"
              >
                Claim Demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* 01 — TRUST / STAT BAND                               */}
      {/* ---------------------------------------------------- */}
      <section className="bg-[#0a0a0a] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 py-20">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-white text-3xl sm:text-4xl font-medium tracking-tight">
                Gasless
              </div>
              <div className="text-white/40 text-xs uppercase tracking-wide mt-2">
                Every claim
              </div>
            </div>

            <div>
              <div className="text-white text-3xl sm:text-4xl font-medium tracking-tight">
                0 XLM
              </div>
              <div className="text-white/40 text-xs uppercase tracking-wide mt-2">
                Required from recipients
              </div>
            </div>

            <div>
              <div className="text-white text-3xl sm:text-4xl font-medium tracking-tight">
                10,000+
              </div>
              <div className="text-white/40 text-xs uppercase tracking-wide mt-2">
                Testnet claims processed
              </div>
            </div>

            <div>
              <div className="text-white text-3xl sm:text-4xl font-medium tracking-tight">
                &lt; 1 min
              </div>
              <div className="text-white/40 text-xs uppercase tracking-wide mt-2">
                Avg. claim time
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* 02 — FEATURES GRID                                   */}
      {/* ---------------------------------------------------- */}
      <section id="features" className="bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 py-20 sm:py-28">
          {/* Section Header */}
          <div className="max-w-lg mb-12">
            <span className="text-white/40 text-xs uppercase tracking-wide block mb-3 font-medium">
              Why ReRail
            </span>
            <h2 className="text-white text-3xl sm:text-4xl font-medium tracking-tight mb-4">
              Payouts without the friction
            </h2>
            <p className="text-white/60 text-sm leading-relaxed max-w-md">
              Deliver USDC directly to anyone without requiring them to set up or fund a wallet upfront.
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="liquid-glass rounded-2xl p-6 flex flex-col">
              <div className="w-10 h-10 liquid-glass rounded-lg flex items-center justify-center text-white/80 mb-4">
                <Zap size={22} strokeWidth={1.5} />
              </div>
              <h3 className="text-white text-base font-medium mb-2">
                Gasless claims
              </h3>
              <p className="text-white/50 text-sm leading-relaxed">
                Recipients never need XLM to receive funds or establish trustlines on Stellar.
              </p>
            </div>

            {/* Card 2 */}
            <div className="liquid-glass rounded-2xl p-6 flex flex-col">
              <div className="w-10 h-10 liquid-glass rounded-lg flex items-center justify-center text-white/80 mb-4">
                <LinkIcon size={22} strokeWidth={1.5} />
              </div>
              <h3 className="text-white text-base font-medium mb-2">
                Shareable claim links
              </h3>
              <p className="text-white/50 text-sm leading-relaxed">
                Distribute one-time secure claim links via email, messaging apps, or bulk CSV exports.
              </p>
            </div>

            {/* Card 3 */}
            <div className="liquid-glass rounded-2xl p-6 flex flex-col">
              <div className="w-10 h-10 liquid-glass rounded-lg flex items-center justify-center text-white/80 mb-4">
                <ShieldCheck size={22} strokeWidth={1.5} />
              </div>
              <h3 className="text-white text-base font-medium mb-2">
                Fee-bump secured
              </h3>
              <p className="text-white/50 text-sm leading-relaxed">
                Built natively on Stellar Claimable Balances with automated protocol fee sponsorship.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* 03 — HOW IT WORKS (NUMBERED STEPS)                    */}
      {/* ---------------------------------------------------- */}
      <section className="bg-[#0a0a0a] border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 py-20 sm:py-28">
          {/* Section Header */}
          <div className="max-w-lg mb-12">
            <span className="text-white/40 text-xs uppercase tracking-wide block mb-3 font-medium">
              How it works
            </span>
            <h2 className="text-white text-3xl sm:text-4xl font-medium tracking-tight mb-4">
              Three steps to effortless payouts
            </h2>
            <p className="text-white/60 text-sm leading-relaxed max-w-md">
              Automate distribution and eliminate blockchain onboarding barriers for all your recipients.
            </p>
          </div>

          {/* Steps Row */}
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Step 1 */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 liquid-glass rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0">
                  01
                </div>
                <div className="hidden sm:block border-t border-white/10 flex-1 ml-4 mr-2" />
              </div>
              <h3 className="text-white text-base font-medium mb-2">
                Create a payout
              </h3>
              <p className="text-white/50 text-sm leading-relaxed max-w-xs">
                Upload recipients and amounts in bulk via CSV or add them manually in seconds.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 liquid-glass rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0">
                  02
                </div>
                <div className="hidden sm:block border-t border-white/10 flex-1 ml-4 mr-2" />
              </div>
              <h3 className="text-white text-base font-medium mb-2">
                Links go out
              </h3>
              <p className="text-white/50 text-sm leading-relaxed max-w-xs">
                Each recipient gets a unique, secure claim link to collect their designated USDC.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 liquid-glass rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0">
                  03
                </div>
              </div>
              <h3 className="text-white text-base font-medium mb-2">
                They claim instantly
              </h3>
              <p className="text-white/50 text-sm leading-relaxed max-w-xs">
                No wallet funding, zero gas fees, and no waiting around—instant settlement on Stellar.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* 04 — FINAL CTA BAND                                  */}
      {/* ---------------------------------------------------- */}
      <section className="bg-[#0a0a0a] border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 py-20 sm:py-28">
          <div className="max-w-xl mx-auto text-center flex flex-col items-center">
            <h2 className="text-white text-3xl sm:text-4xl font-medium tracking-tight mb-4">
              Ready to send your first payout?
            </h2>
            <p className="text-white/60 text-sm mb-8 max-w-md">
              Experience gasless crypto distribution built for modern teams and global web3 workforces.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                to="/payouts/new"
                className="bg-white text-black rounded-full px-7 py-3 font-medium text-sm hover:bg-white/90 transition-colors"
              >
                Start Today
              </Link>
              <Link
                to="/claim/demo"
                className="liquid-glass text-white rounded-full px-7 py-3 font-medium text-sm hover:bg-white/5 transition-colors"
              >
                Claim Demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* 05 — FOOTER                                          */}
      {/* ---------------------------------------------------- */}
      <footer className="bg-[#0a0a0a] border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Left */}
          <div className="flex items-center gap-2">
            <Infinity size={18} strokeWidth={1.5} className="text-white/80" />
            <span className="text-white/60 text-sm font-medium">ReRail</span>
            <span className="text-white/30 text-xs ml-2">© 2026</span>
          </div>

          {/* Right */}
          <div className="flex items-center gap-6 text-sm">
            <a href="#features" className="text-white/40 hover:text-white transition-colors">
              Docs
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 hover:text-white transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 hover:text-white transition-colors"
            >
              Twitter
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
