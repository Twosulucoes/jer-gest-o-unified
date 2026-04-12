import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ScanLine, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

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
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
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

  const handleValidate = async () => {
    if (!code.trim() || !windowId) return;
    setLoading(true);
    setResult(null);
    try {
      // Look up participant by credential QR token
      const { data: cred } = await supabase
        .from("participant_credentials" as any)
        .select("participant_id, participant:participants(full_name, food_restrictions)")
        .eq("qr_token", code.trim())
        .single();

      if (!cred) {
        setResult({ ok: false, message: "Credencial não encontrada" });
        setLoading(false);
        return;
      }

      // Check for duplicate consumption in same window
      const { count } = await supabase
        .from("meal_consumptions")
        .select("id", { count: "exact", head: true })
        .eq("participant_id", (cred as any).participant_id)
        .eq("meal_window_id", windowId);

      if ((count || 0) > 0) {
        setResult({ ok: false, message: "Refeição já registrada nesta janela" });
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();

      const { error } = await supabase.from("meal_consumptions").insert({
        participant_id: (cred as any).participant_id,
        meal_window_id: windowId,
        method: "qr",
        registered_by: session?.user.id,
      });

      if (error) throw error;

      const restrictions = (cred as any).participant?.food_restrictions;
      setResult({
        ok: true,
        message: `Consumo registrado: ${(cred as any).participant?.full_name || ""}`,
        restrictions: restrictions || undefined,
      });
      setCode("");
    } catch {
      setResult({ ok: false, message: "Erro ao registrar consumo" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-2 border-b bg-card px-4 h-14">
        <button onClick={() => navigate("/pwa/alimentacao")} className="text-muted-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <ScanLine className="h-5 w-5 text-primary" />
        <span className="font-semibold text-foreground">Scan Refeição</span>
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

        <div className="flex gap-2">
          <Input
            placeholder="Código da credencial"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleValidate()}
            disabled={!windowId}
          />
          <Button onClick={handleValidate} disabled={loading || !code.trim() || !windowId}>
            Validar
          </Button>
        </div>

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
      </main>
    </div>
  );
}
