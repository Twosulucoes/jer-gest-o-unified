import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FONTE_DE_VERDADE_JER2026 } from "@/regras/jer2026";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Search, CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
  eventId: string | undefined;
}

export function AliasesPanel({ eventId }: Props) {
  const fonte = FONTE_DE_VERDADE_JER2026;
  const [filter, setFilter] = useState("");

  const { data: dbAliases } = useQuery({
    queryKey: ["import-aliases", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_aliases")
        .select("kind, alias_norm, canonical_slug")
        .or(`event_id.eq.${eventId},event_id.is.null`)
        .order("kind")
        .order("alias_norm");
      if (error) throw error;
      return data ?? [];
    },
  });

  const all = useMemo(() => {
    const fromTruth = [
      ...Object.entries(fonte.aliases_modalidades).map(([alias, slug]) => ({
        kind: "sport",
        alias_norm: alias,
        canonical_slug: slug,
      })),
      ...Object.entries(fonte.aliases_categorias).map(([alias, slug]) => ({
        kind: "category",
        alias_norm: alias,
        canonical_slug: slug,
      })),
    ];
    const dbSet = new Set((dbAliases ?? []).map((a) => `${a.kind}:${a.alias_norm}`));
    return fromTruth.map((a) => ({
      ...a,
      no_banco: dbSet.has(`${a.kind}:${a.alias_norm}`),
    }));
  }, [fonte, dbAliases]);

  const filtered = all.filter(
    (a) =>
      a.alias_norm.includes(filter.toUpperCase()) ||
      a.canonical_slug.includes(filter.toLowerCase()),
  );

  if (!eventId) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Selecione um evento</AlertTitle>
        <AlertDescription>Escolha um evento ativo para usar esta funcionalidade.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Aliases de importação</CardTitle>
        <CardDescription>
          Sinônimos reconhecidos no SIGECOM e convertidos para o slug canônico. Provenientes do
          regulamento. Para sincronizar com o banco, use a aba <em>Sincronizar</em>.
        </CardDescription>
        <div className="relative pt-2">
          <Search className="absolute left-2 top-4.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filtrar alias ou slug…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8"
          />
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background border-b">
              <tr className="text-left">
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">Alias (entrada)</th>
                <th className="py-2 pr-4">→</th>
                <th className="py-2 pr-4">Slug canônico</th>
                <th className="py-2">Banco</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-1.5 pr-4">
                    <Badge variant="outline" className="text-xs">
                      {a.kind}
                    </Badge>
                  </td>
                  <td className="py-1.5 pr-4 font-mono text-xs">{a.alias_norm}</td>
                  <td className="py-1.5 pr-4 text-muted-foreground">→</td>
                  <td className="py-1.5 pr-4 font-mono text-xs">{a.canonical_slug}</td>
                  <td className="py-1.5">
                    {a.no_banco ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
