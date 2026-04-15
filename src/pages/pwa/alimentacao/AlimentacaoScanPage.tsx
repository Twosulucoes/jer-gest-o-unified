import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ScanLine, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import QrCodeScanner from "@/components/pwa/QrCodeScanner";
import { resolveExternalCredential } from "@/lib/resolveExternalCredential";

interface MealWindow {
  id: string;
  meal_type: { name: string } | null;
  window_start: string;
  window_end: string;
}

export default function AlimentacaoScanPage() {
  const navigate = useNavigate();
  const [windows, setWindows] = useState<MealWindow[]>([]);
  const [windowId, setWindowId] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; restrictions?: string } | null>(null);

  useEffect(() => {
    (async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("meal_windows")
        .select("id, meal_type:meal_types(name), window_start, window_end")
        .lte("window_start", now)
        .gte("window_end", now)
        .order("window_start");
      const list = (data as any) || [];
      setWindows(list);
      if (list.length === 1) setWindowId(list[0].id);
    })();
  }, []);

  const handleScan = async (rawValue: string) => {
    setScannerOpen(false);
    const code = rawValue.startsWith("JER:") ? rawValue.slice(4) : rawValue.trim();
    if (!code || !windowId) {
      if (!windowId) toast.error("Selecione uma janela de refeição primeiro");
      return;
    }

    try {
      // Try external credential first
      const extResult = await resolveExternalCredential(code);
      let participantId: string | null = null;
      let participantName: string | null = null;
      let foodRestrictions: string | null = null;

      if (extResult) {
        participantId = extResult.participant_id;
        participantName = extResult.full_name;
        // Fetch food restrictions
        const { data: pData } = await supabase
          .from("participants")
          .select("food_restrictions")
          .eq("id", participantId)
          .maybeSingle();
        foodRestrictions = (pData as any)?.food_restrictions ?? null;
      } else {
        // Fallback to native credential
        const { data: cred } = await supabase
          .from("participant_credentials" as any)
          .select("participant_id, participant:participants(full_name, food_restrictions)")
          .or(`qr_token.eq.${code},credential_code.eq.${code},qr_code_value.eq.${rawValue}`)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();

        if (!cred) {
          setResult({ ok: false, message: "Credencial não encontrada" });
          return;
        }
        participantId = (cred as any).participant_id;
        participantName = (cred as any).participant?.full_name || "";
        foodRestrictions = (cred as any).participant?.food_restrictions || null;
      }

      if (!participantId) {
        setResult({ ok: false, message: "Credencial não encontrada" });
        return;
      }

      const { count } = await supabase
        .from("meal_consumptions")
        .select("id", { count: "exact", head: true })
        .eq("participant_id", participantId)
        .eq("meal_window_id", windowId);

      if ((count || 0) > 0) {
        setResult({ ok: false, message: "Refeição já registrada nesta janela" });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();

      const { error } = await supabase.from("meal_consumptions").insert({
        participant_id: participantId,
        meal_window_id: windowId,
        method: "qr_scan",
        registered_by: session?.user.id,
      });

      if (error) throw error;

      setResult({
        ok: true,
        message: `Consumo registrado: ${participantName || ""}`,
        restrictions: foodRestrictions || undefined,
      });
      if (navigator.vibrate) navigator.vibrate(200);
    } catch {
      setResult({ ok: false, message: "Erro ao registrar consumo" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b bg-card px-4 h-14">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/pwa/alimentacao")} className="text-muted-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <ScanLine className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">Scan Refeição</span>
        </div>
        <Button size="sm" onClick={() => setScannerOpen(true)} disabled={!windowId}>
          <ScanLine className="h-4 w-4 mr-1" /> Scan
        </Button>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4">
        {windows.length === 0 ? (
          <Card className="border-amber-500/50">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0" />
              <span className="text-sm">Nenhuma janela de refeição aberta no momento</span>
            </CardContent>
          </Card>
        ) : (
          <Select value={windowId} onValueChange={setWindowId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a janela" />
            </SelectTrigger>
            <SelectContent>
              {windows.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.meal_type?.name || "Refeição"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {result && (
          <Card className={result.ok ? "border-green-500/50" : "border-destructive/50"}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-3">
                {result.ok ? <CheckCircle className="h-6 w-6 text-green-500 shrink-0" /> : <XCircle className="h-6 w-6 text-destructive shrink-0" />}
                <span className="text-sm font-medium">{result.message}</span>
              </div>
              {result.restrictions && (
                <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="text-xs text-amber-700 dark:text-amber-400">Restrição: {result.restrictions}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Button
          variant="outline"
          className="w-full min-h-[44px]"
          onClick={() => setScannerOpen(true)}
          disabled={!windowId}
        >
          <ScanLine className="h-4 w-4 mr-2" />
          Escanear QR Code
        </Button>
      </main>

      <QrCodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        title="Scan Refeição"
      />
    </div>
  );
}
