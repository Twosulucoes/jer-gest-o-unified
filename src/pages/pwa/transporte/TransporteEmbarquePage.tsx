import { useState, useCallback, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { resolveQrCredential } from "@/lib/resolveQrCredential";
import { isVoucherQr, tryRedeemVoucher } from "@/lib/voucherScan";
import { voucherErrorMessage, voucherSuccessMessage } from "@/lib/voucherMessages";
import { getPwaMessage, getVoucherMessage, getPwaLang } from "@/lib/pwa-messages";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ScanLine, Users, ShieldAlert, UserPlus, CloudOff } from "lucide-react";
import { addToOfflineQueue, isOnline } from "@/lib/offlineQueue";
import { OfflineSyncStatus } from "@/components/pwa/OfflineSyncStatus";
import { addToVoucherQueue } from "@/lib/voucherOffline";

import { toast } from "sonner";
import { type IncidentModule } from "@/types/incidents";

import QrCodeScanner from "@/components/pwa/QrCodeScanner";
import { PwaRefreshButton } from "@/components/pwa/PwaRefreshButton";
import { TripInfoCard } from "@/components/pwa/transporte/TripInfoCard";
import { FinishTripDialog } from "@/components/pwa/transporte/FinishTripDialog";
import { ManualBoardingDialog } from "@/components/pwa/transporte/ManualBoardingDialog";
import { DelegationAlertBanner } from "@/components/pwa/transporte/DelegationAlertBanner";

interface Passenger {
  id: string;
  full_name: string;
  boarded: boolean;
  boarded_at: string | null;
  participant_id: string | null;
  is_manual?: boolean;
  manual_name?: string | null;
}

import { VoucherConflictCentral } from "@/components/pwa/VoucherConflictCentral";

interface TripInfo {
  routeName?: string;
  origin?: string | null;
  destination?: string | null;
  scheduledAt?: string | null;
  vehicleLabel?: string;
  vehiclePlate?: string;
  eventStageId?: string | null;
}

