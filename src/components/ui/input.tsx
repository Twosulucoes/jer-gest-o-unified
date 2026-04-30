import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <div className="relative w-full group">
        <input
          type={type}
          className={cn(
            "flex h-12 w-full rounded-xl border border-input bg-surface2 px-4 py-2 text-sm font-semibold ring-offset-background",
            "file:border-0 file:bg-transparent file:text-sm file:font-semibold file:text-foreground",
            "placeholder:text-muted-foreground placeholder:font-normal",
            "transition-all duration-300",
            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:border-primary",
            "hover:border-primary/40 hover:bg-surface3/50",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/50",
            "aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/10",
            className,
          )}
          ref={ref}
          {...props}
        />
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
