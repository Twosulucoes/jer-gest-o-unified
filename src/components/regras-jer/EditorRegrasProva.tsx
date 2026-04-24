import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEventContext } from "@/contexts/EventContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Search, AlertCircle, Trophy } from "lucide-react";
import { EditorForm } from "./editor/EditorForm";
import { SportEventRow } from "./editor/types";

export function EditorRegrasProva() {
  const { activeEvent } = useEventContext();
  const eventId = activeEvent?.id;
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: provas = [], isLoading } = useQuery({
    queryKey: ["sport-events-for-rules-editor", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sport_events")
        .select("id, name, sports(name, is_collective), categories(name, gender_scope)")
        .eq("event_id", eventId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as SportEventRow[];
    },
  });

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return provas;
    return provas.filter((p) =>
      `${p.sports?.name ?? ""} ${p.name} ${p.categories?.name ?? ""}`
        .toLowerCase()
        .includes(f),
    );
  }, [provas, filter]);

  if (!eventId) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Selecione um evento</AlertTitle>
        <AlertDescription>Escolha um evento ativo para editar regras por prova.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
      <Card className="lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-6rem)] flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4" /> Provas
          </CardTitle>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Filtrar…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="overflow-y-auto p-0 flex-1">
          {isLoading && <p className="p-4 text-xs text-muted-foreground">Carregando…</p>}
          <ul className="divide-y">
            {filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition ${
                    selectedId === p.id ? "bg-muted font-medium" : ""
                  }`}
                >
                  <div className="font-medium">{p.sports?.name ?? "—"}</div>
                  <div className="text-muted-foreground truncate">{p.name}</div>
                </button>
              </li>
            ))}
            {!isLoading && filtered.length === 0 && (
              <li className="p-4 text-xs text-muted-foreground">Nenhuma prova.</li>
            )}
          </ul>
        </CardContent>
      </Card>

      <div>
        {selectedId ? (
          <EditorForm
            sportEventId={selectedId}
            eventId={eventId}
            prova={provas.find((p) => p.id === selectedId)}
          />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Selecione uma prova à esquerda para editar suas regras.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
