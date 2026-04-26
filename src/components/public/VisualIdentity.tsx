import { Trophy } from "lucide-react";
import { brand } from "@/theme/brand";
import { cn } from "@/lib/utils";

interface VisualIdentityProps {
  className?: string;
  showSubtitle?: boolean;
  subtitle?: string;
  size?: "sm" | "md" | "lg";
}

export const VisualIdentity = ({ 
  className, 
  showSubtitle = true, 
  subtitle = "Gestão de Jogos Escolares",
  size = "md"
}: VisualIdentityProps) => {
  const sizeClasses = {
    sm: {
      icon: 16,
      iconContainer: "w-8 h-8 rounded-lg",
      title: "text-sm",
      subtitle: "text-[8px]"
    },
    md: {
      icon: 20,
      iconContainer: "w-10 h-10 rounded-xl",
      title: "text-base",
      subtitle: "text-[10px]"
    },
    lg: {
      icon: 24,
      iconContainer: "w-12 h-12 rounded-2xl",
      title: "text-xl",
      subtitle: "text-xs"
    }
  };

  const currentSize = sizeClasses[size];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(currentSize.iconContainer, "flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105")}
        style={{ 
          background: brand.gradients.brandGradient, 
          boxShadow: `0 8px 24px -8px ${brand.colors.primary}` 
        }}
      >
        <Trophy size={currentSize.icon} />
      </div>
      <div>
        <p className={cn("font-bold tracking-tight leading-none", currentSize.title)} style={{ fontFamily: brand.typography.headingFont }}>
          JER <span style={{ color: brand.colors.accentTeal }}>Gestão</span>
        </p>
        {showSubtitle && (
          <p className={cn("text-slate-600 font-mono uppercase tracking-widest leading-tight mt-0.5", currentSize.subtitle)}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};
