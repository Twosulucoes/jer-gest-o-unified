import { useState, useCallback, useEffect } from "react";
import { format } from "date-fns";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { resolveExternalCredential } from "@/lib/resolveExternalCredential";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ScanLine, Users, ShieldAlert, UserPlus } from "lucide-react";
import { toast } from "sonner";
import QrCodeScanner from "@/components/pwa/QrCodeScanner";
import { TripInfoCard } from "@/components/pwa/transporte/TripInfoCard";
import { FinishTripDialog } from "@/components/pwa/transporte/FinishTripDialog";
import { ManualBoardingDialog } from "@/components/pwa/transporte/ManualBoardingDialog";

interface Passenger {
  id: string;
  full_name: string;
  boarded: boolean;
  boarded_at: string | null;
  participant_id: string | null;
  is_manual?: boolean;
  manual_name?: string | null;
}

interface TripInfo {
  routeName?: string;
  origin?: string | null;
  destination?: string | null;
  scheduledAt?: string | null;
  vehicleLabel?: string;
  vehiclePlate?: string;
}

export default function TransporteEmbarquePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useParams();
  const tripId = params.tripId || searchParams.get("tripId");

  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [tripInfo, setTripInfo] = useState<TripInfo>({});

  // Use dynamic viewport height
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
      if (!tripId) { setAuthorized(false); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/pwa/login", { replace: true }); return; }

      const { data: trip } = await supabase
        .from("transport_trips")
        .select("assigned_driver_id, scheduled_at, transport_routes(name, origin, destination), transport_vehicles(label, plate)")
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
      });
      setAuthorized(true);
    })();
  }, [tripId, navigate]);

  const fetchPassengers = useCallback(async () => {
    if (!tripId || authorized !== true) { setLoading(false); return; }
    const { data } = await supabase
      .from("transport_passengers")
      .select("id, participant_id, status, boarded_at, is_manual, manual_name, participants(full_name)")
      .eq("trip_id", tripId)
      .order("created_at");

    const list = ((data as any) || []).map((p: any) => ({
      id: p.id,
      full_name: p.is_manual ? (p.manual_name || "Manual") : (p.participants?.full_name || "—"),
      boarded: p.status === "boarded",
      boarded_at: p.boarded_at,
      participant_id: p.participant_id,
      is_manual: p.is_manual,
      manual_name: p.manual_name,
    }));
    setPassengers(list);
    setLoading(false);
  }, [tripId, authorized]);

  useEffect(() => { if (authorized === true) fetchPassengers(); }, [fetchPassengers, authorized]);

  const boardedCount = passengers.filter(p => p.boarded).length;

  const handleFinish = async (hasIncidents: boolean, notes: string) => {
    setFinishing(true);
    try {
      const { error } = await supabase
        .from("transport_trips")
        .update({ trip_status: "completed", has_incidents: hasIncidents, notes: notes || null } as any)
        .eq("id", tripId!);
      if (error) throw error;

      // Create incident record if notes were provided
      if (hasIncidents && notes) {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;

        // Get event_id from trip
        const { data: tripData } = await supabase
          .from("transport_trips")
          .select("event_id")
          .eq("id", tripId!)
          .single();

        if (tripData && userId) {
          // Try to get reporter profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", userId)
            .maybeSingle();

          const label = [
            tripInfo.routeName ? `Rota ${tripInfo.origin || ""} → ${tripInfo.destination || tripInfo.routeName}` : "Viagem",
            tripInfo.scheduledAt ? format(new Date(tripInfo.scheduledAt), "HH:mm") : "",
          ].filter(Boolean).join(", ");

          await supabase.from("operational_incidents").insert({
            event_id: (tripData as any).event_id,
            module: "transporte" as any,
            reference_id: tripId!,
            reference_label: label,
            reported_by_user_id: userId,
            reporter_name: (profile as any)?.full_name || null,
            reporter_phone: null,
            incident_description: notes,
          });
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
    const token = rawValue.startsWith("JER:") ? rawValue.slice(4) : rawValue.trim();
    if (!token || !tripId) return;

    try {
      let participantId: string | null = null;
      let name = "Participante";

      const extResult = await resolveExternalCredential(token);
      if (extResult) {
        participantId = extResult.participant_id;
        name = extResult.full_name || name;
      } else {
        const { data: cred } = await supabase
          .from("participant_credentials")
          .select("participant_id, participants(full_name)")
          .or(`qr_token.eq.${token},credential_code.eq.${token},qr_code_value.eq.${rawValue}`)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();

        if (!cred) { toast.error("Credencial não encontrada"); return; }
        participantId = (cred as any).participant_id;
        name = (cred as any).participants?.full_name || name;
      }

      if (!participantId) { toast.error("Credencial não encontrada"); return; }

      const passenger = passengers.find(p => p.participant_id === participantId);
      if (!passenger) { toast.error(`${name} não está na lista desta viagem`); return; }
      if (passenger.boarded) { toast.info(`${name} já embarcou`); return; }

      const { error } = await supabase
        .from("transport_passengers")
        .update({ status: "boarded", boarded_at: new Date().toISOString() })
        .eq("id", passenger.id);
      if (error) throw error;

      toast.success(`${name} embarcado com sucesso`);
      if (navigator.vibrate) navigator.vibrate(200);
      fetchPassengers();
    } catch (err: any) {
      toast.error("Erro ao registrar embarque: " + (err.message || "desconhecido"));
    }
  };

  if (authorized === false) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-lg font-bold text-foreground mb-2">Acesso Bloqueado</h2>
        <p className="text-muted-foreground text-sm mb-6">
          Apenas o motorista responsável pode registrar embarques nesta viagem.
        </p>
        <Button variant="outline" onClick={() => navigate("/pwa/transporte", { replace: true })}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-primary text-primary-foreground px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/pwa/transporte")} className="text-primary-foreground/70 hover:text-primary-foreground">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="font-heading font-semibold tracking-tight text-sm">Embarque</span>
          </div>
          <div className="flex items-center gap-1 text-xs bg-primary-foreground/10 rounded-full px-2.5 py-1">
            <Users className="h-3.5 w-3.5" />
            <span className="font-bold">{boardedCount}</span>
            <span className="opacity-70">/</span>
            <span>{passengers.length}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Button size="sm" variant="secondary" className="h-8 text-xs flex-1" onClick={() => setManualOpen(true)}>
            <UserPlus className="h-3.5 w-3.5 mr-1" /> Manual
          </Button>
          <Button size="sm" variant="secondary" className="h-8 text-xs flex-1" onClick={() => setScannerOpen(true)}>
            <ScanLine className="h-3.5 w-3.5 mr-1" /> Scan
          </Button>
          <Button size="sm" variant="destructive" className="h-8 text-xs flex-1" onClick={() => setFinishOpen(true)}>
            Finalizar
          </Button>
        </div>
      </header>

      <main className="p-3 max-w-4xl mx-auto space-y-3">
        {/* Trip Info */}
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

        {loading && <div className="grid grid-cols-2 gap-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>}

        {!loading && passengers.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">Nenhum passageiro nesta viagem</div>
        )}

        {/* Passenger grid - 2 columns for landscape */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {passengers.map((p) => (
            <Card key={p.id} className={p.boarded ? "border-primary/30 bg-primary/5" : ""}>
              <CardContent className="p-2.5 flex items-center justify-between">
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">{p.full_name}</span>
                  {p.is_manual && <span className="text-[10px] text-muted-foreground">Embarque manual</span>}
                </div>
                <Badge variant={p.boarded ? "default" : "outline"} className="text-[10px] shrink-0">
                  {p.boarded ? "Embarcado" : "Pendente"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <QrCodeScanner isOpen={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} title="Scan Embarque" />

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
