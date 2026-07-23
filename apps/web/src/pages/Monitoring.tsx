import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/lib/i18n';

export default function Monitoring() {
  const { t } = useI18n();

  // Fetch System Health Telemetry
  const { data: health } = useQuery({
    queryKey: ['healthTelemetry'],
    queryFn: async () => {
      const res = await fetch('/api/enterprise/monitoring/health');
      if (!res.ok) throw new Error('Failed to fetch health metrics');
      return res.json();
    },
    refetchInterval: 5000, // Refresh every 5s
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
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-ping" />
          <h1 className="text-2xl font-bold text-primary uppercase tracking-widest">{t('monitoring.title')}</h1>
        </div>
        <p className="text-muted-foreground text-sm ms-5">{t('monitoring.subtitle')}</p>
      </div>

      {/* Health Cards */}
      <div className="grid sm:grid-cols-4 gap-4">
        <Card className="border-primary/30 bg-card/60">
          <CardContent className="pt-4">
            <div className="text-[10px] text-muted-foreground uppercase">{t('monitoring.sys_status')}</div>
            <div className="text-xl font-bold text-green-400">{health?.status || 'HEALTHY'}</div>
            <div className="text-[9px] text-muted-foreground mt-1">{health?.service}</div>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-card/60">
          <CardContent className="pt-4">
            <div className="text-[10px] text-muted-foreground uppercase">{t('monitoring.heap_memory')}</div>
            <div className="text-xl font-bold text-primary">{health?.memoryUsage?.heapUsedMb || '0'} MB</div>
            <div className="text-[9px] text-muted-foreground mt-1">Total: {health?.memoryUsage?.heapTotalMb} MB</div>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-card/60">
          <CardContent className="pt-4">
            <div className="text-[10px] text-muted-foreground uppercase">{t('monitoring.uptime')}</div>
            <div className="text-xl font-bold text-amber-400">{health?.uptimeSeconds || 0}s</div>
            <div className="text-[9px] text-muted-foreground mt-1">Continuous operation</div>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-card/60">
          <CardContent className="pt-4">
            <div className="text-[10px] text-muted-foreground uppercase">{t('monitoring.total_events')}</div>
            <div className="text-xl font-bold text-purple-400">{health?.telemetry?.totalAuditEvents || 0}</div>
            <div className="text-[9px] text-muted-foreground mt-1">Security log entries</div>
          </CardContent>
        </Card>
      </div>

      {/* Audit Trail Table */}
      <Card className="border-primary/30 bg-card/60">
        <CardHeader>
          <CardTitle className="text-xs uppercase text-primary">{t('monitoring.audit_title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <div className="text-xs text-muted-foreground/50 py-4 text-center uppercase">{t('monitoring.no_events')}</div>
          ) : (
            <div className="space-y-2">
              {auditLogs.map((log: any) => (
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
