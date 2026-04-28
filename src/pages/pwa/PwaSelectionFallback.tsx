import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Calendar, MapPin, ArrowLeft, CheckCircle2, AlertTriangle, RefreshCcw } from "lucide-react";
import { useEventContext } from "@/contexts/EventContext";
import { useStageContext } from "@/contexts/StageContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getOfflineQueue } from "@/lib/offlineQueue";
import { getVoucherQueue } from "@/lib/voucherOffline";
import { getAlojamentoQueue } from "@/hooks/useAlojamentoOffline";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PwaSelectionFallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/pwa";
  const { activeEventId, events, setActiveEventId } = useEventContext();
  const { activeStageId, stages, setActiveStageId } = useStageContext();
  
  const [selectedEventId, setSelectedEventId] = useState<string | null>(activeEventId);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(activeStageId);
  const [isVoluntary] = useState(!!activeStageId);
  const [pendingItems, setPendingItems] = useState(0);
  const [pendingBreakdown, setPendingBreakdown] = useState<{label: string, count: number}[]>([]);

  useEffect(() => {
    const offlineCount = getOfflineQueue().filter(i => i.status === "pending" || i.status === "failed").length;
    const voucherCount = getVoucherQueue().filter(v => v.status === "pending" || v.status === "failed").length;
    const alojamentoCount = getAlojamentoQueue().filter(a => a.status === "pending" || a.status === "failed").length;
    
    const total = offlineCount + voucherCount + alojamentoCount;
    setPendingItems(total);

    const breakdown = [];
    if (offlineCount > 0) breakdown.push({ label: "Operações (Alimentação/Transporte)", count: offlineCount });
    if (voucherCount > 0) breakdown.push({ label: "Vouchers", count: voucherCount });
    if (alojamentoCount > 0) breakdown.push({ label: "Alojamento", count: alojamentoCount });
    setPendingBreakdown(breakdown);
  }, []);

  const handleConfirm = async () => {
    if (!selectedEventId || !selectedStageId) return;

    // Se mudou a etapa e tem itens pendentes, bloqueia
    if (activeStageId && activeStageId !== selectedStageId && pendingItems > 0) {
      toast.error("Você tem registros offline pendentes. Sincronize antes de trocar de etapa.");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Auditoria da troca
      if (activeStageId !== selectedStageId) {
        await supabase.from("audit_events").insert({
          table_name: "pwa_stage_switch",
          record_id: selectedStageId,
          action: activeStageId ? "voluntary_switch" : "initial_selection",
          created_by: session?.user.id,
          payload: {
            from_stage_id: activeStageId,
            to_stage_id: selectedStageId,
            from_event_id: activeEventId,
            to_event_id: selectedEventId,
            is_voluntary: isVoluntary,
            from_path: from,
            timestamp: new Date().toISOString()
          }
        });

        // Invalidação de Cache
        localStorage.removeItem("pwa_meal_windows_cache");
        localStorage.removeItem("jer_alj_facility_id");
        localStorage.removeItem("jer_alj_unit_id");
        // Adicionar outras chaves se identificadas futuramente
      }

      setActiveEventId(selectedEventId);
      setActiveStageId(selectedStageId);
      
      toast.success("Contexto atualizado com sucesso");
      navigate(from);
    } catch (err) {
      console.error("Erro ao atualizar contexto:", err);
      toast.error("Erro ao atualizar contexto de trabalho");
    }
  };

  const isMissingStageOnly = activeEventId && !activeStageId;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 animate-in fade-in duration-500">
      <Card className="w-full max-w-md border-orange-200 bg-orange-50/30 dark:bg-orange-950/10 shadow-xl overflow-hidden">
        <div className="bg-orange-500 h-1.5 w-full" />
        <CardHeader className="text-center pt-8">
          <div className="mx-auto w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mb-6 text-orange-600 dark:text-orange-400 ring-4 ring-orange-50 dark:ring-orange-900/10">
            {isVoluntary ? <RefreshCcw className="w-10 h-10" /> : <AlertCircle className="w-10 h-10" />}
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {isVoluntary ? "Trocar Etapa de Trabalho" : (isMissingStageOnly ? "Selecione uma Etapa" : "Configuração Necessária")}
          </CardTitle>
          <CardDescription className="text-base px-2">
            {isVoluntary 
              ? "A troca de etapa altera o contexto de janelas de alimentação, viagens e alojamento."
              : (isMissingStageOnly 
                ? "Você selecionou o evento, mas este módulo exige uma etapa de trabalho ativa para funcionar."
                : "Para acessar os módulos operacionais do PWA, você precisa definir o contexto de trabalho atual.")
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {pendingItems > 0 && isVoluntary && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex items-start gap-3 animate-pulse">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-destructive uppercase tracking-tight">Bloqueio de Segurança</p>
                <p className="text-xs text-destructive/80 font-medium">
                  Você tem {pendingItems} registros pendentes. Sincronize todos os dados antes de trocar de etapa para evitar perda de informações.
                </p>
                <ul className="text-[10px] text-destructive/70 list-disc pl-4 mt-1 font-bold uppercase tracking-tighter">
                  {pendingBreakdown.map((item, idx) => (
                    <li key={idx}>{item.label}: {item.count}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <Calendar className={`w-4 h-4 ${selectedEventId ? "text-green-500" : "text-red-500"}`} />
              <label className="text-sm font-semibold uppercase tracking-wider opacity-70">Evento</label>
            </div>
            <Select value={selectedEventId || ""} onValueChange={(val) => {
              setSelectedEventId(val);
              setSelectedStageId(null);
            }}>
              <SelectTrigger className="h-14 rounded-2xl border-muted-foreground/20 bg-white dark:bg-zinc-900 shadow-sm">
                <SelectValue placeholder="Selecione o evento..." />
              </SelectTrigger>
              <SelectContent>
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} ({e.year})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <MapPin className={`w-4 h-4 ${selectedStageId ? "text-green-500" : "text-amber-500"}`} />
              <label className="text-sm font-semibold uppercase tracking-wider opacity-70">Etapa de Trabalho</label>
            </div>
            <Select 
              value={selectedStageId || ""} 
              onValueChange={setSelectedStageId}
              disabled={!selectedEventId || stages.length === 0}
            >
              <SelectTrigger className="h-14 rounded-2xl border-muted-foreground/20 bg-white dark:bg-zinc-900 shadow-sm">
                <SelectValue placeholder={!selectedEventId ? "Selecione um evento primeiro" : "Selecione a etapa..."} />
              </SelectTrigger>
              <SelectContent>
                {stages.filter(s => !selectedEventId || s.event_id === selectedEventId).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-4">
          <Button 
            onClick={handleConfirm} 
            disabled={!selectedEventId || !selectedStageId || (isVoluntary && activeStageId === selectedStageId) || (pendingItems > 0 && isVoluntary && selectedStageId !== activeStageId)}
            className="w-full h-14 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl shadow-lg transition-all active:scale-[0.98] text-base font-semibold gap-2"
          >
            {selectedEventId && selectedStageId ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                {isVoluntary ? "Atualizar Contexto" : "Confirmar e Continuar"}
              </>
            ) : (
              "Selecione para Continuar"
            )}
          </Button>

          <div className="grid grid-cols-2 gap-3 w-full">
            <Button 
              variant="outline" 
              onClick={() => navigate("/pwa")} 
              className="h-12 rounded-xl border-muted-foreground/20"
            >
              Início PWA
            </Button>
            {isVoluntary ? (
              <Button 
                variant="ghost" 
                onClick={() => navigate(-1)} 
                className="h-12 rounded-xl"
              >
                Voltar
              </Button>
            ) : (
              <Button 
                variant="outline" 
                onClick={() => navigate("/selecionar-modulo")} 
                className="h-12 rounded-xl border-muted-foreground/20"
              >
                Sair do PWA
              </Button>
            )}
          </div>
          
          {from !== "/pwa" && (
            <p className="text-xs text-center text-muted-foreground mt-2">
              Você será levado de volta para: <span className="font-mono bg-muted px-1 rounded">{from}</span>
            </p>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default PwaSelectionFallback;
