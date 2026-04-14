import { useState, useRef, useCallback, useEffect, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { isNativeApp } from "@/lib/runtime";
import { Camera, Keyboard, X, Flashlight, Loader2 } from "lucide-react";

interface QrScannerProps {
  onDetected: (payload: string) => void;
  onError?: (err: string) => void;
  allowedPrefixes?: string[];
  autoStart?: boolean;
  torch?: boolean;
  showManualEntry?: boolean;
}

export default function QrScanner({
  onDetected,
  onError,
  allowedPrefixes,
  autoStart = false,
  torch = false,
  showManualEntry = true,
}: QrScannerProps) {
  const scannerRegionId = useId().replace(/:/g, "-");
  const [scanning, setScanning] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const debounceRef = useRef(false);
  const scannerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopMediaStream = useCallback((stream?: MediaStream | null) => {
    stream?.getTracks().forEach((track) => track.stop());
  }, []);

  const validatePayload = useCallback(
    (raw: string): boolean => {
      if (!allowedPrefixes || allowedPrefixes.length === 0) return true;
      return allowedPrefixes.some((p) => raw.startsWith(p));
    },
    [allowedPrefixes]
  );

  const handleDetected = useCallback(
    (raw: string) => {
      if (debounceRef.current) return;
      if (!validatePayload(raw)) {
        const msg = "QR Code com prefixo inválido";
        toast.error(msg);
        onError?.(msg);
        return;
      }
      debounceRef.current = true;
      // Vibrate feedback
      if (navigator.vibrate) navigator.vibrate(50);
      onDetected(raw);
      setTimeout(() => {
        debounceRef.current = false;
      }, 1500);
    },
    [onDetected, onError, validatePayload]
  );

  // --- NATIVE SCAN (Capacitor) ---
  const startNativeScan = useCallback(async () => {
    setLoading(true);
    try {
      const { BarcodeScanner } = await import("@capacitor-mlkit/barcode-scanning");

      const { camera } = await BarcodeScanner.requestPermissions();
      if (camera !== "granted" && camera !== "limited") {
        setPermissionDenied(true);
        toast.error("Permissão de câmera negada");
        setLoading(false);
        return;
      }

      setScanning(true);
      setLoading(false);

      const result = await BarcodeScanner.scan();
      setScanning(false);

      if (result.barcodes.length > 0) {
        handleDetected(result.barcodes[0].rawValue);
      }
    } catch (err: any) {
      setScanning(false);
      setLoading(false);
      if (err?.message?.includes("canceled") || err?.message?.includes("cancelled")) {
        // User cancelled — no error
        return;
      }
      const msg = err?.message?.includes("barcode-scanning")
        ? "Scanner nativo não sincronizado. Atualize o app com npx cap sync."
        : err.message || "Erro ao abrir scanner nativo";
      toast.error(msg);
      onError?.(msg);
    }
  }, [handleDetected, onError]);

  // --- WEB SCAN (html5-qrcode) ---
  const stopWebScan = useCallback(async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch {
      // ignore
    }
    if (streamRef.current) {
      stopMediaStream(streamRef.current);
      streamRef.current = null;
    }
    setLoading(false);
    setScanning(false);
  }, [stopMediaStream]);

  const startWebScan = useCallback(async (preferredDeviceId?: string) => {
    setLoading(true);
    setPermissionDenied(false);
    setScanning(true);

    try {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      const { Html5Qrcode } = await import("html5-qrcode");

      // Ensure container exists
      const container = document.getElementById(scannerRegionId);
      if (!container) {
        throw new Error("Área do scanner não encontrada");
      }

      const scanner = new Html5Qrcode(scannerRegionId);
      scannerRef.current = scanner;

      await scanner.start(
        preferredDeviceId
          ? { deviceId: { exact: preferredDeviceId } }
          : { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText) => {
          handleDetected(decodedText);
          stopWebScan();
        },
        () => {
          // ignore decode failures (continuous scanning)
        }
      );

      setScanning(true);
      setLoading(false);
    } catch (err: any) {
      await stopWebScan();
      if (
        err?.message?.includes("Permission") ||
        err?.message?.includes("NotAllowed") ||
        err?.name === "NotAllowedError"
      ) {
        setPermissionDenied(true);
        toast.error("Permissão de câmera negada. Verifique as configurações do navegador.");
      } else {
        toast.error(err.message || "Erro ao iniciar câmera");
      }
      onError?.(err.message || "Erro ao iniciar câmera");
    }
  }, [handleDetected, onError, scannerRegionId, stopWebScan]);

  const startScan = useCallback(async () => {
    if (loading || scanning) return;

    if (isNativeApp()) {
      await startNativeScan();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      const msg = "Este dispositivo não oferece suporte ao acesso à câmera.";
      setPermissionDenied(true);
      toast.error(msg);
      onError?.(msg);
      return;
    }

    try {
      const warmupStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      const [track] = warmupStream.getVideoTracks();
      const preferredDeviceId = track?.getSettings?.().deviceId;
      stopMediaStream(warmupStream);

      await startWebScan(preferredDeviceId);
    } catch (err: any) {
      const denied =
        err?.name === "NotAllowedError" ||
        err?.name === "SecurityError" ||
        err?.message?.includes("Permission");

      setPermissionDenied(denied);
      const msg = denied
        ? "Permissão de câmera negada. Habilite o acesso nas configurações do navegador." 
        : err?.name === "NotFoundError"
          ? "Nenhuma câmera encontrada neste dispositivo."
          : err?.message || "Erro ao preparar câmera";

      toast.error(msg);
      onError?.(msg);
    }
  }, [loading, onError, scanning, startNativeScan, startWebScan, stopMediaStream]);

  // Auto-start
  useEffect(() => {
    if (autoStart) void startScan();
    return () => {
      void stopWebScan();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualSubmit = () => {
    const val = manualCode.trim();
    if (!val) return;
    handleDetected(val);
    setManualCode("");
  };

  // Toggle torch (web only via track constraints)
  const toggleTorch = useCallback(async () => {
    if (isNativeApp()) {
      try {
        const { BarcodeScanner } = await import("@capacitor-mlkit/barcode-scanning");
        await BarcodeScanner.toggleTorch();
        setTorchOn((prev) => !prev);
      } catch {
        /* unsupported */
      }
      return;
    }
    // web: try via video track
    try {
      const videoEl = document.querySelector("#qr-scanner-region video") as HTMLVideoElement;
      if (videoEl?.srcObject) {
        const track = (videoEl.srcObject as MediaStream).getVideoTracks()[0];
        const newVal = !torchOn;
        await (track as any).applyConstraints({ advanced: [{ torch: newVal }] });
        setTorchOn(newVal);
      }
    } catch {
      toast.info("Lanterna não suportada neste dispositivo");
    }
  }, [torchOn]);

  return (
    <div className="space-y-4">
      {/* Scanner area */}
      {!manualMode && (
        <Card>
          <CardContent className="p-4 space-y-4">
            {!scanning && !loading && (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Camera className="h-10 w-10 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Aponte a câmera para o QR Code
                </p>
                <Button onClick={() => void startScan()} className="h-12 px-8" size="lg">
                  <Camera className="h-5 w-5 mr-2" />
                  Iniciar câmera
                </Button>
                {permissionDenied && (
                  <p className="text-xs text-destructive text-center">
                    Câmera bloqueada. Habilite a permissão no navegador ou no app e tente novamente.
                  </p>
                )}
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Abrindo câmera…</p>
              </div>
            )}

            {/* Web scanner render target */}
            <div
              id={scannerRegionId}
              className={scanning && !isNativeApp() ? "w-full aspect-square rounded-lg overflow-hidden bg-muted" : "hidden"}
            />

            {scanning && (
              <div className="flex items-center justify-center gap-3">
                {torch && (
                  <Button variant="outline" size="icon" onClick={toggleTorch}>
                    <Flashlight className={`h-5 w-5 ${torchOn ? "text-yellow-500" : ""}`} />
                  </Button>
                )}
                <Button
                  variant="destructive"
                  onClick={() => {
                    stopWebScan();
                    setScanning(false);
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Manual entry */}
      {showManualEntry && (
        <>
          {!manualMode && !scanning && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setManualMode(true)}
            >
              <Keyboard className="h-4 w-4 mr-2" />
              Digitar código manualmente
            </Button>
          )}

          {manualMode && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Keyboard className="h-4 w-4" />
                    Digitar código
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setManualMode(false)}
                  >
                    Usar câmera
                  </Button>
                </div>
                <Input
                  placeholder="Digite ou cole o código"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
                  autoFocus
                />
                <Button
                  className="w-full h-12"
                  disabled={!manualCode.trim()}
                  onClick={handleManualSubmit}
                >
                  Processar
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
