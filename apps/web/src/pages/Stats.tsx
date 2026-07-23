import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import {
  useGetStatsOverview, useGetAccuracyMetrics, useGetDatabaseGrowth, useListRecognitionLogs,
} from '@workspace/api-client-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  ReferenceLine, Cell, Legend,
} from 'recharts';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useQueryClient } from '@tanstack/react-query';

const TT = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--primary))',
  color: 'hsl(var(--foreground))',
  fontFamily: 'var(--font-mono)',
  fontSize: '11px',
  boxShadow: '0 0 10px rgba(0,229,255,0.2)',
};

function MetricRow({ label, value, sub, highlight = false, warn = false }: {
  label: string; value: string | number; sub?: string; highlight?: boolean; warn?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center py-2.5 border-b border-border/30 last:border-0 ${highlight ? 'bg-primary/5 px-2 -mx-2 rounded' : ''}`}>
      <div>
        <span className="font-mono text-sm text-muted-foreground">{label}</span>
        {sub && <div className="text-[9px] text-muted-foreground/50 font-mono italic">{sub}</div>}
      </div>
      <span className={`font-mono font-bold ${warn ? 'text-red-400' : highlight ? 'text-primary' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}

function DPrimeGauge({ value }: { value: number }) {
  // d' interpretation: <1 poor, 1-2 fair, 2-3 good, >3 excellent
  const safeVal = typeof value === 'number' && !isNaN(value) ? value : 0;
  const clamped = Math.max(0, Math.min(4, safeVal));
  const pct = (clamped / 4) * 100;
  const color = safeVal < 1 ? '#f87171' : safeVal < 2 ? '#fbbf24' : safeVal < 3 ? '#34d399' : '#00e5ff';
  const label = safeVal < 1 ? 'POOR' : safeVal < 2 ? 'FAIR' : safeVal < 3 ? 'GOOD' : 'EXCELLENT';
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center font-mono text-xs">
        <span className="text-muted-foreground">d′ separability</span>
        <span style={{ color }} className="font-bold">{safeVal.toFixed(3)} — {label}</span>
      </div>
      <div className="h-3 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </div>
      <div className="flex justify-between text-[8px] font-mono text-muted-foreground/40">
        <span>0 (chance)</span><span>1 (fair)</span><span>2 (good)</span><span>3 (great)</span><span>4+</span>
      </div>
    </div>
  );
}

export default function Stats() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data: overview, refetch: refetchOverview }      = useGetStatsOverview();
  const { data: accuracy, refetch: refetchAccuracy }      = useGetAccuracyMetrics() as { data: any; refetch: any };
  const { data: growth,   refetch: refetchGrowth }        = useGetDatabaseGrowth();
  const { data: logs,     refetch: refetchLogs }          = useListRecognitionLogs({ limit: 10 });

  // Auto-refresh every 10s so stats stay live
  useEffect(() => {
    const id = setInterval(() => {
      refetchOverview();
      refetchAccuracy();
      refetchGrowth();
      refetchLogs();
    }, 10000);
    return () => clearInterval(id);
  }, [refetchOverview, refetchAccuracy, refetchGrowth, refetchLogs]);

  const growthData = growth?.map((d: any) => ({ ...d, date: d.date?.slice(5) })) ?? [];
  const distData   = (accuracy as any)?.confidenceDistribution ?? [];
  const rocData    = (accuracy as any)?.rocData ?? [];
  const dPrime     = (accuracy as any)?.dPrime ?? 0;
  const eerThreshold = (accuracy as any)?.eerThreshold ?? 0;
  const eer        = (accuracy as any)?.eer ?? 0;

  const fmt = (v?: number, pct = true) =>
    v != null ? (pct ? (v * 100).toFixed(2) + '%' : v.toFixed(4)) : '—';

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-mono font-bold text-primary uppercase tracking-widest">{t('stats.title')}</h1>
        <p className="text-muted-foreground font-mono text-sm">{t('stats.subtitle')}</p>
      </div>

      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t('stats.total_persons')}    value={overview?.totalPersons ?? 0}
          trend={`+${overview?.facesLearnedToday ?? 0} today`} />
        <StatCard title={t('stats.total_embeddings')} value={overview?.totalFaceEmbeddings ?? 0} />
        <StatCard title={t('stats.recognition_rate')} value={fmt(overview?.recognitionRate)} />
        <StatCard title={t('stats.avg_confidence')}   value={fmt(overview?.avgConfidence)} />
      </div>

      {/* ── Growth + Accuracy ────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('stats.growth')}</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradEmb" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00e5ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00e5ff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradPers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <RechartsTooltip contentStyle={TT} />
                <Area type="monotone" dataKey="embeddingsCount" name="Embeddings" stroke="#00e5ff" fill="url(#gradEmb)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="personsCount"    name="Persons"    stroke="#a78bfa" fill="url(#gradPers)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="recognitionsCount" name="Queries"  stroke="#34d399" fill="none" strokeWidth={1} strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('stats.accuracy')}</CardTitle>
            <p className="text-[9px] text-muted-foreground font-mono">
              Computed from intra/inter-class similarity distributions · τ=0.52
            </p>
          </CardHeader>
          <CardContent className="space-y-1">
            <MetricRow label="Precision"    value={fmt(accuracy?.precision)}          highlight />
            <MetricRow label="Recall (TAR)" value={fmt(accuracy?.recall)}             highlight />
            <MetricRow label="F₁ Score"     value={fmt(accuracy?.f1Score)}            highlight />
            <MetricRow label="FAR (FPR)"    value={fmt(accuracy?.falsePositiveRate)}  warn={accuracy?.falsePositiveRate > 0.1}
              sub="False Accept Rate" />
            <MetricRow label="EER"
              value={accuracy?.eerThreshold != null ? `${(accuracy.eerThreshold * 100).toFixed(1)}% @ FAR=${(eer*100).toFixed(1)}%` : '—'}
              sub="Equal Error Rate operating point" />
            <MetricRow label="Operating τ"
              value={accuracy?.operatingThreshold != null ? (accuracy.operatingThreshold * 100).toFixed(0) + '%' : '—'}
              sub="Current decision threshold" />

            <div className="grid grid-cols-2 gap-2 pt-2 text-[10px] font-mono text-muted-foreground">
              {[
                ['TP', accuracy?.truePositives,  'text-green-400'],
                ['FP', accuracy?.falsePositives, 'text-red-400'],
                ['FN', accuracy?.falseNegatives, 'text-red-400'],
                ['TN', accuracy?.trueNegatives,  'text-green-400'],
              ].map(([label, val, color]) => (
                <div key={label as string} className="p-2 border border-border/30 text-center">
                  <div className={`font-bold ${color}`}>{val ?? '—'}</div>
                  <div>{label}</div>
                </div>
              ))}
            </div>

            <div className="pt-2 text-[9px] font-mono text-muted-foreground/50 border-t border-border/30">
              {accuracy?.evaluatedPairs
                ? `${accuracy.evaluatedPairs.intra} intra pairs · ${accuracy.evaluatedPairs.inter} inter pairs`
                : 'Enroll ≥2 persons to compute metrics'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── d-prime + Similarity bars ─────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Separability — d′ (d-prime)</CardTitle>
            <p className="text-[9px] text-muted-foreground font-mono">
              d′ = (μ_intra − μ_inter) / √(½·(σ²_intra + σ²_inter)) · Signal Detection Theory
            </p>
          </CardHeader>
          <CardContent className="space-y-5 pt-2">
            {dPrime !== 0 ? (
              <>
                <DPrimeGauge value={dPrime} />

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-green-400">Intra-class (genuine pairs)</span>
                      <span className="text-green-400">
                        μ={((accuracy?.intraClassMean ?? 0)*100).toFixed(1)}% σ={((accuracy?.intraClassStd ?? 0)*100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 bg-white/5 rounded overflow-hidden">
                      <motion.div className="h-full bg-green-400 rounded"
                        initial={{ width: 0 }} animate={{ width: `${(accuracy?.intraClassMean ?? 0)*100}%` }}
                        transition={{ duration: 0.8 }} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-red-400">Inter-class (impostor pairs)</span>
                      <span className="text-red-400">
                        μ={((accuracy?.interClassMean ?? 0)*100).toFixed(1)}% σ={((accuracy?.interClassStd ?? 0)*100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 bg-white/5 rounded overflow-hidden">
                      <motion.div className="h-full bg-red-400 rounded"
                        initial={{ width: 0 }} animate={{ width: `${(accuracy?.interClassMean ?? 0)*100}%` }}
                        transition={{ duration: 0.8, delay: 0.1 }} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-primary">Operating threshold τ</span>
                      <span className="text-primary">{((accuracy?.operatingThreshold ?? 0.52)*100).toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded overflow-hidden">
                      <div className="h-full bg-primary rounded" style={{ width: `${(accuracy?.operatingThreshold ?? 0.52)*100}%` }} />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-muted-foreground font-mono text-xs py-8 opacity-50">
                Enroll multiple faces per person to compute d′
              </div>
            )}
          </CardContent>
        </Card>

        {/* ROC Curve */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">ROC Curve — TAR vs FAR</CardTitle>
            <p className="text-[9px] text-muted-foreground font-mono">
              Receiver Operating Characteristic · EER = {eerThreshold > 0 ? (eerThreshold*100).toFixed(1)+'%' : '—'}
            </p>
          </CardHeader>
          <CardContent className="h-[240px]">
            {rocData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rocData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="far" name="FAR" stroke="hsl(var(--muted-foreground))" fontSize={9}
                    tickFormatter={v => `${(v*100).toFixed(0)}%`} tickLine={false} axisLine={false} label={{ value: 'FAR', position: 'insideBottom', offset: -2, fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={9}
                    tickFormatter={v => `${(v*100).toFixed(0)}%`} tickLine={false} axisLine={false} label={{ value: 'TAR', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} />
                  <RechartsTooltip contentStyle={TT}
                    formatter={(v: any, n: string) => [`${(v*100).toFixed(1)}%`, n === 'tar' ? 'TAR (Recall)' : 'FAR']} />
                  {/* Diagonal chance line */}
                  <ReferenceLine segment={[{x:0,y:0},{x:1,y:1}]} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
                  {/* EER point */}
                  {eerThreshold > 0 && (
                    <ReferenceLine x={eer} stroke="#fbbf24" strokeDasharray="2 3" label={{ value: 'EER', fill: '#fbbf24', fontSize: 9 }} />
                  )}
                  <Line type="monotone" dataKey="tar" stroke="#00e5ff" strokeWidth={2} dot={false} name="TAR" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-xs opacity-50">
                ROC curve requires enrolled persons with multiple face images
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Confidence distribution ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Confidence Distribution</CardTitle>
          <p className="text-[9px] text-muted-foreground font-mono">Recognition event score histogram · ≥0.6 = high confidence zone</p>
        </CardHeader>
        <CardContent className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="range" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
              <RechartsTooltip contentStyle={TT} cursor={{ fill: 'rgba(0,229,255,0.05)' }} />
              <Bar dataKey="count" name="Queries" radius={[3, 3, 0, 0]}>
                {distData.map((_: any, i: number) => (
                  <Cell key={i} fill={i >= 3 ? '#00e5ff' : '#a78bfa'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Activity log ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">SYSTEM ACTIVITY LOG</CardTitle>
          <p className="text-[9px] text-muted-foreground font-mono">Auto-refreshes every 10s</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono text-xs">LOG_ID</TableHead>
                <TableHead className="font-mono text-xs">STATUS</TableHead>
                <TableHead className="font-mono text-xs">SUBJECT</TableHead>
                <TableHead className="font-mono text-xs">CONFIDENCE</TableHead>
                <TableHead className="font-mono text-xs">QUALITY</TableHead>
                <TableHead className="font-mono text-xs">LATENCY</TableHead>
                <TableHead className="font-mono text-xs">ALGO</TableHead>
                <TableHead className="font-mono text-xs text-right">TIMESTAMP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(logs as any[] | undefined)?.map((log: any) => (
                <TableRow key={log.id} className="hover:bg-white/5">
                  <TableCell className="font-mono text-muted-foreground text-xs">{String(log.id).padStart(6, '0')}</TableCell>
                  <TableCell>
                    <Badge variant={log.recognized ? 'default' : 'danger'} className="font-mono text-[10px]">
                      {log.recognized ? 'MATCH' : 'UNKNOWN'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{log.personName ?? '—'}</TableCell>
                  <TableCell className="font-mono text-sm text-primary">
                    {log.confidence != null ? (log.confidence * 100).toFixed(1) + '%' : '—'}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {log.qualityScore != null ? (log.qualityScore * 100).toFixed(0) + '%' : '—'}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{log.processingTimeMs?.toFixed(0)}ms</TableCell>
                  <TableCell className="font-mono text-[10px] text-muted-foreground">{log.algorithmVersion ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground text-right">
                    {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                  </TableCell>
                </TableRow>
              ))}
              {!logs?.length && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center font-mono text-muted-foreground text-xs py-8 opacity-50">
                    No recognition events yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
