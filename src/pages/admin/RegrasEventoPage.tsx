import { useState, useCallback, useMemo, lazy, Suspense } from "react";
import { useActiveEventId, useEventContext } from "@/contexts/EventContext";
import { useEventEditionRules, usePermLevel, type EventRulesSections } from "@/hooks/useEventEditionRules";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Shield, Clock, Save } from "lucide-react";
import { SECTION_CATALOG, GROUP_LABELS, type SectionDef } from "@/components/admin/regras/sectionCatalog";
import RegrasJsonViewer from "@/components/admin/regras/RegrasJsonViewer";
import RegrasEdicaoTab from "@/components/admin/regras/RegrasEdicaoTab";
import RegrasPublicacaoTab from "@/components/admin/regras/RegrasPublicacaoTab";
import RegrasLimitesParticipacaoEditor from "@/components/admin/regras/RegrasLimitesParticipacaoEditor";

export default function RegrasEventoPage() {
  const eventId = useActiveEventId();
  const { activeEvent } = useEventContext();
  const perm = usePermLevel();
  const {
    data, sections, status, version,
    isLoading, error,
    save, isSaving,
    publish, isPublishing,
    createNewVersion, logAudit,
  } = useEventEditionRules(eventId);

  const [draft, setDraft] = useState<EventRulesSections>({});
  const [initialized, setInitialized] = useState(false);
  const [activeSection, setActiveSection] = useState("edition");

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

  const hasUnsavedChanges = initialized && JSON.stringify(draft) !== JSON.stringify(sections);

  // Group catalog sections
  const groupedSections = useMemo(() => {
    const groups: Record<string, SectionDef[]> = {};
    for (const sec of SECTION_CATALOG) {
      if (!groups[sec.group]) groups[sec.group] = [];
      groups[sec.group].push(sec);
    }
    return groups;
  }, []);

  // Get raw data for a section key from sections (which uses the new JSONB format)
  const getSectionData = (key: string) => {
    return (sections as any)?.[key] ?? (draft as any)?.[key];
  };

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

  const renderSectionContent = () => {
    if (activeSection === "publicacao") {
      return (
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
      );
    }

    // For legacy editable tabs (edition uses the old structured approach)
    if (activeSection === "edition") {
      return (
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
      );
    }

    // Interactive editor for participation limits (replaces ParametrosEventoPage)
    if (activeSection === "limites_atletas" && eventId) {
      return <RegrasLimitesParticipacaoEditor eventId={eventId} />;
    }

    // For all other sections, use the generic JSON viewer
    const sectionDef = SECTION_CATALOG.find((s) => s.key === activeSection);
    if (!sectionDef) return null;

    const sectionData = getSectionData(activeSection);
    return <RegrasJsonViewer sectionDef={sectionDef} data={sectionData} />;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Regras do Evento</h1>
        {activeEvent && (
          <p className="text-sm text-muted-foreground mt-1">
            Evento ativo: <strong>{activeEvent.name}</strong> ({activeEvent.year})
          </p>
        )}
      </div>

      {/* Summary */}
      {!isLoading && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center flex-wrap gap-3">
              <Badge variant={status === "published" ? "default" : "secondary"}>
                {status === "published" ? "✅ Publicada" : "📝 Rascunho"}
              </Badge>
              {version > 0 && <span className="text-xs text-muted-foreground">Versão {version}</span>}
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
              {hasUnsavedChanges && (
                <Button size="sm" variant="default" onClick={handleSave} disabled={isSaving}>
                  <Save className="h-3.5 w-3.5 mr-1" />
                  {isSaving ? "Salvando..." : "Salvar"}
                </Button>
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
        <div className="flex gap-4 min-h-[60vh]">
          {/* Sidebar nav */}
          <div className="w-56 shrink-0 hidden md:block">
            <ScrollArea className="h-[calc(100vh-260px)]">
              <nav className="space-y-4 pr-2">
                {Object.entries(groupedSections).map(([groupKey, items]) => (
                  <div key={groupKey}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 px-2">
                      {GROUP_LABELS[groupKey]}
                    </p>
                    <div className="space-y-0.5">
                      {items.map((sec) => {
                        const Icon = sec.icon;
                        const isActive = activeSection === sec.key;
                        const hasData = !!getSectionData(sec.key);
                        return (
                          <button
                            key={sec.key}
                            onClick={() => setActiveSection(sec.key)}
                            className={cn(
                              "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors",
                              isActive
                                ? "bg-primary text-primary-foreground font-medium"
                                : "hover:bg-muted text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{sec.label}</span>
                            {hasData && !isActive && (
                              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {/* Publicação link */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 px-2">
                    Publicação
                  </p>
                  <button
                    onClick={() => setActiveSection("publicacao")}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors",
                      activeSection === "publicacao"
                        ? "bg-primary text-primary-foreground font-medium"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Shield className="h-3.5 w-3.5 shrink-0" />
                    <span>Publicação & Auditoria</span>
                  </button>
                </div>
              </nav>
            </ScrollArea>
          </div>

          {/* Mobile selector */}
          <div className="md:hidden w-full">
            <select
              value={activeSection}
              onChange={(e) => setActiveSection(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mb-4"
            >
              {Object.entries(groupedSections).map(([groupKey, items]) => (
                <optgroup key={groupKey} label={GROUP_LABELS[groupKey]}>
                  {items.map((sec) => (
                    <option key={sec.key} value={sec.key}>{sec.label}</option>
                  ))}
                </optgroup>
              ))}
              <optgroup label="Publicação">
                <option value="publicacao">Publicação & Auditoria</option>
              </optgroup>
            </select>
            {renderSectionContent()}
          </div>

          {/* Content area (desktop) */}
          <div className="flex-1 min-w-0 hidden md:block">
            {renderSectionContent()}
          </div>
        </div>
      )}
    </div>
  );
}
