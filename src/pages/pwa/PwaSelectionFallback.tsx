import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Calendar, MapPin } from "lucide-react";
import { useEventContext } from "@/contexts/EventContext";
import { useStageContext } from "@/contexts/StageContext";

const PwaSelectionFallback = () => {
  const navigate = useNavigate();
  const { activeEventId } = useEventContext();
  const { activeStageId } = useStageContext();

  const handleSelectEvent = () => {
    navigate("/selecionar-modulo"); // This page usually allows selecting event/stage
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-orange-200 bg-orange-50/30 dark:bg-orange-950/10">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mb-4 text-orange-600 dark:text-orange-400">
            <AlertCircle className="w-8 h-8" />
          </div>
          <CardTitle className="text-xl font-bold">Configuração Necessária</CardTitle>
          <CardDescription>
            Para acessar os módulos operacionais, você precisa selecionar um evento e uma etapa ativa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-white dark:bg-zinc-900 rounded-lg border shadow-sm">
            <Calendar className={`w-5 h-5 mt-0.5 ${activeEventId ? "text-green-500" : "text-red-500"}`} />
            <div>
              <p className="text-sm font-medium">Evento</p>
              <p className="text-xs text-muted-foreground">
                {activeEventId ? "Selecionado" : "Nenhum evento ativo selecionado (Obrigatório)"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-white dark:bg-zinc-900 rounded-lg border shadow-sm">
            <MapPin className={`w-5 h-5 mt-0.5 ${activeStageId ? "text-green-500" : "text-amber-500"}`} />
            <div>
              <p className="text-sm font-medium">Etapa</p>
              <p className="text-xs text-muted-foreground">
                {activeStageId ? "Selecionada" : "Nenhuma etapa ativa selecionada (Obrigatório para módulos)"}
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button onClick={handleSelectEvent} className="w-full bg-orange-600 hover:bg-orange-700 text-white">
            Selecionar Evento e Etapa
          </Button>
          <Button variant="outline" onClick={() => navigate("/pwa")} className="w-full">
            Voltar para Início do PWA
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default PwaSelectionFallback;
