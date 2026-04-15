import { useState, useCallback } from "react";
import { useActiveEventId, useEventContext } from "@/contexts/EventContext";
import { useAuth } from "@/hooks/useAuth";
import { useEventEditionRules, usePermLevel, type EventRulesSections } from "@/hooks/useEventEditionRules";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Layers, Trophy, Users, Target, Settings, Award, Send, Shield, Clock } from "lucide-react";
import RegrasEdicaoTab from "@/components/admin/regras/RegrasEdicaoTab";
import RegrasCategoriaTab from "@/components/admin/regras/RegrasCategoriaTab";
import RegrasModalidadesTab from "@/components/admin/regras/RegrasModalidadesTab";
import RegrasLimitesTab from "@/components/admin/regras/RegrasLimitesTab";
import RegrasClassificacaoTab from "@/components/admin/regras/RegrasClassificacaoTab";
import RegrasOperacionaisTab from "@/components/admin/regras/RegrasOperacionaisTab";
import RegrasPontuacaoTab from "@/components/admin/regras/RegrasPontuacaoTab";
import RegrasPublicacaoTab from "@/components/admin/regras/RegrasPublicacaoTab";

export default function RegrasEventoPage() {
  const eventId = useActiveEventId();
  const { activeEvent } = useEventContext();
  const perm = usePermLevel();
  const {
    data,
    sections,
    status,
    version,
    isLoading,
    error,
    save,
    isSaving,
    publish,
    isPublishing,
    createNewVersion,
    logAudit,
  } = useEventEditionRules(eventId);

  const [draft, setDraft] = useState<EventRulesSections>({});
  const [initialized, setInitialized] = useState(false);

  // Sync draft when data loads
  if (data && !initialized) {
    setDraft(data.sections);
    setInitialized(true);
  }
  if (!data && initialized && !isLoading) {
    setInitialized(false);
  }

  const handleSectionChange = useCallback((newSections: EventRulesSections) => {
    setDraft(newSections);
  }, []);

  const handleSave = useCallback(() => {
    save({ sections: draft });
    logAudit("geral", "update", "Regras atualizadas");
  }, [draft, save, logAudit]);

  const isDraft = status === "draft" || !status;
  const hasUnsavedChanges = initialized && JSON.stringify(draft) !== JSON.stringify(sections);

  if (perm === "none") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Regras do Evento</h1>
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertDescription>Acesso negado. Perfil sem permissão para visualizar regras.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with summary */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Regras do Evento</h1>
        {activeEvent && (
          <p className="text-sm text-muted-foreground mt-1">
            Evento ativo: <strong>{activeEvent.name}</strong> ({activeEvent.year})
          </p>
        )}
      </div>

      {/* Summary card */}
      {!isLoading && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center flex-wrap gap-3">
              <Badge variant={status === "published" ? "default" : "secondary"}>
                {status === "published" ? "✅ Publicada" : "📝 Rascunho"}
              </Badge>
              {version > 0 && (
                <span className="text-xs text-muted-foreground">Versão {version}</span>
              )}
              {data?.updated_at && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(data.updated_at).toLocaleString("pt-BR")}
                </span>
              )}
              {hasUnsavedChanges && (
                <Badge variant="outline" className="border-amber-400 text-amber-600 text-[10px]">
                  Alterações não salvas
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>Erro ao carregar regras: {(error as Error).message}</AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      )}

      {!isLoading && !error && (
        <Tabs defaultValue="edicao" className="w-full">
          <TabsList className="w-full flex-wrap h-auto gap-1 justify-start">
            <TabsTrigger value="edicao" className="gap-1.5 text-xs">
              <BookOpen className="h-3.5 w-3.5" />Edição
            </TabsTrigger>
            <TabsTrigger value="categorias" className="gap-1.5 text-xs">
              <Layers className="h-3.5 w-3.5" />Categorias
            </TabsTrigger>
            <TabsTrigger value="modalidades" className="gap-1.5 text-xs">
              <Trophy className="h-3.5 w-3.5" />Modalidades
            </TabsTrigger>
            <TabsTrigger value="limites" className="gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" />Limites
            </TabsTrigger>
            <TabsTrigger value="classificacao" className="gap-1.5 text-xs">
              <Target className="h-3.5 w-3.5" />Classificação
            </TabsTrigger>
            <TabsTrigger value="operacionais" className="gap-1.5 text-xs">
              <Settings className="h-3.5 w-3.5" />Operacionais
            </TabsTrigger>
            <TabsTrigger value="pontuacao" className="gap-1.5 text-xs">
              <Award className="h-3.5 w-3.5" />Pontuação
            </TabsTrigger>
            <TabsTrigger value="publicacao" className="gap-1.5 text-xs">
              <Send className="h-3.5 w-3.5" />Publicação
            </TabsTrigger>
          </TabsList>

          <TabsContent value="edicao">
            <RegrasEdicaoTab
              sections={draft}
              onChange={handleSectionChange}
              onSave={handleSave}
              isSaving={isSaving}
              perm={perm}
              status={status}
              version={version}
              isLoading={false}
              updatedAt={data?.updated_at}
            />
          </TabsContent>
          <TabsContent value="categorias">
            <RegrasCategoriaTab sections={draft} onChange={handleSectionChange} onSave={handleSave} isSaving={isSaving} perm={perm} isLoading={false} />
          </TabsContent>
          <TabsContent value="modalidades">
            <RegrasModalidadesTab sections={draft} onChange={handleSectionChange} onSave={handleSave} isSaving={isSaving} perm={perm} isLoading={false} />
          </TabsContent>
          <TabsContent value="limites">
            <RegrasLimitesTab sections={draft} onChange={handleSectionChange} onSave={handleSave} isSaving={isSaving} perm={perm} isLoading={false} />
          </TabsContent>
          <TabsContent value="classificacao">
            <RegrasClassificacaoTab sections={draft} onChange={handleSectionChange} onSave={handleSave} isSaving={isSaving} perm={perm} isLoading={false} />
          </TabsContent>
          <TabsContent value="operacionais">
            <RegrasOperacionaisTab sections={draft} onChange={handleSectionChange} onSave={handleSave} isSaving={isSaving} perm={perm} isLoading={false} />
          </TabsContent>
          <TabsContent value="pontuacao">
            <RegrasPontuacaoTab sections={draft} onChange={handleSectionChange} onSave={handleSave} isSaving={isSaving} perm={perm} isLoading={false} />
          </TabsContent>
          <TabsContent value="publicacao">
            <RegrasPublicacaoTab
              eventId={eventId}
              status={status}
              version={version}
              perm={perm}
              isLoading={false}
              onPublish={publish}
              isPublishing={isPublishing}
              onNewVersion={createNewVersion}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
