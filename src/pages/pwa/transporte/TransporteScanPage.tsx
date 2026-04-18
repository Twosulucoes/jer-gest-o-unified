import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScanLine, CheckCircle, XCircle } from "lucide-react";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import QrCodeScanner from "@/components/pwa/QrCodeScanner";
import { resolveQrCredential } from "@/lib/resolveQrCredential";

export default function TransporteScanPage() {
  const _navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tripId = searchParams.get("tripId");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const handleScan = async (rawValue: string) => {
    setScannerOpen(false);
    if (!rawValue.trim()) return;

    try {
      const resolved = await resolveQrCredential(rawValue);
      if (!resolved) {
        setResult({ ok: false, message: "Credencial não encontrada ou inativa" });
        return;
      }

      const name = resolved.full_name || "Participante identificado";

      if (tripId) {
        const { data: { session } } = await supabase.auth.getSession();

        // Check if already registered for this trip
        const { data: existing } = await supabase
          .from("transport_passengers")
          .select("id, status")
          .eq("trip_id", tripId)
          .eq("participant_id", resolved.participant_id)
          .maybeSingle();

        if (existing) {
          if (existing.status === "boarded") {
            setResult({ ok: true, message: `${name} já embarcou anteriormente` });
            return;
          }
          const { error } = await supabase
            .from("transport_passengers")
            .update({ status: "boarded", boarded_at: new Date().toISOString(), boarded_by: session?.user.id ?? null })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("transport_passengers")
            .insert({
              trip_id: tripId,
              participant_id: resolved.participant_id,
              status: "boarded",
              boarded_at: new Date().toISOString(),
              boarded_by: session?.user.id ?? null,
              is_manual: false,
            } as any);
          if (error) throw error;
        }
      }

      setResult({ ok: true, message: `Embarque registrado: ${name}` });
      if (navigator.vibrate) navigator.vibrate(200);
    } catch (err: any) {
      setResult({ ok: false, message: `Erro ao validar: ${err.message || "desconhecido"}` });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PwaHeader
        title="Scan Embarque"
        icon={ScanLine}
        backTo={tripId ? `/pwa/transporte/embarque?tripId=${tripId}` : "/pwa/transporte"}
      />

      <main className="p-4 max-w-md mx-auto space-y-4">
        <Button className="w-full min-h-[44px]" onClick={() => setScannerOpen(true)}>
          <ScanLine className="h-5 w-5 mr-2" />
          Escanear QR Code
        </Button>

        {result && (
          <Card className={result.ok ? "border-success/50" : "border-destructive/50"}>
            <CardContent className="p-4 flex items-center gap-3">
              {result.ok ? (
                <CheckCircle className="h-6 w-6 text-success shrink-0" />
              ) : (
                <XCircle className="h-6 w-6 text-destructive shrink-0" />
              )}
              <span className="text-sm font-medium">{result.message}</span>
            </CardContent>
          </Card>
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
