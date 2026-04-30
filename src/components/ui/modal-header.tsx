import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface ModalHeaderProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  variant?: "default" | "warning" | "destructive" | "info";
  className?: string;
}

const VARIANT_STYLES = {
  default: "bg-primary text-primary-foreground",
  info: "bg-blue-600 text-white",
  warning: "bg-amber-600 text-white",
  destructive: "bg-destructive text-destructive-foreground",
};

export function ModalHeader({ 
  title, 
  description, 
  icon: Icon, 
  variant = "default",
  className 
}: ModalHeaderProps) {
  return (
    <div className={cn(
      "px-6 py-8 relative overflow-hidden",
      VARIANT_STYLES[variant],
      className
    )}>
      {/* Decorative background elements */}
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -left-8 -bottom-8 h-24 w-24 rounded-full bg-black/5 blur-2xl" />
      
      <DialogHeader className="relative z-10">
        {Icon && (
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm shadow-inner">
            <Icon className="h-6 w-6" />
          </div>
        )}
        <DialogTitle className="text-2xl font-bold tracking-tight">{title}</DialogTitle>
        <DialogDescription className="text-inherit opacity-85 font-medium leading-relaxed">
          {description}
        </DialogDescription>
      </DialogHeader>
    </div>
  );
}
