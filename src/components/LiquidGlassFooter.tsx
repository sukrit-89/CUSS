import { motion } from 'motion/react';
import { Music2, Infinity as InfinityIcon } from 'lucide-react';

export function LiquidGlassFooter() {
  return (
    <motion.footer
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
      className="liquid-glass w-full rounded-3xl p-6 md:p-10 text-white/70 mt-32 md:mt-64"
    >
      {/* Top 12-column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12 mb-10">
        {/* First Column - Brand & Description */}
        <div className="md:col-span-5 flex flex-col gap-4">
          <div className="flex items-center gap-3 text-white font-medium text-xl">
            <InfinityIcon size={24} strokeWidth={1.5} />
            <span className="tracking-wide">ReRail</span>
          </div>
          <p className="text-sm leading-relaxed max-w-sm text-white/60">
            ReRail provides gasless USDC payout infrastructure on Stellar — empowering organizations to distribute grants, prizes, and bounties with zero recipient gas friction.
          </p>
        </div>

        {/* Second Column (7 Spans) - Links Section (3-Column Grid) */}
        <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-8 md:gap-6">
          {/* Discover */}
          <div>
            <h4 className="text-sm uppercase tracking-wider text-white font-medium mb-4">
              Discover
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#labs" className="hover:text-white transition-colors">
                  Labs & Workshops
                </a>
              </li>
              <li>
                <a href="#deep-dive" className="hover:text-white transition-colors">
                  Deep Dive Series
                </a>
              </li>
              <li>
                <a href="#circle" className="hover:text-white transition-colors">
                  Global Circle
                </a>
              </li>
              <li>
                <a href="#vault" className="hover:text-white transition-colors">
                  Resource Vault
                </a>
              </li>
              <li>
                <a href="#roadmap" className="hover:text-white transition-colors">
                  Future Roadmap
                </a>
              </li>
            </ul>
          </div>

          {/* The Mission */}
          <div>
            <h4 className="text-sm uppercase tracking-wider text-white font-medium mb-4">
              The Mission
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#origin" className="hover:text-white transition-colors">
                  Origin Story
                </a>
              </li>
              <li>
                <a href="#collective" className="hover:text-white transition-colors">
                  The Collective
                </a>
              </li>
              <li>
                <a href="#newsroom" className="hover:text-white transition-colors">
                  Newsroom Hub
                </a>
              </li>
              <li>
                <a href="#team" className="hover:text-white transition-colors">
                  Join the Team
                </a>
              </li>
            </ul>
          </div>

          {/* Concierge */}
          <div>
            <h4 className="text-sm uppercase tracking-wider text-white font-medium mb-4">
              Concierge
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#touch" className="hover:text-white transition-colors">
                  Get in Touch
                </a>
              </li>
              <li>
                <a href="#privacy" className="hover:text-white transition-colors">
                  Legal Privacy
                </a>
              </li>
              <li>
                <a href="#agreement" className="hover:text-white transition-colors">
                  User Agreement
                </a>
              </li>
              <li>
                <a href="#concern" className="hover:text-white transition-colors">
                  Report Concern
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-4">
        <p className="text-[10px] uppercase tracking-widest opacity-50">
          Curated by @GotInGeorgiG
        </p>

        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-widest opacity-50">
            Join the Journey:
          </span>
          <div className="flex items-center gap-3">
            <a
              href="#music"
              aria-label="Music"
              className="opacity-70 hover:opacity-100 transition-colors hover:text-white"
            >
              <Music2 size={16} />
            </a>
            <a
              href="#facebook"
              aria-label="Facebook"
              className="opacity-70 hover:opacity-100 transition-colors hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
            </a>
            <a
              href="#twitter"
              aria-label="Twitter"
              className="opacity-70 hover:opacity-100 transition-colors hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
              </svg>
            </a>
            <a
              href="#youtube"
              aria-label="Youtube"
              className="opacity-70 hover:opacity-100 transition-colors hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
                <path d="m10 15 5-3-5-3z" />
              </svg>
            </a>
            <a
              href="#instagram"
              aria-label="Instagram"
              className="opacity-70 hover:opacity-100 transition-colors hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </motion.footer>
  );
}
