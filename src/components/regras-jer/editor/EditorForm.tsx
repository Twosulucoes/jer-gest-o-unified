import { useEffect, useState } from "react";
import { useSportEventRules } from "@/hooks/useSportEventRules";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, RotateCcw, Info } from "lucide-react";
import { FieldText, FieldNumber } from "./RuleFields";
import { DesempateEditor } from "./DesempateEditor";
import { SportEventRow } from "./types";

export function EditorForm({
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