export default function TransporteEmbarquePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useParams();
  const tripId = params.tripId || searchParams.get("tripId");
  const lang = getPwaLang();

  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [tripInfo, setTripInfo] = useState<TripInfo>({});

  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    const original = meta?.getAttribute("content") || "";
    if (meta) meta.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no");
    return () => {
      if (meta) meta.setAttribute("content", original || "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no");
    };
  }, []);

  useEffect(() => {
    (async () => {
      if (!tripId) {
        setAuthorized(false);
        setLoading(false);
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login", { replace: true });
        return;
      }

      const { data: trip } = await supabase
        .from("transport_trips")
        .select("assigned_driver_id, scheduled_at, event_stage_id, transport_routes(name, origin, destination), transport_vehicles(label, plate)")
        .eq("id", tripId)
        .single();

      if (!trip || (trip as any).assigned_driver_id !== session.user.id) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      setTripInfo({
        routeName: (trip as any).transport_routes?.name,
        origin: (trip as any).transport_routes?.origin,
        destination: (trip as any).transport_routes?.destination,
        scheduledAt: (trip as any).scheduled_at,
        vehicleLabel: (trip as any).transport_vehicles?.label,
        vehiclePlate: (trip as any).transport_vehicles?.plate,
        eventStageId: (trip as any).event_stage_id ?? null,
      });
      setAuthorized(true);
    })();
  }, [tripId, navigate]);

  const fetchPassengers = useCallback(async () => {
    if (!tripId || authorized !== true) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("transport_passengers")
      .select("id, participant_id, status, boarded_at, is_manual, manual_name, participant:participants(person:people(full_name), delegation:delegations(institution:institutions(name)))")
      .eq("trip_id", tripId)
      .order("created_at");

    if (error) {
      console.error("Erro ao buscar passageiros", error);
      toast.error("Erro ao carregar passageiros da viagem");
      setPassengers([]);
      setLoading(false);
      return;
    }

    const list = ((data as any) || []).map((p: any) => ({
      id: p.id,
      full_name: p.is_manual ? (p.manual_name || "Manual") : (p.participant?.person?.full_name || "—"),
      boarded: p.status === "boarded",
      boarded_at: p.boarded_at,
      participant_id: p.participant_id,
      is_manual: p.is_manual,
      manual_name: p.manual_name,
      delegation_name: p.participant?.delegation?.institution?.name || null,
    }));

    setPassengers(list);
    setLoading(false);
  }, [tripId, authorized]);

  useEffect(() => {
    if (authorized === true) void fetchPassengers();
  }, [fetchPassengers, authorized]);

  const boardedCount = passengers.filter((p) => p.boarded).length;

  const delegationCounts = useMemo(() => {
    const map = new Map<string, number>();
    passengers.forEach(p => {
      const name = (p as any).delegation_name;
      if (name) map.set(name, (map.get(name) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [passengers]);

  const handleFinish = async (hasIncidents: boolean, notes: string) => {
    setFinishing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let driverPhone: string | null = null;
      if (session?.user?.id) {
        const { data: driverProfile } = await supabase
          .from("profiles")
          .select("phone")
          .eq("id", session.user.id)
          .maybeSingle();
        driverPhone = (driverProfile as any)?.phone || null;
      }

      const { error } = await supabase
        .from("transport_trips")
        .update({ trip_status: "completed", has_incidents: hasIncidents, notes: notes || null, driver_phone: driverPhone } as any)
        .eq("id", tripId!);
      if (error) throw error;

      if (hasIncidents && notes) {
        const userId = session?.user?.id;
        const { data: tripData } = await supabase
          .from("transport_trips")
          .select("event_id, event_stage_id")
          .eq("id", tripId!)
          .single();

        if (tripData && userId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", userId)
            .maybeSingle();

          const label = [
            tripInfo.routeName ? `Rota ${tripInfo.origin || ""} → ${tripInfo.destination || tripInfo.routeName}` : "Viagem",
            tripInfo.scheduledAt ? format(new Date(tripInfo.scheduledAt), "HH:mm") : "",
          ].filter(Boolean).join(", ");

          // Resolve event_stage_id: prioriza viagem; fallback p/ primeira etapa ativa do evento.
          let eventStageId: string | null = (tripData as any).event_stage_id ?? null;
          if (!eventStageId) {
            const { data: stage } = await supabase
              .from("event_stages")
              .select("id")
              .eq("event_id", (tripData as any).event_id)
              .eq("status", "active")
              .order("sort_order")
              .limit(1)
              .maybeSingle();
            eventStageId = (stage as any)?.id ?? null;
          }

          if (eventStageId) {
            await supabase.from("operational_incidents").insert({
              event_id: (tripData as any).event_id,
              event_stage_id: eventStageId,
              module: "transporte" as IncidentModule,
              reference_id: tripId!,
              reference_label: label,
              reported_by_user_id: userId,
              reporter_name: (profile as any)?.full_name || null,
              reporter_phone: null,
              incident_description: notes,
            });
          }
        }
      }

      toast.success("Viagem finalizada com sucesso!");
      navigate("/pwa/transporte", { replace: true });
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "desconhecido"));
    } finally {
      setFinishing(false);
    }
  };

  const handleScan = async (rawValue: string) => {
    setScannerOpen(false);
    if (!rawValue.trim() || !tripId) return;

    try {
      let participantId: string | null = null;
      let name = "Participante";
      let viaVoucher = false;

      if (isVoucherQr(rawValue)) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isOnline()) {
          addToVoucherQueue(rawValue, "transport", tripId, session?.user?.id || "", "Portador de Voucher");
          toast.info("Voucher registrado offline. Sincronize quando houver internet.");
          return;
        }
        const voucher = await tryRedeemVoucher(rawValue, "transport", tripId);
        if (!voucher || !voucher.ok) {
          const msg = voucherErrorMessage(voucher?.reason, lang);
          let extra = "";
          if (voucher?.reason === 'already_used_here' && voucher.used_at) {
            extra = ` às ${format(new Date(voucher.used_at), "HH:mm")}`;
          }
          toast.error(`${msg.text}${extra}`);
          return;
        }

        toast.success(voucherSuccessMessage(voucher, "transport", lang).text);
        if (navigator.vibrate) navigator.vibrate(200);
        await fetchPassengers();
        return;
      } else {
        const resolved = await resolveQrCredential(rawValue);
        if (resolved) {
          participantId = resolved.participant_id;
          name = resolved.full_name || name;
        }
      }

      if (!participantId) {
        toast.error(getPwaMessage("ERR_NOT_FOUND", lang));
        return;
      }

      const passenger = passengers.find((p) => p.participant_id === participantId);
      const { data: { session: boardSession } } = await supabase.auth.getSession();

      const boardingData = {
        trip_id: tripId,
        participant_id: participantId,
        status: "boarded",
        boarded_at: new Date().toISOString(),
        boarded_by: boardSession?.user.id ?? null,
        is_manual: false,
      };

      if (!isOnline()) {
        addToOfflineQueue("transporte", boardingData, name);
        toast.info("Registrado offline. Sincronize quando houver internet.");
        if (navigator.vibrate) navigator.vibrate(200);
        // Optimistically update UI if we have the passenger in state
        if (passenger) {
          setPassengers(prev => prev.map(p => p.id === passenger.id ? { ...p, boarded: true, boarded_at: boardingData.boarded_at } : p));
        } else {
          // If not in pre-registered list, we'd need to add them locally too to show them
          setPassengers(prev => [...prev, {
            id: crypto.randomUUID(), // temp id
            full_name: name,
            boarded: true,
            boarded_at: boardingData.boarded_at,
            participant_id: participantId,
            is_manual: false
          }]);
        }
        return;
      }

      if (passenger) {
        if (passenger.boarded) {
          toast.info(`${name} ${getPwaMessage("ALREADY_BOARDED", lang)}`);
          return;
        }
        const { error } = await supabase
          .from("transport_passengers")
          .update({ status: "boarded", boarded_at: boardingData.boarded_at, boarded_by: boardingData.boarded_by })
          .eq("id", passenger.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("transport_passengers")
          .insert(boardingData as any);
        if (error) throw error;
      }


      toast.success(`${viaVoucher ? "🎫 " : ""}${name} ${getPwaMessage("SUCCESS_BOARDING", lang)}`);
      if (navigator.vibrate) navigator.vibrate(200);
      await fetchPassengers();
    } catch (err: any) {
      toast.error(`${getPwaMessage("ERR_UNKNOWN", lang)}: ` + (err.message || "desconhecido"));
    }
  };

  if (authorized === false) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-lg font-bold text-foreground mb-2">{getPwaMessage("ACESSO_BLOQUEADO", lang)}</h2>
        <p className="text-muted-foreground text-sm mb-6">
          {getPwaMessage("APENAS_MOTORISTA", lang)}
        </p>
        <Button variant="outline" onClick={() => navigate("/pwa/transporte", { replace: true })}>
          <ArrowLeft className="h-4 w-4 mr-2" /> {getPwaMessage("VOLTAR", lang)}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-surface text-text px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/pwa/transporte")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="font-heading font-semibold tracking-tight text-sm">{getPwaMessage("EMBARQUE", lang)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs bg-[hsl(var(--module-accent)/0.16)] rounded-full px-2.5 py-1">
              <Users className="h-3.5 w-3.5" />
              <span className="font-bold">{boardedCount}</span>
              <span className="opacity-70">/</span>
              <span>{passengers.length}</span>
            </div>
            <PwaRefreshButton />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Button size="sm" variant="module" className="h-8 text-xs flex-1" onClick={() => setManualOpen(true)}>
            <UserPlus className="h-3.5 w-3.5 mr-1" /> {getPwaMessage("MANUAL", lang)}
          </Button>
          <Button size="sm" variant="module" className="h-8 text-xs flex-1" onClick={() => setScannerOpen(true)}>
            <ScanLine className="h-3.5 w-3.5 mr-1" /> {getPwaMessage("SCAN", lang)}
          </Button>
          <Button size="sm" variant="module" className="h-8 text-xs" onClick={() => navigate(`/pwa/transporte/viagem/${tripId}/passageiros`)}>
            <Users className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="destructive" className="h-8 text-xs flex-1" onClick={() => setFinishOpen(true)}>
            {getPwaMessage("FINALIZAR", lang)}
          </Button>
        </div>
      </header>

      <main className="p-3 max-w-4xl mx-auto space-y-3">
        <OfflineSyncStatus />
        <VoucherConflictCentral />

        {!loading && <DelegationAlertBanner delegationCounts={delegationCounts} />}

        {tripId && !loading && (
          <TripInfoCard
            routeName={tripInfo.routeName}
            origin={tripInfo.origin}
            destination={tripInfo.destination}
            scheduledAt={tripInfo.scheduledAt}
            vehicleLabel={tripInfo.vehicleLabel}
            vehiclePlate={tripInfo.vehiclePlate}
          />
        )}

        {loading && <div className="grid grid-cols-2 gap-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>}

        {!loading && passengers.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">{getPwaMessage("NENHUM_PASSAGEIRO", lang)}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {passengers.map((p) => (
            <Card key={p.id} className={p.boarded ? "border-[hsl(var(--module-accent)/0.45)] bg-[hsl(var(--module-accent)/0.09)]" : ""}>
              <CardContent className="p-2.5 flex items-center justify-between">
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">{p.full_name}</span>
                  {p.is_manual && <span className="text-[10px] text-muted-foreground">{getPwaMessage("MANUAL_BOARDING", lang)}</span>}
                </div>
                <Badge variant={p.boarded ? "module" : "outline"} className="text-[10px] shrink-0">
                  {p.boarded ? getPwaMessage("EMBARCADO", lang) : getPwaMessage("PENDENTE", lang)}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <QrCodeScanner isOpen={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} title={getPwaMessage("SCAN_EMBARQUE", lang)} />

      {tripId && (
        <>
          <ManualBoardingDialog open={manualOpen} onOpenChange={setManualOpen} tripId={tripId} onSuccess={fetchPassengers} />
          <FinishTripDialog
            open={finishOpen}
            onOpenChange={setFinishOpen}
            boardedCount={boardedCount}
            totalCount={passengers.length}
            finishing={finishing}
            onConfirm={handleFinish}
          />
        </>
      )}
    </div>
  );
}
