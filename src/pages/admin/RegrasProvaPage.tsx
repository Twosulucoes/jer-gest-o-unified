import { useState, useMemo } from "react";
import { useActiveEventId } from "@/contexts/EventContext";
import { useSportEventRules } from "@/hooks/useSportEventRules";
import ModuleHeader from "@/components/admin/ModuleHeader";
import SportEventPicker from "@/components/admin/competition/SportEventPicker";
import RulesPresetPicker from "@/components/admin/competition/RulesPresetPicker";
import RulesForm from "@/components/admin/competition/RulesForm";
import RulesJsonEditor from "@/components/admin/competition/RulesJsonEditor";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, RotateCcw, XCircle, Info } from "lucide-react";
import type { SportEventRulesV1 } from "@/types/sportEventRules";
import { VALID_FORMATS_BY_FAMILY } from "@/types/sportEventRules";

const DEFAULT_RULES: SportEventRulesV1 = {
  family: "score",
  format: "group_stage",
  participant_mode: "team",
  scoring: { score_type: "goals" },
  scheduling: {},
  tie_breakers: [],
  enrollment_limits: {},
};

export default function RegrasProvaPage() {
  const eventId = useActiveEventId();
  const [sportEventId, setSportEventId] = useState<string | null>(null);
  const { rules, source, isLoading, error, upsertRules, isSaving } = useSportEventRules(eventId, sportEventId);

  const [draft, setDraft] = useState<SportEventRulesV1>(DEFAULT_RULES);
  const [initialized, setInitialized] = useState(false);

  // Sync draft when rules load
  useMemo(() => {
    if (rules && sportEventId) {
      setDraft({ ...DEFAULT_RULES, ...rules });
      setInitialized(true);
    }
  }, [rules, sportEventId]);

  const validationErrors = useMemo(() => {
    const errs: string[] = [];
    if (!draft.family) errs.push("Família é obrigatória");
    if (!draft.format) errs.push("Formato é obrigatório");
    const validFormats = VALID_FORMATS_BY_FAMILY[draft.family] ?? [];
    if (draft.format && !validFormats.includes(draft.format)) {
      errs.push(`Formato "${draft.format}" incompatível com família "${draft.family}"`);
    }
    return errs;
  }, [draft]);

  const handleSave = () => {
    if (validationErrors.length > 0) return;
    upsertRules({ rules: draft });
  };

  const handleDeactivate = () => {
    upsertRules({ rules: draft, isActive: false });
  };

  const handleRestore = () => {
    if (rules) {
      setDraft({ ...DEFAULT_RULES, ...rules });
    }
  };

  return (
    <div className="space-y-6">
      <ModuleHeader route="/admin/competicao/regras" title="Regras por Prova" />

      <SportEventPicker
        eventId={eventId}
        value={sportEventId}
        onChange={(id) => {
          setSportEventId(id);
          setInitialized(false);
        }}
      />

      {!sportEventId && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>Selecione uma prova para configurar suas regras.</AlertDescription>
        </Alert>
      )}

      {sportEventId && isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {sportEventId && error && (
        <Alert variant="destructive">
          <AlertDescription>Erro ao carregar regras: {(error as Error).message}</AlertDescription>
        </Alert>
      )}

      {sportEventId && !isLoading && !error && initialized && (
        <div className="space-y-4">
          {source === "default" && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Sem regras cadastradas para esta prova. Usando padrão. Escolha um preset ou configure manualmente.
              </AlertDescription>
            </Alert>
          )}

          <RulesPresetPicker onApply={(preset) => setDraft({ ...preset })} />

          <Tabs defaultValue="form">
            <TabsList>
              <TabsTrigger value="form">Formulário</TabsTrigger>
              <TabsTrigger value="json">JSON Avançado</TabsTrigger>
            </TabsList>

            <TabsContent value="form">
              <RulesForm rules={draft} onChange={setDraft} validationErrors={validationErrors} />
            </TabsContent>

            <TabsContent value="json">
              <RulesJsonEditor rules={draft} onApply={setDraft} />
            </TabsContent>
          </Tabs>

          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={handleSave} disabled={validationErrors.length > 0 || isSaving}>
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
            <Button variant="outline" onClick={handleRestore}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Restaurar
            </Button>
            <Button variant="ghost" className="text-destructive" onClick={handleDeactivate}>
              <XCircle className="h-4 w-4 mr-1" />
              Desativar regra
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
