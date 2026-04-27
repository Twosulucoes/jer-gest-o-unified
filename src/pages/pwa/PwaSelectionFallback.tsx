import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Calendar, MapPin, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useEventContext } from "@/contexts/EventContext";
import { useStageContext } from "@/contexts/StageContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PwaSelectionFallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/pwa";
  const reason = location.state?.reason;
  const { activeEventId, events, setActiveEventId } = useEventContext();
  const { activeStageId, stages, setActiveStageId } = useStageContext();

  const handleGoHome = () => {
    navigate("/pwa");
  };

  const isMissingStageOnly = activeEventId && !activeStageId;
  const isMissingEvent = !activeEventId;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 animate-in fade-in duration-500">
      <Card className="w-full max-w-md border-orange-200 bg-orange-50/30 dark:bg-orange-950/10 shadow-xl overflow-hidden">
        <div className="bg-orange-500 h-1.5 w-full" />
        <CardHeader className="text-center pt-8">
          <div className="mx-auto w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mb-6 text-orange-600 dark:text-orange-400 ring-4 ring-orange-50 dark:ring-orange-900/10">
            <AlertCircle className="w-10 h-10" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {isMissingStageOnly ? "Selecione uma Etapa" : "Configuração Necessária"}
          </CardTitle>
          <CardDescription className="text-base px-2">
            {isMissingStageOnly 
              ? "Você selecionou o evento, mas este módulo exige uma etapa de trabalho ativa para funcionar."
              : "Para acessar os módulos operacionais do PWA, você precisa definir o contexto de trabalho atual."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <Calendar className={`w-4 h-4 ${activeEventId ? "text-green-500" : "text-red-500"}`} />
              <label className="text-sm font-semibold uppercase tracking-wider opacity-70">Evento</label>
            </div>
            <Select value={activeEventId || ""} onValueChange={setActiveEventId}>
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
              <MapPin className={`w-4 h-4 ${activeStageId ? "text-green-500" : "text-amber-500"}`} />
              <label className="text-sm font-semibold uppercase tracking-wider opacity-70">Etapa de Trabalho</label>
            </div>
            <Select 
              value={activeStageId || ""} 
              onValueChange={setActiveStageId}
              disabled={!activeEventId || stages.length === 0}
            >
              <SelectTrigger className="h-14 rounded-2xl border-muted-foreground/20 bg-white dark:bg-zinc-900 shadow-sm">
                <SelectValue placeholder={!activeEventId ? "Selecione um evento primeiro" : "Selecione a etapa..."} />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!activeStageId && activeEventId && stages.length > 0 && (
              <p className="text-[10px] text-amber-600 font-bold uppercase tracking-tight px-1 animate-pulse">
                A seleção da etapa é obrigatória para este módulo
              </p>
            )}
            {activeEventId && stages.length === 0 && (
              <p className="text-[10px] text-destructive font-bold uppercase tracking-tight px-1">
                Nenhuma etapa ativa encontrada para este evento
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-4">
          <Button 
            onClick={() => navigate(from)} 
            disabled={!activeEventId || !activeStageId}
            className="w-full h-14 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl shadow-lg transition-all active:scale-[0.98] text-base font-semibold gap-2"
          >
            {activeEventId && activeStageId ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Confirmar e Continuar
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
            <Button 
              variant="outline" 
              onClick={() => navigate("/selecionar-modulo")} 
              className="h-12 rounded-xl border-muted-foreground/20"
            >
              Sair do PWA
            </Button>
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
