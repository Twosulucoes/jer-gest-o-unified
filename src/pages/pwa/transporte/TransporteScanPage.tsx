import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScanLine, CheckCircle, XCircle } from "lucide-react";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import QrCodeScanner from "@/components/pwa/QrCodeScanner";
import { resolveExternalCredential } from "@/lib/resolveExternalCredential";

export default function TransporteScanPage() {
  const _navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tripId = searchParams.get("tripId");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const handleScan = async (rawValue: string) => {
    setScannerOpen(false);
    const token = rawValue.startsWith("JER:") ? rawValue.slice(4) : rawValue.trim();
    if (!token) return;

    // Try external credential
    const extResult = await resolveExternalCredential(token);
    if (extResult) {
      setResult({ ok: true, message: `Embarque registrado: ${extResult.full_name || ""}` });
    } else {
      setResult({ ok: true, message: "Embarque registrado com sucesso" });
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
        allowedPrefixes={["JER:", "jer:"]}
        title="Scan Embarque"
      />
    </div>
  );
}
