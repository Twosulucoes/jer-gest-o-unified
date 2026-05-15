import { useState } from "react";
import Tesseract from "tesseract.js";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import {
  ScanLine,
  CheckCircle,
  SkipForward,
  Camera,
} from "lucide-react";

import QrCodeScanner from "@/components/pwa/QrCodeScanner";
import PwaLayout from "@/components/pwa/PwaLayout";

export default function VinculacaoMassaPage() {
  const [scannerOpen, setScannerOpen] = useState(false);

  const [codigo, setCodigo] = useState("");

  const [textoLido, setTextoLido] = useState("");

  const [loadingOCR, setLoadingOCR] = useState(false);

  const [vinculados, setVinculados] = useState(0);

  async function handleScan(value: string) {
    setScannerOpen(false);

    if (!value) return;

    setCodigo(value);
  }

  async function confirmar() {
    setVinculados((v) => v + 1);

    setCodigo("");
    setTextoLido("");

    setTimeout(() => {
      setScannerOpen(true);
    }, 500);
  }

  async function lerImagem(file: File) {
    try {
      setLoadingOCR(true);

      const result = await Tesseract.recognize(
        file,
        "por"
      );

      setTextoLido(result.data.text);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOCR(false);
    }
  }

  return (
    <PwaLayout
      backTo="/pwa/credenciamento"
      moduleTitle="Vinculação em Massa"
    >
      <main className="max-w-md mx-auto p-4 space-y-4">

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              Vinculados hoje
            </p>

            <p className="text-4xl font-black">
              {vinculados}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-4">

            <Button
              className="w-full h-16 text-lg font-bold"
              onClick={() => setScannerOpen(true)}
            >
              <ScanLine className="mr-2 h-6 w-6" />
              Escanear QR
            </Button>

            <label className="block">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];

                  if (!file) return;

                  await lerImagem(file);
                }}
              />

              <div className="w-full h-16 border rounded-xl flex items-center justify-center font-bold cursor-pointer">
                <Camera className="mr-2 h-5 w-5" />
                Fotografar crachá
              </div>
            </label>

          </CardContent>
        </Card>

        {(codigo || textoLido) && (
          <Card>
            <CardContent className="p-4 space-y-4">

              {!!codigo && (
                <div>
                  <p className="text-xs uppercase text-muted-foreground">
                    QR encontrado
                  </p>

                  <p className="font-mono text-xl font-bold break-all">
                    {codigo}
                  </p>
                </div>
              )}

              {!!textoLido && (
                <div>
                  <p className="text-xs uppercase text-muted-foreground">
                    Texto lido pela IA
                  </p>

                  <pre className="text-sm whitespace-pre-wrap">
                    {textoLido}
                  </pre>
                </div>
              )}

              {loadingOCR && (
                <p className="text-sm">
                  Lendo crachá...
                </p>
              )}

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
                  setTextoLido("");
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