import { HTMLAttributes, ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';

export function Card({ children, className = '', ...props }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`bg-card border border-border rounded-none relative overflow-hidden ${className}`} {...props}>
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-primary opacity-50"></div>
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-primary opacity-50"></div>
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-primary opacity-50"></div>
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-primary opacity-50"></div>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`p-4 border-b border-border/50 bg-background/50 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h3 className={`font-mono text-sm tracking-wider text-primary uppercase ${className}`}>{children}</h3>;
}

export function CardContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}
