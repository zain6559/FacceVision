import React from 'react';
import { Link, useLocation } from 'wouter';
import { useI18n } from '@/lib/i18n';
import { motion } from 'framer-motion';

export default function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { t, language, setLanguage } = useI18n();

  const nav = [
    { href: '/', label: 'nav.recognition', icon: 'SCAN' },
    { href: '/persons', label: 'nav.database', icon: 'DATA' },
    { href: '/intelligence', label: 'nav.intelligence', icon: 'XAI' },
    { href: '/marketplace', label: 'nav.marketplace', icon: 'STORE' },
    { href: '/dataset-studio', label: 'nav.dataset_studio', icon: 'STUDIO' },
    { href: '/projects', label: 'nav.projects', icon: 'PROJ' },
    { href: '/api-keys', label: 'nav.api_keys', icon: 'KEYS' },
    { href: '/monitoring', label: 'nav.monitoring', icon: 'TELE' },
    { href: '/learning', label: 'nav.learning', icon: 'SYNC' },
    { href: '/stats', label: 'nav.stats', icon: 'STAT' },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground font-sans relative overflow-x-hidden selection:bg-cyan-500/30 selection:text-cyan-200">

      {/* Background Radar Animation Layer */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] border border-cyan-500/10 rounded-full pointer-events-none z-0 flex items-center justify-center">
        <div className="w-[650px] h-[650px] border border-cyan-500/10 rounded-full flex items-center justify-center">
          <div className="w-[400px] h-[400px] border border-purple-500/10 rounded-full" />
        </div>
      </div>

      {/* Top Command Bar & HUD Telemetry Ticker */}
      <header className="border-b border-cyan-500/20 bg-background/85 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between border-b border-border/40 text-[10px] font-mono text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>CORE 5.0 :: INSIGHTFACE BUFFALO_L</span>
            </span>
            <span className="hidden sm:inline text-border">|</span>
            <span className="hidden sm:inline text-muted-foreground/80">PGVECTOR HNSW INDEX: ONLINE</span>
            <span className="hidden md:inline text-border">|</span>
            <span className="hidden md:inline text-green-400 font-bold">EER CALIBRATION: OPTIMAL</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Language Toggle */}
            <button
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="px-2.5 py-1 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-all font-mono font-bold tracking-wider"
            >
              {language === 'ar' ? 'ENGLISH [EN]' : 'العربية [AR]'}
            </button>
          </div>
        </div>

        {/* Main Logo & Navigation Menu */}
        <div className="container mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded bg-cyan-500/10 border border-cyan-400/50 flex items-center justify-center font-mono font-black text-cyan-400 group-hover:border-cyan-400 transition-all shadow-[0_0_15px_rgba(0,229,255,0.3)]">
              FI
            </div>
            <div>
              <span className="font-bold text-lg text-foreground tracking-widest font-mono flex items-center gap-2">
                FACE INTELLIGENCE <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">PLATFORM</span>
              </span>
              <p className="text-[10px] text-muted-foreground/70 font-mono">Autonomous Biometric Intelligence & Forensic Ecosystem</p>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="flex flex-wrap items-center gap-1.5">
            {nav.map(item => {
              const isActive = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`font-mono text-xs uppercase tracking-wider transition-all px-3 py-1.5 rounded-sm border relative ${
                    isActive
                      ? 'text-cyan-400 border-cyan-500/80 bg-cyan-500/15 shadow-[0_0_15px_rgba(0,229,255,0.25)]'
                      : 'text-muted-foreground border-transparent hover:border-cyan-500/40 hover:text-cyan-400 hover:bg-cyan-500/5'
                  }`}
                >
                  <span className="opacity-50 me-1.5 text-[10px]">[{item.icon}]</span>
                  {t(item.label)}
                  {isActive && (
                    <motion.div
                      layoutId="activeTabGlow"
                      className="absolute inset-0 rounded-sm border border-cyan-400 pointer-events-none shadow-[0_0_12px_rgba(0,229,255,0.5)]"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 container mx-auto px-4 py-8 z-10">
        {children}
      </main>

      {/* Futuristic Command Footer */}
      <footer className="border-t border-cyan-500/20 bg-background/90 py-4 z-10 text-[11px] font-mono text-muted-foreground">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-2">
          <div>
            <span>FACE INTELLIGENCE PLATFORM &copy; 2026</span>
            <span className="mx-2 text-border">|</span>
            <span className="text-cyan-400/80">INSIGHTFACE CORE ENGINE & COMPREFACE ARCHITECTURE</span>
          </div>
          <div className="flex gap-4">
            <span className="text-muted-foreground/60">ENCRYPTION: AES-256 / SHA-256</span>
            <span className="text-cyan-400 font-bold">STATUS: ALL SYSTEMS NOMINAL</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
