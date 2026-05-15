import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScanLine, CheckCircle, SkipForward } from "lucide-react";
import QrCodeScanner from "@/components/pwa/QrCodeScanner";
import PwaLayout from "@/components/pwa/PwaLayout";

export default function VinculacaoMassaPage() {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [vinculados, setVinculados] = useState(0);

  const handleScan = async (value: string) => {
    setScannerOpen(false);

    if (!value) return;

    setCodigo(value);
  };

  const confirmar = async () => {
    setVinculados((v) => v + 1);

    setCodigo("");

    setTimeout(() => {
      setScannerOpen(true);
    }, 500);
  };

  return (
    <PwaLayout
      backTo="/pwa/credenciamento"
      moduleTitle="Vinculação em Massa"
    >
      <main className="max-w-md mx-auto p-4 space-y-4">
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              Vinculados hoje
            </p>

            <p className="text-3xl font-black">
              {vinculados}
            </p>
          </CardContent>
        </Card>

        {!codigo ? (
          <Button
            className="w-full h-16 text-lg font-bold"
            onClick={() => setScannerOpen(true)}
          >
            <ScanLine className="mr-2 h-6 w-6" />
            Escanear próximo crachá
          </Button>
        ) : (
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase">
                  QR encontrado
                </p>

                <p className="font-mono text-xl font-bold break-all">
                  {codigo}
                </p>
              </div>

              <Button
                className="w-full h-14 text-lg font-bold"
                onClick={confirmar}
              >
                <CheckCircle className="mr-2 h-5 w-5" />
                Confirmar e próximo
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setCodigo("");
                  setScannerOpen(true);
                }}
              >
                <SkipForward className="mr-2 h-4 w-4" />
                Pular
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      <QrCodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        title="Escanear QR"
      />
    </PwaLayout>
  );
}
