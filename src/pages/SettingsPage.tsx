import { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { Building, Key, Users, RefreshCw, Check, Upload } from 'lucide-react';

export function SettingsPage() {
  const [apiKey, setApiKey] = useState('rr_live_948f2a10c...3819e4');
  const [copiedKey, setCopiedKey] = useState(false);
  const [orgName, setOrgName] = useState('Acme Crypto Org');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const teamMembers = [
    { email: 'alex@acme.com', role: 'Owner' },
    { email: 'sarah@acme.com', role: 'Admin' },
    { email: 'dev@acme.com', role: 'Developer' },
  ];

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setLogoUrl(url);
    }
  };

  const handleRegenerateKey = () => {
    const newKey = `rr_live_${Math.random().toString(36).substring(2, 12)}...${Math.random().toString(36).substring(2, 8)}`;
    setApiKey(newKey);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText('rr_live_948f2a10c71948328103819e4');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 px-6 sm:px-8 border-b border-white/10 flex items-center sticky top-0 bg-[#0a0a0a]/90 backdrop-blur-md z-10">
          <h1 className="text-white font-medium text-lg">Organization Settings</h1>
        </header>

        <main className="p-6 sm:p-8 flex flex-col gap-8 max-w-2xl">
          {/* Section 1: Organization Profile */}
          <div>
            <h2 className="text-white/70 text-sm font-medium mb-3 flex items-center gap-2">
              <Building size={16} strokeWidth={1.5} />
              <span>Organization Profile</span>
            </h2>
            <div className="liquid-glass rounded-2xl p-6 flex flex-col gap-4">
              <div>
                <label className="text-white/50 text-xs block mb-1.5 font-medium">Organization Name</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full liquid-glass rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:ring-1 focus:ring-white/20"
                />
              </div>

              <div>
                <label className="text-white/50 text-xs block mb-1.5 font-medium">Organization Logo</label>
                <div className="flex items-center gap-4">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-12 h-12 rounded-xl object-cover border border-white/10" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl liquid-glass flex items-center justify-center text-white/50 font-medium">
                      {orgName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <label className="liquid-glass rounded-xl px-4 py-2 text-xs text-white/80 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer">
                    <Upload size={14} strokeWidth={1.5} />
                    <span>Upload Logo</span>
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Team Members */}
          <div>
            <h2 className="text-white/70 text-sm font-medium mb-3 flex items-center gap-2">
              <Users size={16} strokeWidth={1.5} />
              <span>Team Members</span>
            </h2>
            <div className="liquid-glass rounded-2xl p-6 flex flex-col gap-3">
              {teamMembers.map((member) => (
                <div
                  key={member.email}
                  className="flex items-center justify-between py-2 border-b border-white/5 last:border-none"
                >
                  <span className="text-white/80 text-sm">{member.email}</span>
                  <span className="liquid-glass rounded-full px-3 py-1 text-xs text-white/60 font-medium">
                    {member.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: API Access */}
          <div>
            <h2 className="text-white/70 text-sm font-medium mb-3 flex items-center gap-2">
              <Key size={16} strokeWidth={1.5} />
              <span>API Access</span>
            </h2>
            <div className="liquid-glass rounded-2xl p-6 flex flex-col gap-4">
              <div>
                <label className="text-white/50 text-xs block mb-1.5 font-medium">Secret API Key</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={apiKey}
                    className="flex-1 liquid-glass rounded-xl px-4 py-2.5 text-white/80 text-sm font-mono outline-none"
                  />
                  <button
                    onClick={handleCopyKey}
                    className="liquid-glass rounded-xl px-3 py-2.5 text-xs text-white/80 hover:text-white transition-colors"
                  >
                    {copiedKey ? <Check size={16} className="text-[#22c55e]" /> : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-white/40 text-xs">Used for programmatic claim link generation</span>
                <button
                  onClick={handleRegenerateKey}
                  className="text-white/50 hover:text-white text-xs flex items-center gap-1 transition-colors"
                >
                  <RefreshCw size={12} />
                  <span>Regenerate Key</span>
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
