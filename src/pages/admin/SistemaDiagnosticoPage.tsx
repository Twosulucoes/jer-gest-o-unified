import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Map, Info } from "lucide-react";
import MapaSistemaPage from "./MapaSistemaPage";
import DiagnosticoCompeticaoPage from "./DiagnosticoCompeticaoPage";

export default function SistemaDiagnosticoPage() {
  const [tab, setTab] = useState("mapa");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Diagnóstico do Sistema</h1>
        <p className="text-sm text-muted-foreground mt-1">Mapa de módulos e auditoria técnica da competição.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="mapa" className="gap-2"><Map className="h-4 w-4" /> Mapa do Sistema</TabsTrigger>
          <TabsTrigger value="diagnostico" className="gap-2"><Info className="h-4 w-4" /> Diagnóstico Competição</TabsTrigger>
        </TabsList>
        <TabsContent value="mapa" className="mt-4">
          <MapaSistemaPage />
        </TabsContent>
        <TabsContent value="diagnostico" className="mt-4">
          <DiagnosticoCompeticaoPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
