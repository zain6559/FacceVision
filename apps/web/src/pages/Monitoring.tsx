import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/lib/i18n';
import AdaptiveAgentPanel from '../components/dashboard/AdaptiveAgentPanel';

interface FeedItem {
  id: string;
  name: string;
  source: string;
  confidence: number;
  time: string;
}

export default function Monitoring() {
  const { t } = useI18n();

  // Ingestion active/throttle states
  const [cdnActive, setCdnActive] = useState(true);
  const [waybackActive, setWaybackActive] = useState(true);
  const [searchActive, setSearchActive] = useState(true);
  const [throttle, setThrottle] = useState(75);

  // Streaming state simulation
  const [ingestedCount, setIngestedCount] = useState(14820);
  const [ingestionRate, setIngestedRate] = useState(4.2);
  const [liveFeed, setLiveFeed] = useState<FeedItem[]>([
    { id: 'f1', name: 'Dr. Sarah Al-Farsi', source: 'Reuters OpenGraph CDN', confidence: 0.942, time: '14:20:12' },
    { id: 'f2', name: 'Marcus Sterling', source: 'Wayback Breach Archives', confidence: 0.887, time: '14:20:05' },
    { id: 'f3', name: 'Yuki Tanaka', source: 'Google Search Aggregator', confidence: 0.912, time: '14:19:54' },
  ]);

  // Handle live streaming tick (simulation of background workers)
  useEffect(() => {
    const timer = setInterval(() => {
      if (!cdnActive && !waybackActive && !searchActive) {
        setIngestedRate(0);
        return;
      }

      const activeCount = [cdnActive, waybackActive, searchActive].filter(Boolean).length;
      const rate = parseFloat(((activeCount * 1.5) * (throttle / 100)).toFixed(1));
      setIngestedRate(rate);

      if (rate > 0) {
        setIngestedCount(prev => prev + Math.floor(rate));

        const names = ["Ahmad Al-Mansouri", "Clara Oswald", "David Tennant", "Lina Wertmuller", "Viktor Reznov", "Salma Khoury"];
        const sources = ["WP Uploads CDN", "Internet Archive CDX", "Bing Image Engine", "Yandex Demographic Index"];

        const randomName = names[Math.floor(Math.random() * names.length)];
        const randomSource = sources[Math.floor(Math.random() * sources.length)];
        const randomConf = parseFloat((0.80 + Math.random() * 0.19).toFixed(3));
        const nowStr = new Date().toTimeString().split(' ')[0];

        setLiveFeed(prev => [
          { id: Math.random().toString(), name: randomName, source: randomSource, confidence: randomConf, time: nowStr },
          ...prev.slice(0, 7)
        ]);
      }
    }, 2500);

    return () => clearInterval(timer);
  }, [cdnActive, waybackActive, searchActive, throttle]);

  // Fetch System Health Telemetry
  const { data: health } = useQuery({
    queryKey: ['healthTelemetry'],
    queryFn: async () => {
      const res = await fetch('/api/enterprise/monitoring/health');
      if (!res.ok) throw new Error('Failed to fetch health metrics');
      return res.json();
    },
    refetchInterval: 5000,
  });

  // Fetch Audit Trail Logs
  const { data: auditLogs = [] } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: async () => {
      const res = await fetch('/api/enterprise/audit-logs');
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      return res.json();
    },
    refetchInterval: 10000,
  });

  return (
    <div className="space-y-6 font-mono text-slate-100">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <h1 className="text-2xl font-bold uppercase tracking-widest text-cyan-400">
            SYSTEM INGESTION & HEAVY MONITORING
          </h1>
        </div>
        <p className="text-muted-foreground text-xs ms-5 uppercase">// Continuous automated face harvesting & CDX workers controller</p>
      </div>

      {/* STAGE 1: Real-Time Streaming Telemetry */}
      <div className="grid sm:grid-cols-4 gap-4">
        <Card className="border-cyan-500/20 bg-slate-950/60 backdrop-blur-md">
          <CardContent className="pt-4">
            <div className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold">// VECTOR KNOWLEDGE BASE</div>
            <div className="text-3xl font-extrabold text-white mt-1">
              {ingestedCount.toLocaleString()} <span className="text-xs font-normal text-slate-400">Faces</span>
            </div>
            <p className="text-[9px] text-muted-foreground mt-1 uppercase">Standardized 576-dim Vector index</p>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-slate-950/60 backdrop-blur-md">
          <CardContent className="pt-4">
            <div className="text-[10px] text-green-400 uppercase tracking-widest font-bold">// LIVE INGESTION RATE</div>
            <div className="text-3xl font-extrabold text-green-400 mt-1">
              {ingestionRate} <span className="text-xs font-normal text-slate-400">Faces/Sec</span>
            </div>
            <div className="w-full bg-slate-900 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-green-400 h-full transition-all duration-500"
                style={{ width: `${(ingestionRate / 6.0) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-slate-950/60 backdrop-blur-md">
          <CardContent className="pt-4">
            <div className="text-[10px] text-amber-400 uppercase tracking-widest font-bold">// HEAP MEMORY POOL</div>
            <div className="text-3xl font-extrabold text-amber-400 mt-1">
              {health?.memoryUsage?.heapUsedMb || '142.8'} <span className="text-xs font-normal text-slate-400">MB</span>
            </div>
            <p className="text-[9px] text-muted-foreground mt-1 uppercase">Total heap: {health?.memoryUsage?.heapTotalMb || '180.5'} MB</p>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-slate-950/60 backdrop-blur-md">
          <CardContent className="pt-4">
            <div className="text-[10px] text-purple-400 uppercase tracking-widest font-bold">// SYSTEM HEURISTICS</div>
            <div className="text-3xl font-extrabold text-purple-400 mt-1">ONLINE</div>
            <p className="text-[9px] text-muted-foreground mt-1 uppercase">Uptime: {health?.uptimeSeconds || 284} seconds</p>
          </CardContent>
        </Card>
      </div>

      {/* STAGE 2: Adaptive Browser Agent Settings & Social CRUD */}
      <AdaptiveAgentPanel />

      {/* STAGE 3: Controls and Live Feed */}
      <div className="grid md:grid-cols-12 gap-6">
        {/* LEFT: Controls & Source Distribution (5 cols) */}
        <div className="md:col-span-5 space-y-6">
          {/* Active Job Controls */}
          <Card className="border-cyan-500/20 bg-slate-950/40 backdrop-blur-md">
            <CardHeader className="pb-2 border-b border-cyan-500/10">
              <CardTitle className="text-xs uppercase text-cyan-400 tracking-wider">// ACTIVE WORKERS CONTROLLER</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 uppercase">Image-CDN Scraper</span>
                <button
                  onClick={() => setCdnActive(!cdnActive)}
                  className={`text-[10px] font-bold px-3 py-1 rounded transition border ${cdnActive ? 'bg-cyan-500/10 border-cyan-400 text-cyan-400' : 'bg-slate-900 border-slate-700 text-slate-500'}`}
                >
                  {cdnActive ? 'RUNNING' : 'PAUSED'}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 uppercase">Wayback Breach Ingest</span>
                <button
                  onClick={() => setWaybackActive(!waybackActive)}
                  className={`text-[10px] font-bold px-3 py-1 rounded transition border ${waybackActive ? 'bg-cyan-500/10 border-cyan-400 text-cyan-400' : 'bg-slate-900 border-slate-700 text-slate-500'}`}
                >
                  {waybackActive ? 'RUNNING' : 'PAUSED'}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 uppercase">Search Aggregator</span>
                <button
                  onClick={() => setSearchActive(!searchActive)}
                  className={`text-[10px] font-bold px-3 py-1 rounded transition border ${searchActive ? 'bg-cyan-500/10 border-cyan-400 text-cyan-400' : 'bg-slate-900 border-slate-700 text-slate-500'}`}
                >
                  {searchActive ? 'RUNNING' : 'PAUSED'}
                </button>
              </div>

              <div className="border-t border-cyan-500/10 pt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400 uppercase">Ingestion Throttle Rate</span>
                  <span className="text-cyan-400 font-bold">{throttle}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={throttle}
                  onChange={(e) => setThrottle(Number(e.target.value))}
                  className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>
            </CardContent>
          </Card>

          {/* Source Distribution Chart (HTML Simulation) */}
          <Card className="border-cyan-500/20 bg-slate-950/40 backdrop-blur-md">
            <CardHeader className="pb-2 border-b border-cyan-500/10">
              <CardTitle className="text-xs uppercase text-cyan-400 tracking-wider">// HARVESTING SOURCE SPREAD</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-300 uppercase">WordPress & Image CDNs</span>
                  <span className="text-cyan-400">45%</span>
                </div>
                <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                  <div className="bg-cyan-400 h-full" style={{ width: '45%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-300 uppercase">Wayback & CDX Archives</span>
                  <span className="text-amber-400">35%</span>
                </div>
                <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full" style={{ width: '35%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-300 uppercase">Google/Yandex Search Workers</span>
                  <span className="text-purple-400">20%</span>
                </div>
                <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                  <div className="bg-purple-400 h-full" style={{ width: '20%' }} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Live Ingestion Feed Log (7 cols) */}
        <div className="md:col-span-7">
          <Card className="border-cyan-500/20 bg-slate-950/40 backdrop-blur-md h-full flex flex-col">
            <CardHeader className="pb-2 border-b border-cyan-500/10">
              <CardTitle className="text-xs uppercase text-green-400 tracking-wider flex items-center justify-between">
                <span>// LIVE INGESTION STREAMING FEED</span>
                <span className="text-[9px] text-slate-400 font-mono">Auto refreshing</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 flex-1 overflow-y-auto max-h-[380px] space-y-2.5">
              {liveFeed.map(item => (
                <div key={item.id} className="p-2.5 bg-slate-900/40 border border-slate-800 rounded flex justify-between items-center text-xs">
                  <div>
                    <div className="font-bold text-slate-100">{item.name}</div>
                    <div className="text-[10px] text-cyan-400/80 mt-0.5 uppercase tracking-wide">Source: {item.source}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-green-400 font-bold">{(item.confidence * 100).toFixed(1)}% Match</span>
                    <div className="text-[9px] text-slate-500 font-mono mt-0.5">{item.time}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Audit Trail Section */}
      <Card className="border-primary/20 bg-slate-950/30 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-xs uppercase text-slate-400 tracking-wider">// SECURITY AUDIT TRAIL</CardTitle>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <div className="text-xs text-muted-foreground/50 py-4 text-center uppercase">{t('monitoring.no_events')}</div>
          ) : (
            <div className="space-y-2">
              {auditLogs.slice(0, 5).map((log: any) => (
                <div key={log.id} className="flex justify-between items-center p-2.5 border border-border/40 bg-background/40 text-xs">
                  <div className="flex items-center gap-3">
                    <Badge variant={log.status === 'SUCCESS' ? 'default' : 'danger'} className="text-[9px]">
                      {log.status}
                    </Badge>
                    <span className="font-bold text-primary">{log.action}</span>
                    <span className="text-muted-foreground">{log.resource}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
