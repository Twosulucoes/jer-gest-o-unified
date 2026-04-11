import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface PreviewError {
  row_number: number;
  error_code: string;
  error_message: string;
  entity?: string;
  person_key?: string;
}

interface ImportErrorsTableProps {
  eventId: string;
  mode: "preview" | "full";
  previewErrors?: PreviewError[];
}

function maskPersonKey(key: string | undefined): string {
  if (!key) return "—";
  // If it looks like a CPF (11 digits), mask the middle
  const digits = key.replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.***.***-${digits.slice(9)}`;
  }
  // Otherwise truncate name-based keys
  if (key.length > 30) return key.slice(0, 27) + "…";
  return key;
}

export default function ImportErrorsTable({ eventId, mode, previewErrors }: ImportErrorsTableProps) {
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: fullErrors, isLoading } = useQuery({
    queryKey: ["import_row_errors", eventId, entityFilter, search],
    enabled: mode === "full",
    queryFn: async () => {
      let query = supabase
        .from("import_row_errors")
        .select("id, created_at, row_number, entity, error_code, error_message, payload")

        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (entityFilter !== "all") {
        query = query.eq("entity", entityFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const rows = mode === "preview"
    ? (previewErrors ?? []).map((r) => ({ ...r, created_at: undefined as string | undefined }))
    : (fullErrors ?? []).map((r) => ({
        row_number: r.row_number,
        error_code: r.error_code ?? "",
        error_message: r.error_message,
        entity: r.entity ?? undefined,
        person_key: r.payload && typeof r.payload === "object" && "person_key" in (r.payload as Record<string, unknown>)
          ? String((r.payload as Record<string, unknown>).person_key)
          : undefined,
        created_at: r.created_at as string | undefined,
      }));

  const filtered = search
    ? rows.filter((r) =>
        r.error_message.toLowerCase().includes(search.toLowerCase()) ||
        r.error_code.toLowerCase().includes(search.toLowerCase()) ||
        (r.person_key && r.person_key.toLowerCase().includes(search.toLowerCase()))
      )
    : rows;

  return (
    <div className="space-y-3">
      {mode === "full" && (
        <div className="flex gap-3">
          <Input
            placeholder="Buscar por mensagem, código ou pessoa…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Entidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="people">Pessoas</SelectItem>
              <SelectItem value="enrollment">Inscrições</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Nenhum erro encontrado.</p>
      ) : (
        <div className="rounded-lg border max-h-72 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Linha</TableHead>
                {mode === "full" && <TableHead className="w-24">Fase</TableHead>}
                <TableHead className="w-28">Código</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead className="w-36">Pessoa</TableHead>
                {mode === "full" && <TableHead className="w-36">Data</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{r.row_number}</TableCell>
                  {mode === "full" && (
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {r.entity ?? "—"}
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell className="text-xs font-mono">{r.error_code}</TableCell>
                  <TableCell className="text-sm">{r.error_message}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {maskPersonKey(r.person_key)}
                  </TableCell>
                  {mode === "full" && (
                    <TableCell className="text-xs text-muted-foreground">
                      {r.created_at ? new Date(r.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
