import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { rpcResolveQr, rpcCheckin, rpcCheckout, getDeviceId, getSelectedFacility } from "@/hooks/useAlojamento";
import { useAlojamentoOffline } from "@/hooks/useAlojamentoOffline";
import { ArrowLeft, ScanLine, CheckCircle2, XCircle } from "lucide-react";
import QrCodeScanner from "@/components/pwa/QrCodeScanner";

type ScanMode = "validate" | "checkin" | "checkout";

export default function AlojamentoScanPage() {
  const navigate = useNavigate();
  const { enqueue, isOnline } = useAlojamentoOffline();
  const [mode, setMode] = useState<ScanMode>("checkin");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const facilityId = getSelectedFacility();

  const extractToken = (input: string): string | null => {
    const trimmed = input.trim();
    if (trimmed.startsWith("JER-ALJ:")) return trimmed.slice(8);
    if (trimmed.startsWith("JER:")) return trimmed.slice(4);
    if (trimmed.length >= 8 && trimmed.length <= 20) return trimmed;
    return null;
  };

  const handleScan = useCallback(async (rawValue: string) => {
    setScannerOpen(false);
    const token = extractToken(rawValue);
    if (!token) {
      toast.error("Código QR inválido");
      return;
    }

    if (!facilityId) {
      toast.error("Selecione um local primeiro");
      navigate("/pwa/alojamento");
      return;
    }

    const deviceId = getDeviceId();
    setResult(null);

    try {
      if (!isOnline) {
        if (mode === "checkin") {
          enqueue("checkin", { token, facility_id: facilityId, mode: "person_qr" });
          toast.info("Check-in enfileirado (offline)");
        } else if (mode === "checkout") {
          enqueue("checkout", { token, facility_id: facilityId });
          toast.info("Check-out enfileirado (offline)");
        }
        return;
      }

      let res: Record<string, any>;
      if (mode === "validate") {
        res = await rpcResolveQr(token);
      } else if (mode === "checkin") {
        res = await rpcCheckin(deviceId, token, facilityId);
      } else {
        res = await rpcCheckout(deviceId, token, facilityId);
      }

      setResult(res);

      if (res.ok) {
        toast.success(
          mode === "validate" ? "QR válido" :
          mode === "checkin" ? "Check-in realizado!" : "Check-out realizado!"
        );
        if (navigator.vibrate) navigator.vibrate(200);
      } else {
        const errorMessages: Record<string, string> = {
          INVALID_TOKEN: "Token inválido ou expirado",
          NOT_A_PERSON: "Este QR não é de uma pessoa",
          UNDER_12: "Pessoa com idade inferior a 12 anos — check-in bloqueado",
          ALREADY_CHECKED_IN: "Pessoa já está hospedada neste local",
          NOT_CHECKED_IN: "Pessoa não está hospedada neste local",
        };
        toast.error(errorMessages[res.error] || res.error || "Erro desconhecido");
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      }
    } catch (err: any) {
      toast.error("Erro ao processar: " + (err.message || "desconhecido"));
    }
  }, [mode, facilityId, isOnline, enqueue, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b bg-card px-4 h-14">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/pwa/alojamento")} className="text-muted-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <ScanLine className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">Scanner</span>
        </div>
        <Button size="sm" onClick={() => setScannerOpen(true)}>
          <ScanLine className="h-4 w-4 mr-1" /> Scan
        </Button>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4">
        <Tabs value={mode} onValueChange={(v) => setMode(v as ScanMode)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="checkin">Check-in</TabsTrigger>
            <TabsTrigger value="checkout">Check-out</TabsTrigger>
            <TabsTrigger value="validate">Validar</TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          className="w-full min-h-[44px]"
          onClick={() => setScannerOpen(true)}
        >
          <ScanLine className="h-5 w-5 mr-2" />
          Escanear QR Code
        </Button>

        {result && (
          <Card className={result.ok ? "border-green-500/50" : "border-destructive/50"}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                {result.ok ? (
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                ) : (
                  <XCircle className="h-6 w-6 text-destructive" />
                )}
                <span className="font-semibold text-lg">
                  {result.ok ? "Sucesso" : "Bloqueado"}
                </span>
              </div>
              {result.full_name && (
                <p className="text-foreground font-medium">{result.full_name}</p>
              )}
              {result.participant_type && (
                <Badge variant="secondary">{result.participant_type}</Badge>
              )}
              {result.error && (
                <p className="text-sm text-destructive">{result.error}: {result.message || ""}</p>
              )}
              {result.ok && result.person_id && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => navigate(`/pwa/alojamento/pessoa/${result.person_id}`)}
                >
                  Ver perfil
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      <QrCodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        allowedPrefixes={["JER-ALJ:", "JER:", "jer:"]}
        title={`Scanner — ${mode === "checkin" ? "Check-in" : mode === "checkout" ? "Check-out" : "Validar"}`}
      />
    </div>
  );
}
