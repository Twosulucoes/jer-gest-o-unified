import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { isNativeApp } from "@/lib/runtime";
import {
  Camera,
  Keyboard,
  X,
  Flashlight,
  Loader2,
  SwitchCamera,
  AlertTriangle,
} from "lucide-react";

interface QrCodeScannerProps {
  onScan: (payload: string) => void;
  onClose: () => void;
  isOpen: boolean;
  allowedPrefixes?: string[];
  title?: string;
}

type ScanState = "requesting" | "active" | "error" | "idle";

export default function QrCodeScanner({
  onScan,
  onClose,
  isOpen,
  allowedPrefixes,
  title = "Scanner QR",
}: QrCodeScannerProps) {
  const [state, setState] = useState<ScanState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const [useFront, setUseFront] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);

  const scannerRef = useRef<any>(null);
  const debounceRef = useRef(false);
  const containerId = useRef(`qr-scanner-${Math.random().toString(36).slice(2, 8)}`).current;
  const hintTimer = useRef<ReturnType<typeof setTimeout>>();

  const isValidPayload = useCallback(
    (raw: string) => {
      if (!allowedPrefixes?.length) return true;
      return allowedPrefixes.some((p) => raw.startsWith(p));
    },
    [allowedPrefixes],
  );

  const handleDetected = useCallback(
    (raw: string) => {
      if (debounceRef.current) return;
      if (!isValidPayload(raw)) {
        toast.error("Código inválido — QR não reconhecido pelo sistema");
        return;
      }
      debounceRef.current = true;
      if (navigator.vibrate) navigator.vibrate(100);
      onScan(raw);
      setTimeout(() => {
        debounceRef.current = false;
      }, 2000);
    },
    [onScan, isValidPayload],
  );

  const stopScanner = useCallback(async () => {
    clearTimeout(hintTimer.current);
    try {
      if (scannerRef.current) {
        const scanner = scannerRef.current;
        scannerRef.current = null;
        try {
          await scanner.stop();
        } catch {
          // ignore
        }
        try {
          await scanner.clear();
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const startScanner = useCallback(
    async (front: boolean) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState("error");
        setErrorMsg("Este dispositivo não oferece suporte ao acesso à câmera.");
        return;
      }

      setState("requesting");
      setErrorMsg("");
      setHintVisible(false);
      await stopScanner();

      try {
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        const container = document.getElementById(containerId);
        if (!container) throw new Error("Contêiner de vídeo não encontrado. Tente novamente.");

        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode(containerId, { verbose: false });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: front ? "user" : "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
            disableFlip: false,
          },
          (decodedText) => {
            void stopScanner();
            handleDetected(decodedText);
          },
          () => {
            // leitura contínua
          },
        );

        setState("active");
        hintTimer.current = setTimeout(() => setHintVisible(true), 120_000);
      } catch (err: any) {
        await stopScanner();
        setState("error");
        if (
          err?.name === "NotAllowedError" ||
          err?.message?.includes("Permission") ||
          err?.message?.includes("NotAllowed")
        ) {
          setErrorMsg(
            "Acesso à câmera negado. Habilite nas configurações do navegador:\n\n" +
              "Android Chrome: Configurações → Privacidade → Câmera\n" +
              "iOS Safari: Ajustes → Safari → Câmera",
          );
        } else if (err?.name === "NotFoundError" || err?.message?.includes("NotFound")) {
          setErrorMsg("Câmera não encontrada neste dispositivo.");
        } else {
          setErrorMsg(err?.message || "Erro ao acessar câmera");
        }
      }
    },
    [containerId, handleDetected, stopScanner],
  );

  const startNativeScan = useCallback(async () => {
    setState("requesting");
    try {
      const { BarcodeScanner } = await import("@capacitor-mlkit/barcode-scanning");
      const { camera } = await BarcodeScanner.requestPermissions();
      if (camera !== "granted" && camera !== "limited") {
        setState("error");
        setErrorMsg("Permissão de câmera negada no app.");
        return;
      }
      setState("active");
      const result = await BarcodeScanner.scan();
      if (result.barcodes.length > 0) {
        handleDetected(result.barcodes[0].rawValue);
      }
      setState("idle");
    } catch (err: any) {
      if (err?.message?.includes("cancel")) {
        setState("idle");
        return;
      }
      setState("error");
      setErrorMsg(err?.message || "Erro no scanner nativo");
    }
  }, [handleDetected]);

  useEffect(() => {
    if (!isOpen) {
      void stopScanner();
      setState("idle");
      setManualMode(false);
      setTorchOn(false);
      setHintVisible(false);
      return;
    }

    if (isNativeApp()) {
      void startNativeScan();
    } else {
      setState("idle");
    }

    return () => {
      void stopScanner();
    };
  }, [isOpen, startNativeScan, stopScanner]);

  const flipCamera = useCallback(async () => {
    const next = !useFront;
    setUseFront(next);
    await startScanner(next);
  }, [useFront, startScanner]);

  const toggleTorch = useCallback(async () => {
    try {
      const videoEl = document.querySelector(`#${containerId} video`) as HTMLVideoElement | null;
      if (videoEl?.srcObject) {
        const track = (videoEl.srcObject as MediaStream).getVideoTracks()[0];
        const next = !torchOn;
        await (track as MediaStreamTrack & { applyConstraints: (c: MediaTrackConstraints) => Promise<void> }).applyConstraints({
          advanced: [{ torch: next } as any],
        });
        setTorchOn(next);
      }
    } catch {
      toast.info("Lanterna não suportada neste dispositivo");
    }
  }, [torchOn, containerId]);

  const handleManualSubmit = () => {
    const val = manualCode.trim();
    if (!val) return;
    handleDetected(val);
    setManualCode("");
  };

  const handleClose = useCallback(() => {
    void stopScanner();
    onClose();
  }, [stopScanner, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 h-14 border-b bg-card shrink-0">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">{title}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={handleClose} className="min-w-[44px] min-h-[44px]">
          <X className="h-5 w-5" />
        </Button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4 overflow-auto">
        {!manualMode && (
          <>
            {state === "requesting" && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Abrindo câmera…</p>
              </div>
            )}

            {state === "error" && (
              <div className="flex flex-col items-center gap-4 max-w-sm text-center">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
                <p className="text-sm text-foreground whitespace-pre-line">{errorMsg}</p>
                <div className="flex gap-3">
                  <Button onClick={() => void startScanner(useFront)} className="min-h-[44px]">
                    Tentar Novamente
                  </Button>
                  <Button variant="outline" onClick={() => setManualMode(true)} className="min-h-[44px]">
                    <Keyboard className="h-4 w-4 mr-2" />
                    Digitar Código
                  </Button>
                </div>
              </div>
            )}

            <div
              id={containerId}
              className={state === "active" || state === "requesting" ? "w-full max-w-md aspect-square rounded-lg overflow-hidden bg-black relative" : "hidden"}
            />

            {hintVisible && state === "active" && (
              <p className="text-xs text-warning mt-2 text-center animate-pulse">
                Aponte para o QR code da credencial
              </p>
            )}

            {state === "active" && (
              <div className="flex items-center justify-center gap-4 mt-4">
                <Button variant="outline" size="icon" onClick={() => void flipCamera()} className="min-w-[44px] min-h-[44px]" title="Alternar câmera">
                  <SwitchCamera className="h-5 w-5" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => void toggleTorch()} className="min-w-[44px] min-h-[44px]" title="Lanterna">
                  <Flashlight className={`h-5 w-5 ${torchOn ? "text-primary" : ""}`} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    void stopScanner();
                    setManualMode(true);
                    setState("idle");
                  }}
                  className="min-w-[44px] min-h-[44px]"
                  title="Digitar código"
                >
                  <Keyboard className="h-5 w-5" />
                </Button>
              </div>
            )}

            {state === "idle" && (
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Camera className="h-10 w-10 text-primary" />
                </div>
                <Button onClick={() => void startScanner(useFront)} className="h-12 px-8 min-h-[44px]">
                  <Camera className="h-5 w-5 mr-2" />
                  Iniciar câmera
                </Button>
              </div>
            )}
          </>
        )}

        {manualMode && (
          <div className="w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2">
                <Keyboard className="h-4 w-4" />
                Digitar código
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setManualMode(false);
                  void startScanner(useFront);
                }}
              >
                Usar câmera
              </Button>
            </div>
            <Input
              placeholder="Digite ou cole o código da credencial"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
              autoFocus
              className="h-12 text-base"
            />
            <Button className="w-full h-12 min-h-[44px]" disabled={!manualCode.trim()} onClick={handleManualSubmit}>
              Processar
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
