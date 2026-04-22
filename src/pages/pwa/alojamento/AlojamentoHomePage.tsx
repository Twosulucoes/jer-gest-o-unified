import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AppKPI } from "@/components/app/AppKPI";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import { useAlojamentoOffline } from "@/hooks/useAlojamentoOffline";
import { getSelectedFacility, setSelectedFacility } from "@/hooks/useAlojamento";
import { AlojamentoDuplicateAlert } from "@/components/pwa/alojamento/AlojamentoDuplicateAlert";
import {
  ScanLine, Search, Building, AlertTriangle, Wifi, WifiOff, Users, LogIn, LogOutIcon, Percent,
} from "lucide-react";

interface Facility {
  id: string;
  name: string;
}

export default function AlojamentoHomePage() {
  const navigate = useNavigate();
  const { pendingCount, isOnline } = useAlojamentoOffline();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [facilityId, setFacilityId] = useState<string>(getSelectedFacility() || "");
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ hospedados: 0, checkinsHoje: 0, checkoutsHoje: 0, ocupacao: 0 });

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("list_alojamento_facilities" as any);
      if (!error) {
        const list = (Array.isArray(data) ? data : []) as Facility[];
        setFacilities(list);
        if (!facilityId && list.length > 0) {
          setFacilityId(list[0].id);
          setSelectedFacility(list[0].id);
        }
      }
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!facilityId) return;
    setSelectedFacility(facilityId);
    (async () => {
      const { data } = await supabase.rpc("get_alojamento_kpis" as any, { p_facility_id: facilityId });
      if (data) {
        const kpi = data as any;
        setKpis({
          hospedados: kpi.hospedados || 0,
          checkinsHoje: kpi.checkins_hoje || 0,
          checkoutsHoje: kpi.checkouts_hoje || 0,
          ocupacao: kpi.total_beds > 0 ? Math.round((kpi.assigned_beds / kpi.total_beds) * 100) : 0,
        });
      }
    })();
  }, [facilityId]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/pwa/login", { replace: true });
  };

  const actions = [
    { label: "Scan QR", icon: ScanLine, to: "/pwa/alojamento/scan" },
    { label: "Buscar", icon: Search, to: "/pwa/alojamento/buscar" },
    { label: "Ocupação", icon: Building, to: "/pwa/alojamento/ocupacao" },
    { label: "Lista Completa", icon: Users, to: "/pwa/alojamento/lista-completa" },
    { label: "Ocorrências", icon: AlertTriangle, to: "/pwa/alojamento/incidentes" },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
      <PwaHeader
        title="Alojamento"
        icon={Building}
        backTo="/pwa"
        onSignOut={handleSignOut}
        rightSlot={
          <div className="flex items-center gap-2">
            {isOnline ? <Wifi className="h-4 w-4 text-green-400" /> : <WifiOff className="h-4 w-4 text-red-300" />}
            {pendingCount > 0 && (
              <span className="text-xs bg-primary-foreground/20 text-primary-foreground px-2 py-0.5 rounded-full font-medium">
                {pendingCount} pendência{pendingCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        }
      />

      <main className="relative p-4 max-w-md mx-auto space-y-4">
        {loading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <Select value={facilityId} onValueChange={(v) => setFacilityId(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o local" />
            </SelectTrigger>
            <SelectContent>
              {facilities.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {facilityId && <AlojamentoDuplicateAlert facilityId={facilityId} />}

        <div className="grid grid-cols-2 gap-3">
          <AppKPI label="Hospedados" value={kpis.hospedados} icon={Users} loading={loading} />
          <AppKPI label="Check-ins hoje" value={kpis.checkinsHoje} icon={LogIn} loading={loading} />
          <AppKPI label="Check-outs hoje" value={kpis.checkoutsHoje} icon={LogOutIcon} loading={loading} />
          <AppKPI label="Ocupação" value={`${kpis.ocupacao}%`} icon={Percent} loading={loading} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => (
            <Card key={action.label} className="cursor-pointer border-border/80 bg-card/95 hover:shadow-app-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all" onClick={() => navigate(action.to)}>
              <CardContent className="p-4 flex flex-col items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--module-accent)/0.14)] text-[hsl(var(--module-accent))] shadow-app-sm">
                  <action.icon className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium">{action.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
