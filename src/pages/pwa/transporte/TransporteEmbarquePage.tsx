import { useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { resolveExternalCredential } from "@/lib/resolveExternalCredential";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle, ScanLine, Users } from "lucide-react";
import { useEffect } from "react";
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
  const tripId = searchParams.get("tripId");
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);

  const fetchPassengers = useCallback(async () => {
    if (!tripId) { setLoading(false); return; }
    const { data } = await supabase
      .from("trip_passengers" as any)
      .select("id, participant_id, participant:participants(full_name), boarded, boarded_at")
      .eq("trip_id", tripId)
      .order("created_at");

    const list = (data || []).map((p: any) => ({
      id: p.id,
      full_name: p.participant?.full_name || "—",
      boarded: p.boarded || false,
      boarded_at: p.boarded_at,
      participant_id: p.participant_id,
    }));
    setPassengers(list);
    setLoading(false);
  }, [tripId]);

  useEffect(() => { fetchPassengers(); }, [fetchPassengers]);

  const boardedCount = passengers.filter(p => p.boarded).length;

  const handleScan = async (rawValue: string) => {
    setScannerOpen(false);
    const token = rawValue.startsWith("JER:") ? rawValue.slice(4) : rawValue.trim();
    if (!token || !tripId) return;

    try {
      let participantId: string | null = null;
      let name = "Participante";

      // Try external credential first
      const extResult = await resolveExternalCredential(token);
      if (extResult) {
        participantId = extResult.participant_id;
        name = extResult.full_name || name;
      } else {
        // Fallback to native credential
        const { data: cred } = await supabase
          .from("participant_credentials" as any)
          .select("participant_id, participant:participants(full_name)")
          .or(`qr_token.eq.${token},credential_code.eq.${token},qr_code_value.eq.${rawValue}`)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();

        if (!cred) {
          toast.error("Credencial não encontrada no sistema");
          return;
        }
        participantId = (cred as any).participant_id;
        name = (cred as any).participant?.full_name || name;
      }

      if (!participantId) {
        toast.error("Credencial não encontrada no sistema");
        return;
      }

      // Check if in this trip
      const passenger = passengers.find(p => p.participant_id === participantId);
      if (!passenger) {
        toast.error(`${name} não está na lista desta viagem`);
        return;
      }
      if (passenger.boarded) {
        toast.info(`${name} já embarcou`);
        return;
      }

      // Register boarding
      const { error } = await supabase
        .from("trip_passengers" as any)
        .update({ boarded: true, boarded_at: new Date().toISOString(), method: "qr_scan" })
        .eq("id", passenger.id);

      if (error) throw error;

      toast.success(`${name} embarcado com sucesso`);
      if (navigator.vibrate) navigator.vibrate(200);
      fetchPassengers();
    } catch (err: any) {
      toast.error("Erro ao registrar embarque: " + (err.message || "desconhecido"));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b bg-card px-4 h-14">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/pwa/transporte/viagens")} className="text-muted-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <CheckCircle className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">Embarque</span>
        </div>
        {tripId && (
          <Button size="sm" onClick={() => setScannerOpen(true)}>
            <ScanLine className="h-4 w-4 mr-1" /> Scan
          </Button>
        )}
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4">
        {!tripId && (
          <div className="text-center py-8 text-muted-foreground">
            Selecione uma viagem na lista de viagens
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
        allowedPrefixes={["JER:", "jer:"]}
        title="Scan Embarque"
      />
    </div>
  );
}
