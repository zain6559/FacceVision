import { ButtonHTMLAttributes, forwardRef } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'danger';
  size?: string;
}

export const buttonVariants = (props?: any) => '';

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size, ...props }, ref) => {
    const base = "inline-flex items-center justify-center font-mono text-xs uppercase tracking-wider transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none h-10 px-4 py-2 relative group overflow-hidden";

    const variants = {
      default: "bg-primary/10 text-primary border border-primary/50 hover:bg-primary/20 hover:border-primary hover:shadow-[0_0_15px_rgba(0,229,255,0.4)]",
      outline: "border border-border text-foreground hover:border-primary/50 hover:text-primary",
      ghost: "text-muted-foreground hover:text-foreground hover:bg-white/5",
      danger: "border border-destructive/50 text-destructive hover:bg-destructive/10 hover:border-destructive hover:shadow-[0_0_15px_rgba(255,0,0,0.3)]"
    };

    return (
      <button ref={ref} className={`${base} ${variants[variant]} ${className}`} {...props}>
        <span className="relative z-10">{props.children}</span>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1s_infinite] pointer-events-none"></div>
      </button>
    );
  }
);
Button.displayName = 'Button';
