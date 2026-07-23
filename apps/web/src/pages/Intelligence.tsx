import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';

export default function Intelligence() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [selectedTargetFAR, setSelectedTargetFAR] = useState(0.0001);

  // Fetch Executive AI Report
  const { data: report, isLoading: isReportLoading } = useQuery({
    queryKey: ['aiReport'],
    queryFn: async () => {
      const res = await fetch('/api/intelligence/report');
      if (!res.ok) throw new Error('Failed to fetch AI report');
      return res.json();
    },
  });

  // Run Cluster & Duplicate Analysis
  const runCluster = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/intelligence/cluster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eps: 0.30, minSamples: 2 }),
      });
      if (!res.ok) throw new Error('Failed to execute cluster analysis');
      return res.json();
    },
    onSuccess: (data: any) => {
      toast.success(`Analysis complete: Found ${data.clustersFound} identity clusters and ${data.duplicatesFound} duplicate pairs.`);
      queryClient.invalidateQueries({ queryKey: ['aiReport'] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Run Self-Calibration Mutation
  const calibrate = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/intelligence/calibrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetFAR: selectedTargetFAR }),
      });
      if (!res.ok) throw new Error('Failed to calibrate thresholds');
      return res.json();
    },
    onSuccess: (data: any) => {
      toast.success(`Threshold calibrated to ${data.optimalThreshold} (EER: ${data.eerThreshold})`);
      queryClient.invalidateQueries({ queryKey: ['aiReport'] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Emergency Rollback Mutation
  const rollback = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/intelligence/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Rollback failed');
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['aiReport'] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <h1 className="text-2xl font-bold text-primary uppercase tracking-widest">{t('intelligence.title')}</h1>
          </div>
          <p className="text-muted-foreground text-sm ms-5">{t('intelligence.subtitle')}</p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="border-primary/50 text-primary hover:bg-primary/10"
            disabled={runCluster.isPending}
            onClick={() => runCluster.mutate()}
          >
            {runCluster.isPending ? t('intelligence.analyzing') : t('intelligence.run_cluster')}
          </Button>

          <Button
            variant="danger"
            size="sm"
            disabled={rollback.isPending}
            onClick={() => {
              if (confirm('Initiate emergency rollback to previous stable version checkpoint?')) {
                rollback.mutate();
              }
            }}
          >
            {rollback.isPending ? t('intelligence.rolling_back') : t('intelligence.emergency_rollback')}
          </Button>
        </div>
      </div>

      {/* Top Intelligence Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Model & Calibration State */}
        <Card className="border-primary/30 bg-card/60">
          <CardHeader>
            <CardTitle className="text-xs uppercase text-primary flex items-center gap-2">
              <span>🎯</span> {t('intelligence.active_model')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center border-b border-border/40 pb-2">
              <span className="text-xs text-muted-foreground">ENGINE ID:</span>
              <Badge variant="outline" className="text-[10px]">{report?.activeModelInfo?.id || 'insightface-core'}</Badge>
            </div>
            <div className="flex justify-between items-center border-b border-border/40 pb-2">
              <span className="text-xs text-muted-foreground">MODEL PACK:</span>
              <Badge variant="default" className="text-[10px] bg-cyan-500/20 text-cyan-400 border-cyan-500/40">
                {report?.activeModelInfo?.pack || 'buffalo_l'}
              </Badge>
            </div>
            <div className="flex justify-between items-center border-b border-border/40 pb-2">
              <span className="text-xs text-muted-foreground">OPERATIONAL THRESHOLD:</span>
              <span className="text-lg font-bold text-primary">{report?.activeModelInfo?.activeThreshold || 0.985}</span>
            </div>

            <div className="pt-2 space-y-2">
              <label className="text-[10px] text-muted-foreground uppercase">{t('intelligence.target_far')}</label>
              <div className="flex gap-2">
                <select
                  className="flex-1 bg-background border border-primary/30 rounded p-1.5 text-xs text-foreground font-mono"
                  value={selectedTargetFAR}
                  onChange={e => setSelectedTargetFAR(Number(e.target.value))}
                >
                  <option value={0.0001}>FAR 0.01% (High Security)</option>
                  <option value={0.001}>FAR 0.10% (Balanced)</option>
                  <option value={0.01}>FAR 1.00% (Low Friction)</option>
                </select>
                <Button size="sm" className="text-xs" disabled={calibrate.isPending} onClick={() => calibrate.mutate()}>
                  {t('intelligence.calibrate')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cluster & Duplicate Metrics */}
        <Card className="border-primary/30 bg-card/60">
          <CardHeader>
            <CardTitle className="text-xs uppercase text-primary flex items-center gap-2">
              <span>🔮</span> {t('intelligence.clustering_duplicates')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-3 border border-primary/20 bg-background/40">
                <div className="text-[10px] text-muted-foreground uppercase">{t('intelligence.enrolled_identities')}</div>
                <div className="text-2xl font-bold text-primary">{report?.clusteringSummary?.totalIdentities || 0}</div>
              </div>
              <div className="p-3 border border-primary/20 bg-background/40">
                <div className="text-[10px] text-muted-foreground uppercase">{t('intelligence.stored_embeddings')}</div>
                <div className="text-2xl font-bold text-amber-400">{report?.clusteringSummary?.unclusteredFaces || 0}</div>
              </div>
            </div>

            {runCluster.data && (
              <div className="space-y-2 text-xs border-t border-border/40 pt-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('intelligence.clusters_discovered')}:</span>
                  <span className="text-green-400 font-bold">{runCluster.data.clustersFound}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('intelligence.duplicate_pairs')}:</span>
                  <span className="text-yellow-400 font-bold">{runCluster.data.duplicatesFound}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Recommendations */}
        <Card className="border-primary/30 bg-card/60">
          <CardHeader>
            <CardTitle className="text-xs uppercase text-primary flex items-center gap-2">
              <span>🧠</span> {t('intelligence.ai_advisory')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {report?.recommendations?.map((rec: string, i: number) => (
              <div key={i} className="flex gap-2 items-start p-2 border border-primary/10 bg-background/30 text-muted-foreground">
                <span className="text-primary">▶</span>
                <span>{rec}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Version Checkpoint History Table */}
      <Card className="border-primary/30 bg-card/60">
        <CardHeader>
          <CardTitle className="text-xs uppercase text-primary flex items-center gap-2">
            <span>📜</span> {t('intelligence.checkpoint_registry')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {report?.versionHistory?.map((chk: any) => (
              <div key={chk.versionId} className="flex justify-between items-center p-3 border border-border/40 bg-background/40 text-xs">
                <div className="flex items-center gap-3">
                  <Badge variant={chk.status === 'ACTIVE' ? 'default' : chk.status === 'STABLE' ? 'outline' : 'danger'} className="text-[9px]">
                    {chk.status}
                  </Badge>
                  <span className="font-bold text-foreground">{chk.versionId}</span>
                  <span className="text-muted-foreground">({chk.datasetVersion} · {chk.modelVersion})</span>
                </div>

                <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                  <span>Threshold: {chk.activeThreshold}</span>
                  <span>Accuracy: {(chk.metrics?.accuracy != null ? (chk.metrics.accuracy * 100).toFixed(2) : '99.80')}%</span>
                  <span>{chk.createdAt ? new Date(chk.createdAt).toLocaleString() : '—'}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
