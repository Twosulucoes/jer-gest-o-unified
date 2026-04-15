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
  /** Called with the raw QR payload on successful detection */
  onScan: (payload: string) => void;
  /** Called when user closes the scanner */
  onClose: () => void;
  /** Controls visibility */
  isOpen: boolean;
  /** Allowed QR prefixes — rejects codes that don't match */
  allowedPrefixes?: string[];
  /** Title shown in the header */
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

  // Validate prefix
  const isValidPayload = useCallback(
    (raw: string) => {
      if (!allowedPrefixes?.length) return true;
      return allowedPrefixes.some((p) => raw.startsWith(p));
    },
    [allowedPrefixes]
  );

  // Handle detected code
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
    [onScan, isValidPayload]
  );

  // Stop scanner safely
  const stopScanner = useCallback(async () => {
    try {
      if (scannerRef.current) {
        const s = scannerRef.current;
        scannerRef.current = null;
        try { await s.stop(); } catch { /* may already be stopped */ }
        try { s.clear(); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    clearTimeout(hintTimer.current);
  }, []);

  // Start web scanner
  // Pre-request camera permission to preserve user gesture context
  const preRequestCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      // Stop immediately — we just needed to trigger the permission prompt within gesture context
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch {
      return false;
    }
  }, []);

  const startScanner = useCallback(
    async (front: boolean, skipPermission = false) => {
      setState("requesting");
      setErrorMsg("");
      setHintVisible(false);

      // Request camera permission directly (preserving gesture context)
      if (!skipPermission) {
        const granted = await preRequestCamera();
        if (!granted) {
          setState("error");
          setErrorMsg(
            "Acesso à câmera negado. Habilite nas configurações do navegador:\n\n" +
            "Android Chrome: Configurações → Privacidade → Câmera\n" +
            "iOS Safari: Ajustes → Safari → Câmera"
          );
          return;
        }
      }

      // Small delay to ensure DOM container exists
      await new Promise((r) => setTimeout(r, 50));

      const container = document.getElementById(containerId);
      if (!container) {
        setState("error");
        setErrorMsg("Contêiner de vídeo não encontrado. Tente novamente.");
        return;
      }

      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode(containerId, { verbose: false });
        scannerRef.current = scanner;

        const facingMode = front ? "user" : "environment";

        await scanner.start(
          { facingMode },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
            disableFlip: false,
          },
          (decodedText) => {
            handleDetected(decodedText);
          },
          () => {
            // continuous scan — ignore failures
          }
        );

        setState("active");

        // Show hint after 2 minutes of no detection
        hintTimer.current = setTimeout(() => setHintVisible(true), 120_000);
      } catch (err: any) {
        setState("error");
        if (
          err?.name === "NotAllowedError" ||
          err?.message?.includes("Permission") ||
          err?.message?.includes("NotAllowed")
        ) {
          setErrorMsg(
            "Acesso à câmera negado. Habilite nas configurações do navegador:\n\n" +
            "Android Chrome: Configurações → Privacidade → Câmera\n" +
            "iOS Safari: Ajustes → Safari → Câmera"
          );
        } else if (err?.name === "NotFoundError" || err?.message?.includes("NotFound")) {
          setErrorMsg("Câmera não encontrada neste dispositivo.");
        } else {
          setErrorMsg(err?.message || "Erro ao acessar câmera");
        }
      }
    },
    [containerId, handleDetected, preRequestCamera]
  );

  // Native scan (Capacitor MLKit)
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

  // Auto-start when opened
  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setState("idle");
      setManualMode(false);
      setTorchOn(false);
      setHintVisible(false);
      return;
    }
    if (isNativeApp()) {
      startNativeScan();
    } else {
      startScanner(false);
    }
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Camera flip
  const flipCamera = useCallback(async () => {
    await stopScanner();
    const next = !useFront;
    setUseFront(next);
    startScanner(next);
  }, [useFront, stopScanner, startScanner]);

  // Torch toggle
  const toggleTorch = useCallback(async () => {
    try {
      const videoEl = document.querySelector(`#${containerId} video`) as HTMLVideoElement;
      if (videoEl?.srcObject) {
        const track = (videoEl.srcObject as MediaStream).getVideoTracks()[0];
        const next = !torchOn;
        await (track as any).applyConstraints({ advanced: [{ torch: next }] });
        setTorchOn(next);
      }
    } catch {
      toast.info("Lanterna não suportada neste dispositivo");
    }
  }, [torchOn, containerId]);

  // Manual submit
  const handleManualSubmit = () => {
    const val = manualCode.trim();
    if (!val) return;
    handleDetected(val);
    setManualCode("");
  };

  // Close handler
  const handleClose = useCallback(() => {
    stopScanner();
    onClose();
  }, [stopScanner, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
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
            {/* Requesting */}
            {state === "requesting" && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Solicitando acesso à câmera…</p>
              </div>
            )}

            {/* Error */}
            {state === "error" && (
              <div className="flex flex-col items-center gap-4 max-w-sm text-center">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
                <p className="text-sm text-foreground whitespace-pre-line">{errorMsg}</p>
                <div className="flex gap-3">
                  <Button onClick={() => startScanner(useFront)} className="min-h-[44px]">
                    Tentar Novamente
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setManualMode(true)}
                    className="min-h-[44px]"
                  >
                    <Keyboard className="h-4 w-4 mr-2" />
                    Digitar Código
                  </Button>
                </div>
              </div>
            )}

            {/* Scanner viewport */}
            <div
              id={containerId}
              className={
                state === "active" || state === "requesting"
                  ? "w-full max-w-md aspect-square rounded-lg overflow-hidden bg-black relative"
                  : "hidden"
              }
            />

            {/* Hint after 2 min */}
            {hintVisible && state === "active" && (
              <p className="text-xs text-amber-500 mt-2 text-center animate-pulse">
                Aponte para o QR code da credencial
              </p>
            )}

            {/* Controls */}
            {state === "active" && (
              <div className="flex items-center justify-center gap-4 mt-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={flipCamera}
                  className="min-w-[44px] min-h-[44px]"
                  title="Alternar câmera"
                >
                  <SwitchCamera className="h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleTorch}
                  className="min-w-[44px] min-h-[44px]"
                  title="Lanterna"
                >
                  <Flashlight className={`h-5 w-5 ${torchOn ? "text-yellow-500" : ""}`} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => { stopScanner(); setManualMode(true); }}
                  className="min-w-[44px] min-h-[44px]"
                  title="Digitar código"
                >
                  <Keyboard className="h-5 w-5" />
                </Button>
              </div>
            )}

            {/* Idle state — shouldn't show normally since auto-start */}
            {state === "idle" && (
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Camera className="h-10 w-10 text-primary" />
                </div>
                <Button onClick={() => startScanner(useFront)} className="h-12 px-8 min-h-[44px]">
                  <Camera className="h-5 w-5 mr-2" />
                  Iniciar câmera
                </Button>
              </div>
            )}
          </>
        )}

        {/* Manual entry */}
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
                  startScanner(useFront);
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
            <Button
              className="w-full h-12 min-h-[44px]"
              disabled={!manualCode.trim()}
              onClick={handleManualSubmit}
            >
              Processar
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
