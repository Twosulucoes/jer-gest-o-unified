import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useActiveStageId } from "@/contexts/StageContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAlojamentoOffline } from "@/hooks/useAlojamentoOffline";
import { getSelectedFacility, setSelectedFacility } from "@/hooks/useAlojamento";
import { AlojamentoDuplicateAlert } from "@/components/pwa/alojamento/AlojamentoDuplicateAlert";
import { PwaContainer } from "@/components/pwa/PwaScreen";
import { PwaStatTriplet, occupancyBarClass } from "@/components/pwa/PwaDashboardPrimitives";
import { PwaStatusBadge } from "@/components/pwa/PwaStatusBadge";
import { PwaActionGrid } from "@/components/pwa/PwaActionGrid";
import {
  ScanLine, Search, Building, AlertTriangle, Users
} from "lucide-react";
import { usePwaAudit } from "@/hooks/usePwaAudit";
import PwaLayout from "@/components/pwa/PwaLayout";
import { dbTelemetry } from "@/lib/monitoring/dbTelemetry";


interface Facility {
  id: string;
  name: string;
  type?: string | null;
  occupancy_pct?: number | null;
  occupied?: number | null;
  total?: number | null;
}

export default function AlojamentoHomePage() {
  const navigate = useNavigate();
  const eventId = useActiveEventId();
  const stageId = useActiveStageId();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [facilityId, setFacilityId] = useState<string>(getSelectedFacility() || "");
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ hospedados: 0, livres: 0, reservados: 0, ocupacao: 0 });

  usePwaAudit("alojamento");

  useEffect(() => {
    (async () => {
      if (!eventId) return;
      
      let query = supabase
        .from("lodging_locations")
        .select("id, name, is_active")
        .eq("event_id", eventId)
        .eq("is_active", true);

      if (stageId) {
        query = query.eq("event_stage_id", stageId);
      }

      const { data, error } = await query.order("name");
      
      dbTelemetry.log({
        moduleName: 'alojamento',
        tableName: 'lodging_locations',
        operation: 'SELECT',
        eventId: eventId,
        isSuccess: !error,
        errorCode: error?.code,
        rowsAffected: data?.length || 0
      });

      if (!error) {
        const list = (data || []) as Facility[];
        setFacilities(list);
        if (!facilityId && list.length > 0) {
          setFacilityId(list[0].id);
          setSelectedFacility(list[0].id);
        }
      }
      setLoading(false);

    })();
  }, [eventId, stageId]);

  useEffect(() => {
    if (!facilityId) return;
    setSelectedFacility(facilityId);
    (async () => {
      const { data, error } = await supabase.rpc("get_alojamento_kpis" as any, { p_facility_id: facilityId });
      
      dbTelemetry.log({
        moduleName: 'alojamento',
        tableName: 'RPC:get_alojamento_kpis',
        operation: 'SELECT',
        eventId: eventId,
        isSuccess: !error,
        errorCode: error?.code
      });

      if (data) {
        const kpi = data as any;
        const total = kpi.total_beds || 0;
        const ocup = kpi.assigned_beds || 0;
        setKpis({
          hospedados: ocup,
          livres: Math.max(0, total - ocup - (kpi.reserved_beds || 0)),
          reservados: kpi.reserved_beds || 0,
          ocupacao: total > 0 ? Math.round((ocup / total) * 100) : 0,
        });
      }
    })();
  }, [facilityId]);

  return (
    <PwaLayout backTo="/pwa" moduleTitle="Alojamento">
      <PwaStatTriplet
        loading={loading}
        items={[
          { label: "Ocupados", value: kpis.hospedados, tone: "module" },
          { label: "Livres", value: kpis.livres, tone: "green" },
          { label: "Reservados", value: kpis.reservados, tone: "amber" },
        ]}
      />

      {loading ? (
        <Skeleton className="h-12 w-full rounded-xl bg-muted/30" />
      ) : (
        <Select value={facilityId} onValueChange={(v) => setFacilityId(v)}>
          <SelectTrigger className="h-12 rounded-xl border-border/70 bg-card text-sm font-semibold">
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

      {facilities.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="op-label">Locais de alojamento</span>
          </div>
          <div className="space-y-2">
            {facilities.slice(0, 5).map((f) => {
              const pct = Math.round(f.occupancy_pct ?? 0);
              return (
                <button
                  key={f.id}
                  onClick={() => { setFacilityId(f.id); navigate("/pwa/alojamento/ocupacao"); }}
                  className="op-card w-full p-3 text-left transition-colors hover:border-module"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">{f.name}</p>
                      {f.type && <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{f.type}</p>}
                    </div>
                    <PwaStatusBadge tone={pct >= 85 ? "danger" : pct >= 65 ? "pending" : "ok"}>
                      {pct}%
                    </PwaStatusBadge>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                    <div className={`h-full ${occupancyBarClass(pct)}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {f.occupied ?? 0} ocupados • {Math.max(0, (f.total ?? 0) - (f.occupied ?? 0))} vagas de {f.total ?? 0}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <PwaActionGrid
        actions={[
          { label: "Scan QR", icon: ScanLine, to: "/pwa/alojamento/scan" },
          { label: "Buscar", icon: Search, to: "/pwa/alojamento/buscar" },
          { label: "Ocupação", icon: Building, to: "/pwa/alojamento/ocupacao" },
          { label: "Lista Completa", icon: Users, to: "/pwa/alojamento/lista-completa" },
          { label: "Ocorrências", icon: AlertTriangle, to: "/pwa/alojamento/incidentes" },
        ]}
      />
    </PwaLayout>
  );
}