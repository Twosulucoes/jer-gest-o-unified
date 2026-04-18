import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReactNode } from "react";

interface Props {
  id?: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
}

export function RegraSection({ id, title, description, icon, children }: Props) {
  return (
    <Card id={id} className="scroll-mt-24">
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-lg flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

export function KvTable({ items }: { items: { label: string; value: string }[] }) {
  if (!items.length) return null;
  return (
    <div className="rounded-md border divide-y">
      {items.map((kv, i) => (
        <div key={i} className="flex justify-between gap-4 px-3 py-2 text-sm">
          <span className="text-muted-foreground shrink-0">{kv.label}</span>
          <span className="text-right font-medium">{kv.value}</span>
        </div>
      ))}
    </div>
  );
}

export function OrderedList({ items }: { items: string[] }) {
  return (
    <ol className="list-decimal list-inside space-y-1 text-sm text-foreground/90">
      {items.map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </ol>
  );
}
