import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ScanLine, CheckCircle, XCircle } from "lucide-react";

export default function TransporteScanPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tripId = searchParams.get("tripId");
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleValidate = async () => {
    if (!code.trim()) return;
    setLoading(true);
    // Placeholder — will integrate with RPC validate_boarding
    setTimeout(() => {
      setResult({ ok: true, message: "Embarque registrado com sucesso" });
      setLoading(false);
      setCode("");
    }, 800);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-2 border-b bg-card px-4 h-14">
        <button onClick={() => navigate(tripId ? `/pwa/transporte/embarque?tripId=${tripId}` : "/pwa/transporte")} className="text-muted-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <ScanLine className="h-5 w-5 text-primary" />
        <span className="font-semibold text-foreground">Scan Embarque</span>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4">
        <Card>
          <CardContent className="p-6 text-center space-y-4">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
              <ScanLine className="h-10 w-10 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              Aponte a câmera para o QR Code da credencial ou digite o código manualmente
            </p>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Input
            placeholder="Código da credencial"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleValidate()}
          />
          <Button onClick={handleValidate} disabled={loading || !code.trim()}>
            Validar
          </Button>
        </div>

        {result && (
          <Card className={result.ok ? "border-green-500/50" : "border-destructive/50"}>
            <CardContent className="p-4 flex items-center gap-3">
              {result.ok ? (
                <CheckCircle className="h-6 w-6 text-green-500 shrink-0" />
              ) : (
                <XCircle className="h-6 w-6 text-destructive shrink-0" />
              )}
              <span className="text-sm font-medium">{result.message}</span>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
