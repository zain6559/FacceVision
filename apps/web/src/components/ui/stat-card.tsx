import { ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: string;
  description?: string;
}

export function StatCard({ title, value, icon, trend, description }: StatCardProps) {
  return (
    <div className="bg-card border border-border p-4 relative group">
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-primary opacity-50"></div>
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-primary opacity-50"></div>
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{title}</h4>
        {icon && <div className="text-primary opacity-80">{icon}</div>}
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-2xl font-mono text-primary drop-shadow-[0_0_8px_rgba(0,229,255,0.3)]">{value}</div>
        {trend && (
          <div className="text-xs font-mono text-green-400">+{trend}</div>
        )}
      </div>
      {description && <div className="text-xs text-muted-foreground mt-2 font-mono">{description}</div>}

      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
    </div>
  );
}
