// src/components/ui/button.tsx
import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";

type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger";
type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  isLoading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-sk-text-1 text-sk-bg-0 border-sk-text-1 hover:bg-[#e4e4e7] hover:shadow-sk-sm",
  accent:
    "bg-sk-accent text-sk-bg-0 border-sk-accent hover:bg-sk-accent-hover hover:shadow-[0_4px_16px_var(--sk-accent-glow)]",
  secondary:
    "bg-transparent text-sk-text-2 border-sk-border-2 hover:text-sk-text-1 hover:border-sk-border-3 hover:bg-white/[0.03]",
  ghost:
    "bg-transparent text-sk-text-2 border-transparent hover:text-sk-text-1 hover:bg-white/[0.04]",
  danger:
    "bg-sk-red text-sk-bg-0 border-sk-red hover:bg-[#ef4444] hover:shadow-sk-sm",
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: "text-[11px] px-2 py-1 rounded-xs",
  sm: "text-sk-xs px-3 py-1.5 rounded-sm",
  md: "text-sk-sm px-4 py-2 rounded-sm",
  lg: "text-sk-base px-5 py-2.5 rounded-md",
  xl: "text-sk-md px-7 py-3.5 rounded-md",
};

export function Button({
  variant = "primary",
  size = "md",
  children,
  isLoading = false,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-sans font-semibold",
        "border cursor-pointer transition-all duration-sk-fast ease-sk-ease",
        "whitespace-nowrap leading-snug relative overflow-hidden",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin -ml-1 mr-1 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
