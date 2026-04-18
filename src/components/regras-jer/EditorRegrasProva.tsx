import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEventContext } from "@/contexts/EventContext";
import { useSportEventRules } from "@/hooks/useSportEventRules";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Save, RotateCcw, Search, Trash2, Plus, AlertCircle, Trophy, Info } from "lucide-react";
import { toast } from "sonner";

// Catálogo de slugs de desempate aceitos pelo motor (cascata oficial JER 2026).
const TIE_BREAKER_OPTIONS = [
  { slug: "vitoria", label: "Nº de vitórias" },
  { slug: "confronto_direto", label: "Confronto direto" },
  { slug: "saldo_pontos", label: "Saldo de pontos" },
  { slug: "saldo_sets", label: "Saldo de sets" },
  { slug: "saldo_gols", label: "Saldo de gols" },
  { slug: "pontos_pro", label: "Pontos pró" },
  { slug: "gols_pro", label: "Gols pró" },
  { slug: "menos_cartoes", label: "Menos cartões" },
  { slug: "sorteio", label: "Sorteio" },
] as const;

interface SportEventRow {
  id: string;
  name: string;
  gender_scope: string;
  sports: { name: string; is_collective: boolean } | null;
  categories: { name: string } | null;
}

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
        .select("id, name, gender_scope, sports(name, is_collective), categories(name)")
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
          <EditorForm sportEventId={selectedId} eventId={eventId} prova={provas.find((p) => p.id === selectedId)} />
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

// ─────────────────────────────────────────────────────────────────

function EditorForm({
  sportEventId,
  eventId,
  prova,
}: {
  sportEventId: string;
  eventId: string;
  prova?: SportEventRow;
}) {
  const { rulesData, isLoading, upsertRules, isSaving } = useSportEventRules(eventId, sportEventId);
  const [draft, setDraft] = useState<any>(null);

  useEffect(() => {
    if (rulesData?.rules) setDraft(structuredClone(rulesData.rules));
  }, [rulesData]);

  if (isLoading || !draft) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Carregando regras…
        </CardContent>
      </Card>
    );
  }

  const setField = (path: string[], value: any) => {
    setDraft((prev: any) => {
      const next = structuredClone(prev);
      let cur = next;
      for (let i = 0; i < path.length - 1; i++) {
        if (cur[path[i]] == null || typeof cur[path[i]] !== "object") cur[path[i]] = {};
        cur = cur[path[i]];
      }
      cur[path[path.length - 1]] = value;
      return next;
    });
  };

  const handleSave = () => {
    upsertRules({ rules: draft, isActive: true });
  };

  const handleReset = () => {
    if (rulesData?.rules) setDraft(structuredClone(rulesData.rules));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-lg">{prova?.sports?.name ?? "Prova"}</CardTitle>
          <CardDescription>
            {prova?.name} · {prova?.categories?.name ?? "—"} ·{" "}
            <Badge variant="outline" className="text-xs ml-1">
              {rulesData?.source === "default" ? "Defaults" : "Banco"}
            </Badge>
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset} disabled={isSaving}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reverter
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <Save className="h-3.5 w-3.5 mr-1" /> {isSaving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="geral">
          <TabsList className="grid grid-cols-5 max-w-2xl">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="limites">Limites</TabsTrigger>
            <TabsTrigger value="pontuacao">Pontuação</TabsTrigger>
            <TabsTrigger value="desempates">Desempates</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>

          {/* GERAL */}
          <TabsContent value="geral" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FieldText
                label="Família"
                value={draft.family ?? ""}
                onChange={(v) => setField(["family"], v)}
                placeholder="score | sets | time | mark | combat | ranking"
              />
              <FieldText
                label="Formato"
                value={draft.format ?? ""}
                onChange={(v) => setField(["format"], v)}
                placeholder="group_stage | knockout | heats…"
              />
              <FieldText
                label="Modo de participação"
                value={draft.participant_mode ?? ""}
                onChange={(v) => setField(["participant_mode"], v)}
                placeholder="individual | team | pair | relay"
              />
              <FieldNumber
                label="Mínimo de participantes (quórum)"
                value={draft.minimo_participantes}
                onChange={(v) => setField(["minimo_participantes"], v)}
              />
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Estes campos definem como o motor de competição interpreta a prova. Sincronizar pela
                fonte de verdade reaplica os defaults oficiais.
              </AlertDescription>
            </Alert>
          </TabsContent>

          {/* LIMITES */}
          <TabsContent value="limites" className="space-y-3 pt-4">
            <p className="text-xs text-muted-foreground">
              Limites por escola/instituição (quantas equipes/atletas cada delegação pode inscrever).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FieldNumber
                label="Máx. equipes masculinas por escola"
                value={draft?.limites_por_escola?.masculino}
                onChange={(v) => setField(["limites_por_escola", "masculino"], v)}
              />
              <FieldNumber
                label="Máx. equipes femininas por escola"
                value={draft?.limites_por_escola?.feminino}
                onChange={(v) => setField(["limites_por_escola", "feminino"], v)}
              />
              <FieldNumber
                label="Mínimo por equipe (titulares)"
                value={draft?.limites_por_escola?.minimo}
                onChange={(v) => setField(["limites_por_escola", "minimo"], v)}
              />
              <FieldNumber
                label="Mínimo por categoria (quórum)"
                value={draft?.minimo_para_categoria}
                onChange={(v) => setField(["minimo_para_categoria"], v)}
              />
            </div>
            <FieldText
              label="Observação sobre o limite"
              value={draft?.limites_por_escola?.observacao ?? ""}
              onChange={(v) => setField(["limites_por_escola", "observacao"], v)}
              placeholder="Ex.: 1 equipe por escola por categoria"
            />
          </TabsContent>

          {/* PONTUAÇÃO */}
          <TabsContent value="pontuacao" className="space-y-3 pt-4">
            <p className="text-xs text-muted-foreground">Pontos atribuídos em fase de grupos.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <FieldNumber
                label="Vitória"
                value={draft?.pontuacao_grupos?.vitoria}
                onChange={(v) => setField(["pontuacao_grupos", "vitoria"], v)}
              />
              <FieldNumber
                label="Empate"
                value={draft?.pontuacao_grupos?.empate}
                onChange={(v) => setField(["pontuacao_grupos", "empate"], v)}
              />
              <FieldNumber
                label="Derrota"
                value={draft?.pontuacao_grupos?.derrota}
                onChange={(v) => setField(["pontuacao_grupos", "derrota"], v)}
              />
              <FieldNumber
                label="W.O. (perdedor)"
                value={draft?.pontuacao_grupos?.wo}
                onChange={(v) => setField(["pontuacao_grupos", "wo"], v)}
              />
            </div>

            <h4 className="text-sm font-semibold pt-2">Partida (duração / sets / W.O.)</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FieldText
                label="Duração regulamentar"
                value={draft?.partida?.duracao ?? ""}
                onChange={(v) => setField(["partida", "duracao"], v)}
                placeholder="Ex.: 2 × 20 min"
              />
              <FieldText
                label="Best-of (sets)"
                value={draft?.partida?.best_of ?? ""}
                onChange={(v) => setField(["partida", "best_of"], v)}
                placeholder="Ex.: 3 ou 5"
              />
              <FieldText
                label="Política W.O."
                value={draft?.partida?.placar_wo ?? ""}
                onChange={(v) => setField(["partida", "placar_wo"], v)}
                placeholder="Ex.: 1×0 / 2×0 sets"
              />
            </div>
          </TabsContent>

          {/* DESEMPATES */}
          <TabsContent value="desempates" className="space-y-3 pt-4">
            <p className="text-xs text-muted-foreground">
              Cascata oficial de critérios. A ordem importa — o motor avalia de cima para baixo.
            </p>
            <DesempateEditor
              criterios={Array.isArray(draft?.desempates) ? draft.desempates : []}
              onChange={(v) => setField(["desempates"], v)}
            />
          </TabsContent>

          {/* JSON */}
          <TabsContent value="json" className="pt-4">
            <Label className="text-xs">JSON bruto (avançado)</Label>
            <Textarea
              className="font-mono text-xs h-[400px]"
              value={JSON.stringify(draft, null, 2)}
              onChange={(e) => {
                try {
                  setDraft(JSON.parse(e.target.value));
                } catch {
                  /* ignora até virar JSON válido */
                }
              }}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Edição direta do JSONB <code>rules</code>. Tome cuidado — alterações inválidas serão
              rejeitadas no salvar.
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────
// Sub-componentes

function FieldText({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function FieldNumber({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Number(v));
        }}
      />
    </div>
  );
}

