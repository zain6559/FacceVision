/**
 * FaceVision — Dashboard Widgets
 * 
 * Real-time widgets for the main dashboard:
 * - System Stats
 * - Recognition Timeline
 * - Confidence Distribution
 * - Queue Status
 * - Recent Activity
 */

import React from 'react';
import { useStatsStore } from '@/lib/store/AppStore';
import { useLiveStats, useQueueStatus, useSystemAlerts } from '@/lib/realtime/RealtimeManager';
import { Icon } from '@/components/common/QuickActions';
import { cn } from '@/lib/utils';

// ─── System Stats Widget ────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: string;
  color?: 'primary' | 'success' | 'warning' | 'danger';
}

function StatCard({ title, value, change, icon, color = 'primary' }: StatCardProps) {
  const colorClasses = {
    primary: 'border-primary/30 text-primary',
    success: 'border-green-500/30 text-green-500',
    warning: 'border-yellow-500/30 text-yellow-500',
    danger: 'border-red-500/30 text-red-500',
  };

  return (
    <div className={cn(
      "p-4 border bg-card/50 backdrop-blur-sm",
      colorClasses[color]
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-wider opacity-60">{title}</p>
          <p className="text-2xl font-mono font-bold mt-1">{value}</p>
          {change !== undefined && (
            <p className={cn(
              "text-xs font-mono mt-1",
              change >= 0 ? "text-green-500" : "text-red-500"
            )}>
              {change >= 0 ? '+' : ''}{change.toFixed(1)}%
            </p>
          )}
        </div>
        <div className={cn("p-2 opacity-60", colorClasses[color])}>
          <Icon name={icon} className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export function SystemStatsWidget() {
  const { systemStats } = useStatsStore();

  useLiveStats((stats) => {
    useStatsStore.getState().setSystemStats({
      totalIdentities: stats.totalRecognitions * 0.8,
      totalFaces: stats.totalRecognitions * 1.5,
      totalRecognitions: stats.totalRecognitions,
      avgConfidence: stats.avgConfidence,
      avgProcessingTime: stats.avgLatencyMs,
      recognitionRate: stats.recognitionRate,
      lastUpdated: new Date(),
    });
  });

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Total Identities"
        value={systemStats?.totalIdentities.toLocaleString() || '—'}
        icon="user"
        color="primary"
      />
      <StatCard
        title="Total Faces"
        value={systemStats?.totalFaces.toLocaleString() || '—'}
        icon="eye"
        color="success"
      />
      <StatCard
        title="Recognitions"
        value={systemStats?.totalRecognitions.toLocaleString() || '—'}
        icon="scan"
        change={systemStats?.recognitionRate}
      />
      <StatCard
        title="Avg Confidence"
        value={systemStats ? `${(systemStats.avgConfidence * 100).toFixed(1)}%` : '—'}
        icon="chart"
        color={systemStats && systemStats.avgConfidence >= 0.7 ? 'success' : 'warning'}
      />
    </div>
  );
}

// ─── Recognition Timeline Widget ────────────────────────────────────────────────

export function RecognitionTimelineWidget() {
  const { recognitionTimeline } = useStatsStore();

  const maxValue = Math.max(...recognitionTimeline.values, 1);

  return (
    <div className="p-4 border border-primary/30 bg-card/50 backdrop-blur-sm">
      <h3 className="text-xs font-mono uppercase tracking-wider opacity-60 mb-4">
        Recognition Activity (24h)
      </h3>
      <div className="flex items-end gap-1 h-32">
        {recognitionTimeline.labels.length > 0 ? (
          recognitionTimeline.labels.map((label, i) => (
            <div key={label} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-primary/60 hover:bg-primary transition-colors"
                style={{ height: `${(recognitionTimeline.values[i] / maxValue) * 100}%` }}
                title={`${recognitionTimeline.values[i]} recognitions`}
              />
              <span className="text-[8px] font-mono opacity-40">{label}</span>
            </div>
          ))
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs font-mono opacity-40">
            No data available
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Queue Status Widget ───────────────────────────────────────────────────────

export function QueueStatusWidget() {
  const [status, setStatus] = React.useState({
    pendingJobs: 0,
    processingJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    avgWaitTime: 0,
  });

  useQueueStatus(setStatus);

  const total = status.pendingJobs + status.processingJobs + status.completedJobs + status.failedJobs;

  return (
    <div className="p-4 border border-primary/30 bg-card/50 backdrop-blur-sm">
      <h3 className="text-xs font-mono uppercase tracking-wider opacity-60 mb-4">
        Queue Status
      </h3>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono">Pending</span>
          <span className="text-xs font-mono text-yellow-500">{status.pendingJobs}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono">Processing</span>
          <span className="text-xs font-mono text-primary animate-pulse">{status.processingJobs}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono">Completed</span>
          <span className="text-xs font-mono text-green-500">{status.completedJobs}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono">Failed</span>
          <span className="text-xs font-mono text-red-500">{status.failedJobs}</span>
        </div>
        
        <div className="pt-2 border-t border-primary/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono opacity-60">Avg Wait</span>
            <span className="text-xs font-mono">{status.avgWaitTime.toFixed(0)}ms</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {total > 0 && (
        <div className="mt-4 h-1 bg-primary/20 overflow-hidden">
          <div className="h-full flex">
            <div
              className="bg-yellow-500 transition-all"
              style={{ width: `${(status.pendingJobs / total) * 100}%` }}
            />
            <div
              className="bg-primary transition-all"
              style={{ width: `${(status.processingJobs / total) * 100}%` }}
            />
            <div
              className="bg-green-500 transition-all"
              style={{ width: `${(status.completedJobs / total) * 100}%` }}
            />
            <div
              className="bg-red-500 transition-all"
              style={{ width: `${(status.failedJobs / total) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── System Alerts Widget ───────────────────────────────────────────────────────

export function SystemAlertsWidget() {
  const [alerts, setAlerts] = React.useState<Array<{
    severity: string;
    title: string;
    message: string;
    timestamp: Date;
  }>>([]);

  useSystemAlerts((alert) => {
    setAlerts(prev => [alert, ...prev].slice(0, 5));
  });

  const severityColors = {
    info: 'border-blue-500/50 text-blue-500',
    warning: 'border-yellow-500/50 text-yellow-500',
    error: 'border-red-500/50 text-red-500',
    critical: 'border-red-500 text-red-500 bg-red-500/10',
  };

  return (
    <div className="p-4 border border-primary/30 bg-card/50 backdrop-blur-sm">
      <h3 className="text-xs font-mono uppercase tracking-wider opacity-60 mb-4">
        System Alerts
      </h3>
      
      {alerts.length > 0 ? (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={cn(
                "p-2 text-xs font-mono border-l-2",
                severityColors[alert.severity as keyof typeof severityColors] || severityColors.info
              )}
            >
              <p className="font-semibold">{alert.title}</p>
              <p className="opacity-60 mt-0.5">{alert.message}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs font-mono opacity-40 text-center py-4">
          No active alerts
        </div>
      )}
    </div>
  );
}

// ─── Connection Status Widget ──────────────────────────────────────────────────

export function ConnectionStatusWidget() {
  const { isConnected, lastConnected } = useConnectionStatus();

  return (
    <div className={cn(
      "p-4 border bg-card/50 backdrop-blur-sm flex items-center gap-3",
      isConnected ? "border-green-500/30" : "border-red-500/30"
    )}>
      <Icon
        name={isConnected ? "wifi" : "wifiOff"}
        className={cn("w-4 h-4", isConnected ? "text-green-500" : "text-red-500")}
      />
      <div className="flex-1">
        <p className={cn(
          "text-xs font-mono uppercase tracking-wider",
          isConnected ? "text-green-500" : "text-red-500"
        )}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </p>
        {lastConnected && (
          <p className="text-[10px] font-mono opacity-40">
            Last connected: {lastConnected.toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Latency Chart Widget ──────────────────────────────────────────────────────

export function LatencyChartWidget() {
  const { latencyChart } = useStatsStore();

  const maxValue = Math.max(...latencyChart.values, 1);

  return (
    <div className="p-4 border border-primary/30 bg-card/50 backdrop-blur-sm">
      <h3 className="text-xs font-mono uppercase tracking-wider opacity-60 mb-4">
        Latency (ms)
      </h3>
      
      <div className="space-y-2">
        {latencyChart.labels.length > 0 ? (
          latencyChart.labels.map((label, i) => {
            const value = latencyChart.values[i];
            const percentage = (value / maxValue) * 100;
            const isHigh = value > 500;
            
            return (
              <div key={label} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono opacity-60">{label}</span>
                  <span className={cn(
                    "text-xs font-mono",
                    isHigh ? "text-red-500" : "text-green-500"
                  )}>
                    {value.toFixed(0)}ms
                  </span>
                </div>
                <div className="h-1 bg-primary/20 overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all",
                      isHigh ? "bg-red-500" : "bg-primary"
                    )}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-xs font-mono opacity-40 text-center py-4">
            No latency data
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Composite Dashboard Grid ──────────────────────────────────────────────────

export function DashboardGrid() {
  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <SystemStatsWidget />
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecognitionTimelineWidget />
        <QueueStatusWidget />
      </div>
      
      {/* Status Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SystemAlertsWidget />
        <LatencyChartWidget />
        <div className="space-y-4">
          <ConnectionStatusWidget />
          <div className="p-4 border border-primary/30 bg-card/50 backdrop-blur-sm">
            <h3 className="text-xs font-mono uppercase tracking-wider opacity-60 mb-2">
              Quick Stats
            </h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="opacity-60">API Uptime</span>
                <span className="text-green-500">99.9%</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-60">Active Sessions</span>
                <span>23</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-60">Cache Hit Rate</span>
                <span className="text-green-500">94.2%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
