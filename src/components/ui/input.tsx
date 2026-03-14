// src/components/ui/input.tsx
import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";
import { Search } from "lucide-react";

type InputVariant = "default" | "search";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: InputVariant;
  kbd?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ variant = "default", kbd, className, ...props }, ref) => {
    if (variant === "search") {
      return (
        <div className="relative max-w-[560px] w-full">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sk-text-3 pointer-events-none"
          />
          <input
            ref={ref}
            className={cn(
              "w-full bg-sk-bg-2 border border-sk-border-2 rounded-lg",
              "py-[11px] pl-[42px] pr-20 text-sk-sm text-sk-text-1",
              "placeholder:text-sk-text-3",
              "transition-all duration-sk-base ease-sk-ease",
              "focus:outline-none focus:border-sk-accent",
              "focus:shadow-[0_0_0_3px_var(--sk-accent-dim),var(--sk-shadow-lg)]",
              "focus:bg-sk-bg-3",
              className
            )}
            {...props}
          />
          {kbd && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-sk-text-3 bg-sk-bg-4 border border-sk-border-2 px-1.5 py-0.5 rounded-xs leading-tight">
              {kbd}
            </span>
          )}
        </div>
      );
    }

    return (
      <input
        ref={ref}
        className={cn(
          "w-full bg-sk-bg-0 border border-sk-border-2 rounded-md",
          "py-2.5 px-3.5 text-sk-sm text-sk-text-1",
          "placeholder:text-sk-text-3",
          "transition-all duration-sk-base ease-sk-ease",
          "focus:outline-none focus:border-sk-accent",
          "focus:shadow-[0_0_0_3px_var(--sk-accent-dim)]",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
