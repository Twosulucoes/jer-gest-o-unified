import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

interface ProgressItem {
  id: string;
  name: string;
  current: number;
  total: number;
  percentage: number;
}

interface DashboardProgressCardProps {
  title: string;
  items: ProgressItem[];
  isLoading?: boolean;
  maxItems?: number;
  emptyMessage?: string;
}

export function DashboardProgressCard({
  title,
  items,
  isLoading,
  maxItems = 8,
  emptyMessage = "Nenhum dado disponível"
}: DashboardProgressCardProps) {
  return (
    <Card className="h-full">
      <CardHeader className="py-4 px-5">
        <CardTitle className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-[100px] items-center justify-center text-xs text-muted-foreground italic">
            {emptyMessage}
          </div>
        ) : (
          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {items.slice(0, maxItems).map((item) => (
              <div key={item.id} className="space-y-1.5">
                <div className="flex justify-between text-[11px] items-start gap-3">
                  <span className="font-bold flex-1 leading-tight line-clamp-1" title={item.name}>
                    {item.name}
                  </span>
                  <div className="flex gap-2.5 text-muted-foreground tabular-nums shrink-0">
                    <span className="font-medium">{item.current}/{item.total}</span>
                    <span className="w-8 text-right font-black text-foreground">{item.percentage}%</span>
                  </div>
                </div>
                <Progress value={item.percentage} className="h-1.5" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
