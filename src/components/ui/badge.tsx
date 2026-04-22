import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-tight transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 select-none",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-surface3 text-text",
        destructive:
          "border-transparent bg-destructive/12 text-destructive border-destructive/20",
        outline:
          "text-foreground border-border bg-surface",
        success:
          "border-transparent bg-success/12 text-success border-success/20",
        warning:
          "border-transparent bg-warning/12 text-warning border-warning/25",
        info:
          "border-transparent bg-info/12 text-info border-info/20",
        sport:
          "border-transparent btn-sport text-[hsl(221,83%,8%)] font-bold",
        module:
          "border-transparent bg-[hsl(var(--module-accent)/0.18)] text-[hsl(var(--module-accent))] border-[hsl(var(--module-accent)/0.35)]",
        muted:
          "border-transparent bg-surface3 text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
