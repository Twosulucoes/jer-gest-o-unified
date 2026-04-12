import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AppKPI } from "@/components/app/AppKPI";
import { useAlojamentoOffline } from "@/hooks/useAlojamentoOffline";
import { getSelectedFacility, setSelectedFacility } from "@/hooks/useAlojamento";
import {
  ScanLine, Search, Building, AlertTriangle, LogOut, ArrowLeft, Wifi, WifiOff, Users, LogIn, LogOutIcon, Percent,
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
      const { data } = await supabase.schema("alojamento" as any).from("facilities").select("id, name").eq("active", true).order("name");
      const list = (data || []) as Facility[];
      setFacilities(list);
      if (!facilityId && list.length > 0) {
        setFacilityId(list[0].id);
        setSelectedFacility(list[0].id);
      }
      setLoading(false);
    })();
  }, [facilityId]);

  useEffect(() => {
    if (!facilityId) return;
    setSelectedFacility(facilityId);
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [staysRes, checkinsRes, checkoutsRes, bedsRes, assignRes] = await Promise.all([
        supabase.schema("alojamento" as any).from("stays").select("id", { count: "exact", head: true }).eq("facility_id", facilityId).eq("status", "hospedado"),
        supabase.schema("alojamento" as any).from("stays").select("id", { count: "exact", head: true }).eq("facility_id", facilityId).gte("checkin_at", today + "T00:00:00"),
        supabase.schema("alojamento" as any).from("stays").select("id", { count: "exact", head: true }).eq("facility_id", facilityId).eq("status", "finalizado").gte("checkout_at", today + "T00:00:00"),
        supabase.schema("alojamento" as any).from("beds").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.schema("alojamento" as any).from("assignments").select("id", { count: "exact", head: true }).eq("active", true),
      ]);
      const totalBeds = bedsRes.count || 1;
      const assignedBeds = assignRes.count || 0;
      setKpis({
        hospedados: staysRes.count || 0,
        checkinsHoje: checkinsRes.count || 0,
        checkoutsHoje: checkoutsRes.count || 0,
        ocupacao: Math.round((assignedBeds / totalBeds) * 100),
      });
    })();
  }, [facilityId]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/pwa/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b bg-card px-4 h-14">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/pwa")} className="text-muted-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Building className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">Alojamento</span>
        </div>
        <div className="flex items-center gap-2">
          {isOnline ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-destructive" />}
          {pendingCount > 0 && (
            <span className="text-xs bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">
              {pendingCount} pendência{pendingCount > 1 ? "s" : ""}
            </span>
          )}
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4">
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

        <div className="grid grid-cols-2 gap-3">
          <AppKPI label="Hospedados" value={kpis.hospedados} icon={Users} loading={loading} />
          <AppKPI label="Check-ins hoje" value={kpis.checkinsHoje} icon={LogIn} loading={loading} />
          <AppKPI label="Check-outs hoje" value={kpis.checkoutsHoje} icon={LogOutIcon} loading={loading} />
          <AppKPI label="Ocupação" value={`${kpis.ocupacao}%`} icon={Percent} loading={loading} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Scan QR", icon: ScanLine, to: "/pwa/alojamento/scan", color: "text-primary" },
            { label: "Buscar", icon: Search, to: "/pwa/alojamento/buscar", color: "text-blue-600" },
            { label: "Ocupação", icon: Building, to: "/pwa/alojamento/ocupacao", color: "text-green-600" },
            { label: "Ocorrências", icon: AlertTriangle, to: "/pwa/alojamento/incidentes", color: "text-amber-600" },
          ].map((action) => (
            <Card key={action.label} className="cursor-pointer hover:bg-accent/50 active:scale-[0.98] transition-all" onClick={() => navigate(action.to)}>
              <CardContent className="p-4 flex flex-col items-center gap-2">
                <action.icon className={`h-8 w-8 ${action.color}`} />
                <span className="text-sm font-medium">{action.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
