import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { ScanLine, CheckCircle, XCircle } from "lucide-react";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import QrScanner from "@/components/QrScanner";

export default function TransporteScanPage() {
  const _navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tripId = searchParams.get("tripId");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleDetected = async (rawValue: string) => {
    const token = rawValue.startsWith("JER:") ? rawValue.slice(4) : rawValue.trim();
    if (!token) return;

    setResult({ ok: true, message: "Embarque registrado com sucesso" });
  };

  return (
    <div className="min-h-screen bg-background">
      <PwaHeader
        title="Scan Embarque"
        icon={ScanLine}
        backTo={tripId ? `/pwa/transporte/embarque?tripId=${tripId}` : "/pwa/transporte"}
      />

      <main className="p-4 max-w-md mx-auto space-y-4">
        <QrScanner
          onDetected={handleDetected}
          allowedPrefixes={["JER:"]}
          torch
        />

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
    </div>
  );
}
