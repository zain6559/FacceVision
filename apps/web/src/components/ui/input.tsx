import { InputHTMLAttributes, forwardRef } from 'react';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`flex h-10 w-full bg-background border border-border px-3 py-2 text-sm text-foreground font-mono transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:shadow-[0_0_10px_rgba(0,229,255,0.2)] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