function DesempateEditor({
  criterios,
  onChange,
}: {
  criterios: string[];
  onChange: (v: string[]) => void;
}) {
  const move = (idx: number, dir: -1 | 1) => {
    const next = [...criterios];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };
  const remove = (idx: number) => onChange(criterios.filter((_, i) => i !== idx));
  const add = (slug: string) => {
    if (!slug || criterios.includes(slug)) {
      toast.error("Critério já existe ou inválido");
      return;
    }
    onChange([...criterios, slug]);
  };

  const available = TIE_BREAKER_OPTIONS.filter((o) => !criterios.includes(o.slug));

  return (
    <div className="space-y-2">
      <ol className="space-y-1">
        {criterios.length === 0 && (
          <li className="text-xs text-muted-foreground italic">Nenhum critério configurado.</li>
        )}
        {criterios.map((c, i) => {
          const opt = TIE_BREAKER_OPTIONS.find((o) => o.slug === c);
          return (
            <li
              key={`${c}-${i}`}
              className="flex items-center gap-2 rounded-md border bg-card px-3 py-2"
            >
              <span className="text-xs font-mono text-muted-foreground w-6">{i + 1}.</span>
              <span className="flex-1 text-sm">{opt?.label ?? c}</span>
              <Badge variant="outline" className="text-xs font-mono">{c}</Badge>
              <Button size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>↑</Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => move(i, 1)}
                disabled={i === criterios.length - 1}
              >
                ↓
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(i)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          );
        })}
      </ol>

      {available.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {available.map((o) => (
            <Button key={o.slug} size="sm" variant="outline" onClick={() => add(o.slug)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> {o.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
