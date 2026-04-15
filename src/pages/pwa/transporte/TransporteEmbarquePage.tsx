import { useState, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { resolveExternalCredential } from "@/lib/resolveExternalCredential";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle, ScanLine, Users, ShieldAlert, Square } from "lucide-react";
import { toast } from "sonner";
import QrCodeScanner from "@/components/pwa/QrCodeScanner";

interface Passenger {
  id: string;
  full_name: string;
  boarded: boolean;
  boarded_at: string | null;
  participant_id: string | null;
}

export default function TransporteEmbarquePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useParams();
  const tripId = params.tripId || searchParams.get("tripId");

  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [finishing, setFinishing] = useState(false);

  // Validate driver ownership
  useEffect(() => {
    (async () => {
      if (!tripId) { setAuthorized(false); setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/pwa/login", { replace: true }); return; }

      const { data: trip } = await supabase
        .from("transport_trips")
        .select("assigned_driver_id")
        .eq("id", tripId)
        .single();

      if (!trip || trip.assigned_driver_id !== session.user.id) {
        setAuthorized(false);
        setLoading(false);
        return;
      }
      setAuthorized(true);
    })();
  }, [tripId, navigate]);

  const fetchPassengers = useCallback(async () => {
    if (!tripId || authorized !== true) { setLoading(false); return; }
    const { data } = await supabase
      .from("transport_passengers")
      .select("id, participant_id, status, boarded_at, participants(full_name)")
      .eq("trip_id", tripId)
      .order("created_at");

    const list = ((data as any) || []).map((p: any) => ({
      id: p.id,
      full_name: p.participants?.full_name || "—",
      boarded: p.status === "boarded",
      boarded_at: p.boarded_at,
      participant_id: p.participant_id,
    }));
    setPassengers(list);
    setLoading(false);
  }, [tripId, authorized]);

  useEffect(() => { if (authorized === true) fetchPassengers(); }, [fetchPassengers, authorized]);

  const boardedCount = passengers.filter(p => p.boarded).length;

  const handleFinish = async () => {
    if (!confirm("Finalizar viagem? Esta ação não pode ser desfeita.")) return;
    setFinishing(true);
    try {
      const { error } = await supabase
        .from("transport_trips")
        .update({ trip_status: "completed" })
        .eq("id", tripId!);
      if (error) throw error;
      toast.success("Viagem finalizada!");
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

        if (!cred) {
          toast.error("Credencial não encontrada no sistema");
          return;
        }
        participantId = (cred as any).participant_id;
        name = (cred as any).participants?.full_name || name;
      }

      if (!participantId) {
        toast.error("Credencial não encontrada no sistema");
        return;
      }

      const passenger = passengers.find(p => p.participant_id === participantId);
      if (!passenger) {
        toast.error(`${name} não está na lista desta viagem`);
        return;
      }
      if (passenger.boarded) {
        toast.info(`${name} já embarcou`);
        return;
      }

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
      <header className="flex items-center justify-between border-b bg-card px-4 h-14">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/pwa/transporte")} className="text-muted-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <CheckCircle className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">Embarque</span>
        </div>
        <div className="flex gap-2">
          {tripId && (
            <>
              <Button size="sm" variant="destructive" onClick={handleFinish} disabled={finishing}>
                <Square className="h-4 w-4 mr-1" /> Finalizar
              </Button>
              <Button size="sm" onClick={() => setScannerOpen(true)}>
                <ScanLine className="h-4 w-4 mr-1" /> Scan
              </Button>
            </>
          )}
        </div>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4">
        {!tripId && (
          <div className="text-center py-8 text-muted-foreground">
            Selecione uma viagem na tela inicial
          </div>
        )}

        {tripId && (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{boardedCount}/{passengers.length} embarcados</span>
            </div>

            {loading && [1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}

            {!loading && passengers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">Nenhum passageiro nesta viagem</div>
            )}

            <div className="space-y-2">
              {passengers.map((p) => (
                <Card key={p.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <span className="text-sm font-medium">{p.full_name}</span>
                    <Badge variant={p.boarded ? "default" : "outline"}>
                      {p.boarded ? "Embarcado" : "Pendente"}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>

      <QrCodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        title="Scan Embarque"
      />
    </div>
  );
}
