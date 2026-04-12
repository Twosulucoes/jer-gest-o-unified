import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ScanLine, CheckCircle, XCircle } from "lucide-react";
import QrScanner from "@/components/QrScanner";

export default function TransporteScanPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tripId = searchParams.get("tripId");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleDetected = async (rawValue: string) => {
    // Extract token from JER: prefix
    const token = rawValue.startsWith("JER:") ? rawValue.slice(4) : rawValue.trim();
    if (!token) return;

    // Placeholder — will integrate with RPC validate_boarding
    setResult({ ok: true, message: "Embarque registrado com sucesso" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-2 border-b bg-card px-4 h-14">
        <button
          onClick={() => navigate(tripId ? `/pwa/transporte/embarque?tripId=${tripId}` : "/pwa/transporte")}
          className="text-muted-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <ScanLine className="h-5 w-5 text-primary" />
        <span className="font-semibold text-foreground">Scan Embarque</span>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4">
        <QrScanner
          onDetected={handleDetected}
          allowedPrefixes={["JER:"]}
          torch
        />

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
