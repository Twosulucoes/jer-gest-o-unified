import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { rpcResolveQr, rpcCheckin, rpcCheckout, getDeviceId, getSelectedFacility } from "@/hooks/useAlojamento";
import { useAlojamentoOffline } from "@/hooks/useAlojamentoOffline";
import { ArrowLeft, ScanLine, Keyboard, CheckCircle2, XCircle, Loader2 } from "lucide-react";

type ScanMode = "validate" | "checkin" | "checkout";

export default function AlojamentoScanPage() {
  const navigate = useNavigate();
  const { enqueue, isOnline } = useAlojamentoOffline();
  const [mode, setMode] = useState<ScanMode>("checkin");
  const [manualCode, setManualCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const facilityId = getSelectedFacility();

  const extractToken = (input: string): string | null => {
    const trimmed = input.trim();
    if (trimmed.startsWith("JER-ALJ:")) return trimmed.slice(8);
    if (trimmed.length >= 8 && trimmed.length <= 20) return trimmed;
    return null;
  };

  const handleScan = useCallback(async (rawValue: string) => {
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

    setLoading(true);
    setResult(null);
    const deviceId = getDeviceId();

    try {
      if (!isOnline) {
        // Queue offline
        if (mode === "checkin") {
          enqueue("checkin", { token, facility_id: facilityId, mode: "person_qr" });
          toast.info("Check-in enfileirado (offline)");
        } else if (mode === "checkout") {
          enqueue("checkout", { token, facility_id: facilityId });
          toast.info("Check-out enfileirado (offline)");
        }
        setLoading(false);
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
        toast.success(mode === "validate" ? "QR válido" : mode === "checkin" ? "Check-in realizado!" : "Check-out realizado!");
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
    } finally {
      setLoading(false);
    }
  }, [mode, facilityId, isOnline, enqueue, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-2 border-b bg-card px-4 h-14">
        <button onClick={() => navigate("/pwa/alojamento")} className="text-muted-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <ScanLine className="h-5 w-5 text-primary" />
        <span className="font-semibold text-foreground">Scanner</span>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4">
        <Tabs value={mode} onValueChange={(v) => setMode(v as ScanMode)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="checkin">Check-in</TabsTrigger>
            <TabsTrigger value="checkout">Check-out</TabsTrigger>
            <TabsTrigger value="validate">Validar</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Keyboard className="h-4 w-4" />
              Digitar código
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="JER-ALJ:XXXXXXXXXXXX"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScan(manualCode)}
            />
            <Button
              className="w-full h-12"
              disabled={!manualCode.trim() || loading}
              onClick={() => handleScan(manualCode)}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Processar"}
            </Button>
          </CardContent>
        </Card>

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
    </div>
  );
}
