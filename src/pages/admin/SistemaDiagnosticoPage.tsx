import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Map, Info, ShieldCheck, CheckSquare } from "lucide-react";
import MapaSistemaPage from "./MapaSistemaPage";
import DiagnosticoCompeticaoPage from "./DiagnosticoCompeticaoPage";
import SistemaDiagnosticoKpiPage from "./SistemaDiagnosticoKpiPage";
import { RouteValidator } from "@/components/admin/RouteValidator";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";

export default function SistemaDiagnosticoPage() {
  const [tab, setTab] = useState("kpi");
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user?.role === "super_admin") {
      navigate("/super/diagnostico" + location.search, { replace: true });
    }
  }, [user, navigate, location.search]);

  if (user?.role === "super_admin") return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Diagnóstico do Sistema</h1>
        <p className="text-sm text-muted-foreground mt-1">Mapa de módulos e auditoria técnica dos KPIs.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="kpi" className="gap-2"><ShieldCheck className="h-4 w-4" /> Auditoria de KPIs</TabsTrigger>
          <TabsTrigger value="validation" className="gap-2"><CheckSquare className="h-4 w-4" /> Validação por Rota</TabsTrigger>
          <TabsTrigger value="mapa" className="gap-2"><Map className="h-4 w-4" /> Mapa do Sistema</TabsTrigger>
          <TabsTrigger value="diagnostico" className="gap-2"><Info className="h-4 w-4" /> Diagnóstico Competição</TabsTrigger>
        </TabsList>
        <TabsContent value="kpi" className="mt-4">
          <SistemaDiagnosticoKpiPage />
        </TabsContent>
        <TabsContent value="validation" className="mt-4">
          <RouteValidator />
        </TabsContent>
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

