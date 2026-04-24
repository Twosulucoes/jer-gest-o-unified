import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  good,
}: {
  label: string;
  value: number | string;
  good?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div
          className={`text-2xl font-bold font-heading ${
            good === true ? "text-green-600" : good === false ? "text-amber-600" : ""
          }`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
