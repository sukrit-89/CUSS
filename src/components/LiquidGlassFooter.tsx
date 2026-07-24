import { motion } from 'motion/react';
import { Music2 } from 'lucide-react';

export function LiquidGlassFooter() {
  return (
    <motion.footer
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, delay: 0.4, ease: 'easeOut' }}
      className="liquid-glass w-full rounded-3xl p-6 md:p-10 text-white/70 mt-32 md:mt-64"
    >
      {/* Top 12-column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12 mb-10">
        {/* Brand & Description (md:col-span-5) */}
        <div className="md:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4 text-white">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 256 256"
                fill="currentColor"
              >
                <path d="M 4.688 136 C 68.373 136 120 187.627 120 251.312 C 120 252.883 119.967 254.445 119.905 256 L 0 256 L 0 136.096 C 1.555 136.034 3.117 136 4.688 136 Z M 251.312 136 C 252.883 136 254.445 136.034 256 136.096 L 256 256 L 136.095 256 C 136.032 254.438 136.001 252.875 136 251.312 C 136 187.627 187.627 136 251.312 136 Z M 119.905 0 C 119.967 1.555 120 3.117 120 4.688 C 120 68.373 68.373 120 4.687 120 C 3.117 120 1.555 119.967 0 119.905 L 0 0 Z M 256 119.905 C 254.445 119.967 252.883 120 251.312 120 C 187.627 120 136 68.373 136 4.687 C 136 3.117 136.033 1.555 136.095 0 L 256 0 Z" />
              </svg>
              <span className="text-xl font-medium tracking-tight">LUMINA</span>
            </div>
            <p className="text-sm leading-relaxed max-w-sm text-white/60">
              Lumina provides premium clarity on global events and cosmic wonders - shared with all for free.
            </p>
          </div>
        </div>

        {/* Links Grid (md:col-span-7) */}
        <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-8">
          {/* Discover List */}
          <div>
            <h4 className="text-sm uppercase tracking-wider text-white font-medium mb-4">
              Discover
            </h4>
            <ul className="text-xs space-y-2">
              <li>
                <a href="#labs" className="hover:text-white transition-colors block">
                  Labs & Workshops
                </a>
              </li>
              <li>
                <a href="#deep-dive" className="hover:text-white transition-colors block">
                  Deep Dive Series
                </a>
              </li>
              <li>
                <a href="#global-circle" className="hover:text-white transition-colors block">
                  Global Circle
                </a>
              </li>
              <li>
                <a href="#resource-vault" className="hover:text-white transition-colors block">
                  Resource Vault
                </a>
              </li>
              <li>
                <a href="#roadmap" className="hover:text-white transition-colors block">
                  Future Roadmap
                </a>
              </li>
            </ul>
          </div>

          {/* The Mission List */}
          <div>
            <h4 className="text-sm uppercase tracking-wider text-white font-medium mb-4">
              The Mission
            </h4>
            <ul className="text-xs space-y-2">
              <li>
                <a href="#origin" className="hover:text-white transition-colors block">
                  Origin Story
                </a>
              </li>
              <li>
                <a href="#collective" className="hover:text-white transition-colors block">
                  The Collective
                </a>
              </li>
              <li>
                <a href="#newsroom" className="hover:text-white transition-colors block">
                  Newsroom Hub
                </a>
              </li>
              <li>
                <a href="#team" className="hover:text-white transition-colors block">
                  Join the Team
                </a>
              </li>
            </ul>
          </div>

          {/* Concierge List */}
          <div>
            <h4 className="text-sm uppercase tracking-wider text-white font-medium mb-4">
              Concierge
            </h4>
            <ul className="text-xs space-y-2">
              <li>
                <a href="#touch" className="hover:text-white transition-colors block">
                  Get in Touch
                </a>
              </li>
              <li>
                <a href="#privacy" className="hover:text-white transition-colors block">
                  Legal Privacy
                </a>
              </li>
              <li>
                <a href="#agreement" className="hover:text-white transition-colors block">
                  User Agreement
                </a>
              </li>
              <li>
                <a href="#concern" className="hover:text-white transition-colors block">
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

        <div className="flex items-center gap-4">
          <span className="text-[10px] uppercase tracking-widest opacity-50">
            Join the Journey:
          </span>
          <div className="flex items-center gap-3">
            <a
              href="#music"
              className="opacity-70 hover:opacity-100 transition-colors hover:text-white"
              aria-label="Music"
            >
              <Music2 size={16} />
            </a>
            <a
              href="#facebook"
              className="opacity-70 hover:opacity-100 transition-colors hover:text-white"
              aria-label="Facebook"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
            </a>
            <a
              href="#twitter"
              className="opacity-70 hover:opacity-100 transition-colors hover:text-white"
              aria-label="Twitter"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path></svg>
            </a>
            <a
              href="#youtube"
              className="opacity-70 hover:opacity-100 transition-colors hover:text-white"
              aria-label="YouTube"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.56 49.56 0 0 1-16.2 0A2 2 0 0 1 2.5 17"></path><path d="m10 15 5-3-5-3z"></path></svg>
            </a>
            <a
              href="#instagram"
              className="opacity-70 hover:opacity-100 transition-colors hover:text-white"
              aria-label="Instagram"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"></line></svg>
            </a>
          </div>
        </div>
      </div>
    </motion.footer>
  );
}
