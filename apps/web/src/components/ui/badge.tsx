import { ReactNode } from 'react';

export function Badge({ children, variant = 'default', className = '' }: { children: ReactNode, variant?: 'default' | 'success' | 'warning' | 'danger' | 'outline', className?: string }) {
  const variants = {
    default: 'bg-primary/10 text-primary border-primary/30',
    success: 'bg-green-500/10 text-green-400 border-green-500/30',
    warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    danger: 'bg-destructive/10 text-destructive border-destructive/30',
    outline: 'border-border text-foreground hover:bg-white/5',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-none border text-xs font-mono font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
