import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type KpiStatTone = "default" | "success" | "warning" | "danger" | "info";

const TONE_TEXT: Record<KpiStatTone, string> = {
  default: "text-foreground",
  success: "text-green-500",
  warning: "text-yellow-500",
  danger: "text-destructive",
  info: "text-blue-500",
};

interface KpiStatCardProps {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  sub?: string;
  loading?: boolean;
  tone?: KpiStatTone;
  align?: "left" | "center";
  /** Sobrepõe o tamanho/peso padrão (text-2xl font-bold) — útil para valores textuais curtos. */
  valueClassName?: string;
  className?: string;
}

/**
 * Card de KPI reutilizável (ícone/label + valor). Consolida os grids de
 * estatísticas que antes eram remontados à mão em cada tela de Alimentação.
 */
export function KpiStatCard({
  label,
  value,
  icon,
  sub,
  loading,
  tone = "default",
  align = "left",
  valueClassName = "text-2xl font-bold",
  className,
}: KpiStatCardProps) {
  const formattedValue = typeof value === "number" ? value.toLocaleString("pt-BR") : value;

  return (
    <Card className={className}>
      <CardContent className={cn("pt-4 pb-4", align === "center" && "text-center")}>
        <p
          className={cn(
            "text-xs text-muted-foreground flex items-center gap-1.5",
            align === "center" && "justify-center",
          )}
        >
          {icon}
          {label}
        </p>

        {loading ? (
          <Skeleton className="h-7 w-16 mt-1.5" />
        ) : (
          <div
            className={cn(
              "flex items-baseline gap-2 mt-0.5",
              align === "center" && "justify-center",
            )}
          >
            <span className={cn(valueClassName, "tabular-nums", TONE_TEXT[tone])}>
              {formattedValue}
            </span>
            {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
