import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import RequireActiveEvent from "@/components/admin/RequireActiveEvent";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileBarChart, FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { useBulletinData } from "@/components/relatorios/boletins/useBulletinData";
import BulletinRouter from "@/components/relatorios/boletins/BulletinRouter";
import BulletinValidationAlerts from "@/components/relatorios/boletins/BulletinValidationAlerts";
import { ReportShell } from "@/components/relatorios/ReportShell";
import { ReportPresetsButton } from "@/components/relatorios/ReportPresetsButton";
import { exportBulletinPdf } from "@/components/relatorios/boletins/bulletinPdfExporter";
import { exportBulletinXlsx } from "@/components/relatorios/boletins/bulletinXlsxExporter";
import { useEventBranding } from "@/hooks/useEventBranding";
import { toast } from "sonner";

export default function BoletinsPorModalidadePage() {
  const eventId = useActiveEventId();
  const [sportId, setSportId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [gender, setGender] = useState<string>("all");
  const [phaseId, setPhaseId] = useState<string>("all");
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);

  const { data: branding } = useEventBranding(eventId);

  // Modalidades do evento
  const { data: sports = [] } = useQuery({
    queryKey: ["bulletin-sports", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data } = await supabase
        .from("sport_events")
        .select("sport_id, sports(id, name)")
        .eq("event_id", eventId!);
      const seen = new Map<string, { id: string; name: string }>();
      for (const r of (data || []) as any[]) {
        if (r.sports && !seen.has(r.sport_id)) seen.set(r.sport_id, { id: r.sport_id, name: r.sports.name });
      }
      return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  // Categorias da modalidade selecionada
  const { data: categories = [] } = useQuery({
    queryKey: ["bulletin-categories", eventId, sportId],
    enabled: !!eventId && !!sportId,
    queryFn: async () => {
      const { data } = await supabase
        .from("sport_events")
        .select("category_id, categories(id, name, gender_scope)")
        .eq("event_id", eventId!)
        .eq("sport_id", sportId);
      const seen = new Map<string, any>();
      for (const r of (data || []) as any[]) {
        if (r.categories && !seen.has(r.category_id)) seen.set(r.category_id, r.categories);
      }
      return [...seen.values()].sort((a: any, b: any) => a.name.localeCompare(b.name));
    },
  });

  // Sport event resolvido (sport + categoria + gender match)
  const { data: sportEventId = null } = useQuery({
    queryKey: ["bulletin-sport-event", eventId, sportId, categoryId, gender],
    enabled: !!eventId && !!sportId && !!categoryId,
    queryFn: async () => {
      let q = supabase
        .from("sport_events")
        .select("id, categories(gender_scope)")
        .eq("event_id", eventId!)
        .eq("sport_id", sportId)
        .eq("category_id", categoryId);
      const { data } = await q;
      const list = (data || []) as any[];
      // filtra por gender (gender_scope da categoria)
      const filtered = gender === "all"
        ? list
        : list.filter((x) => {
            const gs = x.categories?.gender_scope;
            return !gs || gs === "mixed" || gs === gender;
          });
      return filtered[0]?.id ?? null;
    },
  });

  const { data: phases = [] } = useQuery({
    queryKey: ["bulletin-phases", sportEventId],
    enabled: !!sportEventId,
    queryFn: async () => {
      const { data } = await supabase
        .from("competition_phases")
        .select("id, name, sort_order")
        .eq("sport_event_id", sportEventId!)
        .order("sort_order");
      return data || [];
    },
  });

  const { data: bulletinData, isLoading: loadingData } = useBulletinData({
    eventId,
    sportEventId,
    phaseId: phaseId === "all" ? null : phaseId,
  });

  const meta = useMemo(() => ({
    eventName: branding?.nome_oficial || branding?.fallbackEventName || "Evento",
    sportName: bulletinData?.sportName ?? sports.find((s) => s.id === sportId)?.name ?? "—",
    categoryName: bulletinData?.categoryName ?? "—",
    gender: gender === "M" ? "Masculino" : gender === "F" ? "Feminino" : "Todos",
    phaseName: phaseId === "all" ? "Todas as fases" : phases.find((p: any) => p.id === phaseId)?.name,
    branding: branding ?? null,
  }), [branding, bulletinData, sports, sportId, gender, phaseId, phases]);

  async function handleExportPdf() {
    if (!bulletinData) return;
    setExporting("pdf");
    try { await exportBulletinPdf(bulletinData, meta); toast.success("PDF gerado."); }
    catch (e: any) { toast.error("Erro ao gerar PDF: " + e.message); }
    finally { setExporting(null); }
  }
  async function handleExportXlsx() {
    if (!bulletinData) return;
    setExporting("xlsx");
    try { await exportBulletinXlsx(bulletinData, meta); toast.success("XLSX gerado."); }
    catch (e: any) { toast.error("Erro ao gerar XLSX: " + e.message); }
    finally { setExporting(null); }
  }

  const canExport = !!bulletinData && (bulletinData.matches.length > 0 || bulletinData.results.length > 0);

  return (
    <RequireActiveEvent>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-3 justify-between flex-wrap">
          <div className="flex items-center gap-3">
            <FileBarChart className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Boletins de Resultado por Modalidade</h1>
              <p className="text-sm text-muted-foreground">Visualize e exporte resultados oficiais por modalidade, categoria, gênero e fase.</p>
            </div>
          </div>
          <ReportPresetsButton
            reportId="boletins-modalidade"
            eventId={eventId}
            currentFilters={{ sportId, categoryId, gender, phaseId }}
            onApply={(f) => {
              if (typeof f.sportId === "string") setSportId(f.sportId);
              if (typeof f.categoryId === "string") setCategoryId(f.categoryId);
              if (typeof f.gender === "string") setGender(f.gender);
              if (typeof f.phaseId === "string") setPhaseId(f.phaseId);
            }}
          />
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label>Modalidade</Label>
              <Select value={sportId} onValueChange={(v) => { setSportId(v); setCategoryId(""); setPhaseId("all"); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {sports.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setPhaseId("all"); }} disabled={!sportId}>
                <SelectTrigger><SelectValue placeholder={sportId ? "Selecione" : "Escolha modalidade"} /></SelectTrigger>
                <SelectContent>
                  {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Gênero</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fase</Label>
              <Select value={phaseId} onValueChange={setPhaseId} disabled={!sportEventId}>
                <SelectTrigger><SelectValue placeholder="Todas as fases" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as fases</SelectItem>
                  {phases.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {sportEventId && bulletinData && (
          <div className="flex justify-between items-center">
            <div className="flex gap-2 items-center text-sm text-muted-foreground">
              <Badge variant="outline">Família: {bulletinData.family}</Badge>
              {!bulletinData.rules && <Badge variant="secondary">Sem regras configuradas</Badge>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportXlsx} disabled={!canExport || !!exporting}>
                {exporting === "xlsx" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-1" />}
                Exportar XLSX
              </Button>
              <Button variant="default" size="sm" onClick={handleExportPdf} disabled={!canExport || !!exporting}>
                {exporting === "pdf" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
                Exportar PDF
              </Button>
            </div>
          </div>
        )}

        {!sportEventId && (
          <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">
            Selecione modalidade e categoria para gerar o boletim.
          </CardContent></Card>
        )}

        {sportEventId && loadingData && (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        )}

        {sportEventId && !loadingData && bulletinData && (
          <div className="space-y-6">
            <BulletinValidationAlerts alerts={bulletinData.validationAlerts} />
            <ReportShell eventId={eventId}>
              <div className="text-center mb-4">
                <h2 className="text-lg font-bold">Boletim de Resultado</h2>
                <p className="text-sm text-muted-foreground">
                  {bulletinData.sportName} • {bulletinData.categoryName} • {meta.gender}
                  {meta.phaseName ? ` • ${meta.phaseName}` : ""}
                </p>
              </div>
              <BulletinRouter data={bulletinData} />
            </ReportShell>
          </div>
        )}
      </div>
    </RequireActiveEvent>
  );
}
