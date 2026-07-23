import * as React from "react"
export function Progress({ value = 0, max = 100, className = '' }: { value?: number, max?: number, className?: string }) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={`flex h-2 bg-muted/50 overflow-hidden relative ${className}`}>
      <div className="absolute top-0 bottom-0 start-0 bg-primary transition-all duration-500 shadow-[0_0_10px_rgba(0,229,255,0.5)]" style={{ width: `${percentage}%` }} />
    </div>
  );
}
