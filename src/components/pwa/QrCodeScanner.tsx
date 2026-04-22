import { useState, useRef, useCallback, useEffect } from "react";
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
  Search,
  ArrowLeft,
  Check,
  CheckCircle2,
  Trash2,
} from "lucide-react";

interface QrCodeScannerProps {
  onScan: (payload: string) => void;
  onClose: () => void;
  isOpen: boolean;
  allowedPrefixes?: string[];
  title?: string;
  /** When true, scanner keeps camera active after each scan for continuous operation */
  continuous?: boolean;
}

type ScanState = "requesting" | "active" | "error" | "idle";

export default function QrCodeScanner({
  onScan,
  onClose,
  isOpen,
  allowedPrefixes,
  title = "Escanear QR",
  continuous = false,
}: QrCodeScannerProps) {
  const [state, setState] = useState<ScanState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualError, setManualError] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [useFront, setUseFront] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);

  const scannerRef = useRef<any>(null);
  const debounceRef = useRef(false);
  const lastScannedRef = useRef("");
  const containerId = useRef(`qr-scanner-${Math.random().toString(36).slice(2, 8)}`).current;
  const hintTimer = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(true);

  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const continuousRef = useRef(continuous);
  continuousRef.current = continuous;
  const allowedPrefixesRef = useRef(allowedPrefixes);
  allowedPrefixesRef.current = allowedPrefixes;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const stopScanner = useCallback(async () => {
    clearTimeout(hintTimer.current);
    try {
      if (scannerRef.current) {
        const scanner = scannerRef.current;
        scannerRef.current = null;
        try { await scanner.stop(); } catch { /* ignore */ }
        try { await scanner.clear(); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }, []);

  const isValidPayload = useCallback((raw: string) => {
    const prefs = allowedPrefixesRef.current;
    if (!prefs?.length) return true;
    return prefs.some((p) => raw.toUpperCase().startsWith(p.toUpperCase()));
  }, []);

  const handleDetected = useCallback(
    (raw: string) => {
      if (debounceRef.current) return;
      if (!isValidPayload(raw)) {
        toast.error("Código inválido — QR não reconhecido pelo sistema");
        return;
      }
      if (raw === lastScannedRef.current) return;

      debounceRef.current = true;
      lastScannedRef.current = raw;
      if (navigator.vibrate) navigator.vibrate(100);

      if (!continuousRef.current) {
        void stopScanner();
      }

      onScanRef.current(raw);

      setTimeout(() => {
        debounceRef.current = false;
        lastScannedRef.current = "";
      }, 2500);
    },
    [isValidPayload, stopScanner],
  );

  const handleDetectedRef = useRef(handleDetected);
  handleDetectedRef.current = handleDetected;

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
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        await new Promise<void>((r) => requestAnimationFrame(() => r()));

        if (!mountedRef.current) return;

        let container = document.getElementById(containerId);
        if (!container) {
          await new Promise<void>((r) => setTimeout(r, 250));
          container = document.getElementById(containerId);
          if (!container) {
            throw new Error("Contêiner de vídeo não encontrado. Tente novamente.");
          }
        }

        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode(containerId, { verbose: false });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: front ? "user" : "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1, disableFlip: false },
          (decodedText) => handleDetectedRef.current(decodedText),
          () => { /* continuous scan */ },
        );

        if (mountedRef.current) {
          setState("active");
          hintTimer.current = setTimeout(() => {
            if (mountedRef.current) setHintVisible(true);
          }, 120_000);
        }
      } catch (err: any) {
        await stopScanner();
        if (!mountedRef.current) return;
        setState("error");
        if (err?.name === "NotAllowedError" || err?.message?.includes("Permission") || err?.message?.includes("NotAllowed")) {
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
    [containerId, stopScanner],
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
        handleDetectedRef.current(result.barcodes[0].rawValue);
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
  }, []);

  useEffect(() => {
    if (!isOpen) {
      void stopScanner();
      setState("idle");
      setManualMode(false);
      setTorchOn(false);
      setHintVisible(false);
      lastScannedRef.current = "";
      return;
    }

    if (isNativeApp()) {
      void startNativeScan();
    } else {
      void startScanner(false);
    }

    return () => { void stopScanner(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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
        await (track as any).applyConstraints({ advanced: [{ torch: next } as any] });
        setTorchOn(next);
      }
    } catch {
      toast.info("Lanterna não suportada neste dispositivo");
    }
  }, [torchOn, containerId]);

  const handleManualSubmit = useCallback(() => {
    const val = manualCode.trim().toUpperCase();
    if (!val) {
      setManualError("CÓDIGO VAZIO");
      return;
    }
    
    setManualError("");
    
    if (!isValidPayload(val)) {
      setManualError("PADRÃO INVÁLIDO");
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      return;
    }

    setIsValidating(true);
    if (navigator.vibrate) navigator.vibrate(50);
    
    setTimeout(() => {
      if (mountedRef.current) {
        setIsValidating(false);
        handleDetectedRef.current(val);
        setManualCode("");
      }
    }, 600);
  }, [manualCode, isValidPayload]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setManualCode(val.toUpperCase());
    if (manualError) setManualError("");
  };

  const handleClose = useCallback(() => {
    void stopScanner();
    onClose();
  }, [stopScanner, onClose]);

  if (!isOpen) return null;

  const accent = "hsl(var(--tac-accent))";
  const muted = "hsl(var(--tac-muted))";

  return (
    <div
      className="tactical-cockpit fixed inset-0 z-50 flex flex-col text-white"
      style={{ background: "hsl(var(--tac-bg))" }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-5 border-b shrink-0"
        style={{
          background: "hsl(var(--tac-surface))",
          borderColor: "hsl(var(--tac-border))",
          height: "calc(56px + env(safe-area-inset-top, 0px))",
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        <button
          onClick={handleClose}
          className="flex items-center gap-2 -ml-2 px-3 h-11 rounded-lg transition-colors hover:bg-white/5 active:scale-95"
          style={{ color: muted }}
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-widest">Voltar</span>
        </button>
        <div className="flex flex-col items-end">
          <span className="font-semibold text-sm tracking-wide leading-none">{title}</span>
          <span className="text-[10px] mt-1 font-mono uppercase tracking-[0.18em]" style={{ color: muted }}>
            Credencial / Voucher
          </span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-auto" style={{ background: "hsl(var(--tac-bg))" }}>
        {!manualMode && (
          <>
            {/* Viewfinder area */}
            <div className="flex-1 relative flex flex-col items-center justify-center px-6 py-8 min-h-0">
              {state === "requesting" && (
                <div className="flex flex-col items-center gap-3 absolute inset-0 justify-center z-20 pointer-events-none">
                  <Loader2 className="h-10 w-10 animate-spin" style={{ color: accent }} />
                  <p className="text-xs font-mono uppercase tracking-widest" style={{ color: muted }}>
                    Iniciando câmera…
                  </p>
                </div>
              )}

              {state === "error" && (
                <div className="flex flex-col items-center gap-5 max-w-sm text-center tac-rise">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center border"
                    style={{
                      background: "hsl(var(--tac-danger) / 0.1)",
                      borderColor: "hsl(var(--tac-danger) / 0.4)",
                    }}
                  >
                    <AlertTriangle className="h-8 w-8" style={{ color: "hsl(var(--tac-danger))" }} />
                  </div>
                  <p className="text-sm whitespace-pre-line leading-relaxed" style={{ color: "hsl(0 0% 88%)" }}>
                    {errorMsg}
                  </p>
                  <div className="flex gap-3 w-full">
                    <button
                      onClick={() => void startScanner(useFront)}
                      className="flex-1 h-12 rounded-lg font-bold text-sm uppercase tracking-tight active:scale-[0.98] transition-transform"
                      style={{ background: accent, color: "hsl(var(--tac-bg))" }}
                    >
                      Tentar de novo
                    </button>
                    <button
                      onClick={() => setManualMode(true)}
                      className="flex-1 h-12 rounded-lg font-bold text-sm uppercase tracking-tight border flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                      style={{ borderColor: "hsl(var(--tac-border))", color: "white" }}
                    >
                      <Keyboard className="h-4 w-4" />
                      Digitar
                    </button>
                  </div>
                </div>
              )}

              {/* Viewfinder bracket frame (always present so html5-qrcode finds the container) */}
              <div className="relative w-full max-w-xs aspect-square">
                {/* Camera surface */}
                <div
                  id={containerId}
                  className={
                    state === "active" || state === "requesting"
                      ? "absolute inset-0 rounded-2xl overflow-hidden bg-black"
                      : "absolute -z-10 opacity-0 w-px h-px overflow-hidden"
                  }
                />

                {(state === "active" || state === "requesting") && (
                  <>
                    {/* Corner brackets */}
                    {[
                      "top-0 left-0 border-t-2 border-l-2 rounded-tl-lg",
                      "top-0 right-0 border-t-2 border-r-2 rounded-tr-lg",
                      "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg",
                      "bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg",
                    ].map((cls, i) => (
                      <div
                        key={i}
                        className={`absolute w-7 h-7 ${cls}`}
                        style={{ borderColor: accent }}
                      />
                    ))}
                    {/* Animated scan line */}
                    {state === "active" && (
                      <div className="absolute inset-3 overflow-hidden rounded-lg pointer-events-none">
                        <div className="tac-scan-line" />
                      </div>
                    )}
                  </>
                )}

                {state === "idle" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed" style={{ borderColor: "hsl(var(--tac-border))" }}>
                    <div
                      className="w-20 h-20 rounded-2xl flex items-center justify-center"
                      style={{ background: "hsl(var(--tac-accent) / 0.08)", border: `1px solid hsl(var(--tac-accent) / 0.25)` }}
                    >
                      <Camera className="h-9 w-9" style={{ color: accent }} />
                    </div>
                    <button
                      onClick={() => void startScanner(useFront)}
                      className="h-11 px-6 rounded-lg font-bold text-sm uppercase tracking-tight active:scale-[0.98] transition-transform"
                      style={{ background: accent, color: "hsl(var(--tac-bg))" }}
                    >
                      Iniciar câmera
                    </button>
                  </div>
                )}
              </div>

              {/* Status badge */}
              {state === "active" && (
                <div
                  className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border"
                  style={{
                    background: "hsl(var(--tac-accent) / 0.1)",
                    borderColor: "hsl(var(--tac-accent) / 0.35)",
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accent }} />
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: accent }}>
                    Câmera ativa
                  </span>
                </div>
              )}

              {hintVisible && state === "active" && (
                <p className="text-xs mt-3 text-center animate-pulse font-medium" style={{ color: muted }}>
                  Aponte para o QR code da credencial
                </p>
              )}

              {state === "active" && (
                <div className="flex items-center justify-center gap-3 mt-5">
                  <button
                    onClick={() => void flipCamera()}
                    className="w-11 h-11 rounded-lg border flex items-center justify-center active:scale-95 transition-transform"
                    style={{ borderColor: "hsl(var(--tac-border))", background: "hsl(var(--tac-surface))", color: muted }}
                    title="Alternar câmera"
                  >
                    <SwitchCamera className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => void toggleTorch()}
                    className="w-11 h-11 rounded-lg border flex items-center justify-center active:scale-95 transition-transform"
                    style={{
                      borderColor: torchOn ? "hsl(var(--tac-accent) / 0.6)" : "hsl(var(--tac-border))",
                      background: torchOn ? "hsl(var(--tac-accent) / 0.12)" : "hsl(var(--tac-surface))",
                      color: torchOn ? accent : muted,
                    }}
                    title="Lanterna"
                  >
                    <Flashlight className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => {
                      void stopScanner();
                      setManualMode(true);
                      setState("idle");
                    }}
                    className="h-11 px-4 rounded-lg border flex items-center gap-2 active:scale-95 transition-transform"
                    style={{ borderColor: "hsl(var(--tac-border))", background: "hsl(var(--tac-surface))", color: "white" }}
                    title="Buscar manualmente"
                  >
                    <Keyboard className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-tight">Manual</span>
                  </button>
                </div>
              )}
            </div>

            {/* Manual fallback footer */}
            <div
              className="px-4 pt-3 pb-4 border-t shrink-0"
              style={{
                background: "hsl(var(--tac-surface))",
                borderColor: "hsl(var(--tac-border))",
                paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
              }}
            >
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] mb-2 px-1" style={{ color: muted }}>
                ou buscar manualmente
              </p>
              <button
                onClick={() => {
                  void stopScanner();
                  setManualMode(true);
                  setState("idle");
                }}
                className="w-full h-12 rounded-lg border flex items-center gap-3 px-4 transition-colors hover:bg-white/[0.03]"
                style={{ borderColor: "hsl(var(--tac-border))", background: "hsl(var(--tac-bg))" }}
              >
                <Search className="h-4 w-4 shrink-0" style={{ color: muted }} />
                <span className="text-sm font-mono" style={{ color: muted }}>
                  Buscar por nome ou CPF…
                </span>
              </button>
            </div>
          </>
        )}

        {manualMode && (
          <div className="flex-1 flex flex-col px-6 py-8 tac-rise max-w-lg mx-auto w-full carbon-texture">
            <div className="flex items-center justify-between mb-10">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Keyboard className="h-4 w-4" style={{ color: accent }} />
                  <span className="text-xs font-mono font-bold uppercase tracking-[0.25em]" style={{ color: accent }}>
                    MODO MANUAL
                  </span>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-[0.1em]" style={{ color: muted }}>
                  CONSO-01 // FIELD INPUT
                </span>
              </div>
              <button
                onClick={() => {
                  setManualMode(false);
                  void startScanner(useFront);
                }}
                className="text-[10px] font-bold uppercase tracking-[0.15em] px-4 h-9 rounded border-2 active:scale-95 transition-all flex items-center gap-2"
                style={{ borderColor: "hsl(var(--tac-border))", background: "hsl(var(--tac-surface))", color: "white" }}
              >
                <Camera className="h-3.5 w-3.5" />
                Câmera
              </button>
            </div>

            <div className="space-y-6 flex-1">
              <div className="relative group">
                <label className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] mb-2 block px-1" style={{ color: muted }}>
                  CÓDIGO DA CREDENCIAL / VOUCHER
                </label>
                
                <div className="relative">
                  <input
                    autoFocus
                    value={manualCode}
                    onChange={handleInputChange}
                    onKeyDown={(e) => e.key === "Enter" && !isValidating && handleManualSubmit()}
                    placeholder="DIGITE O CÓDIGO…"
                    className="w-full h-16 px-4 pr-12 rounded-xl border-2 outline-none text-xl font-mono transition-all focus:ring-4 focus:ring-[hsl(var(--tac-accent)/0.15)] placeholder:opacity-30"
                    style={{
                      background: "hsl(var(--tac-surface))",
                      borderColor: manualError ? "hsl(var(--tac-danger)/0.6)" : "hsl(var(--tac-border))",
                      color: manualError ? "hsl(var(--tac-danger))" : "white",
                      boxShadow: manualError ? "0 0 15px hsl(var(--tac-danger)/0.2)" : "none"
                    }}
                  />
                  {manualCode && !isValidating && (
                    <button
                      onClick={() => { setManualCode(""); setManualError(""); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 active:scale-90 transition-all"
                      style={{ color: muted }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  {isValidating && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-5 w-5 animate-spin" style={{ color: accent }} />
                    </div>
                  )}
                </div>

                {manualError ? (
                  <div className="mt-3 flex items-center gap-2 px-2 tac-pulse">
                    <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--tac-danger))" }} />
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider" style={{ color: "hsl(var(--tac-danger))" }}>
                      {manualError} — VERIFIQUE E TENTE NOVAMENTE
                    </span>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-2 px-2 opacity-50">
                    <Search className="h-3 w-3 shrink-0" style={{ color: muted }} />
                    <span className="text-[10px] font-mono uppercase tracking-tight" style={{ color: muted }}>
                      PRONTO PARA VALIDAÇÃO
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-4">
                <button
                  disabled={!manualCode.trim() || isValidating}
                  onClick={handleManualSubmit}
                  className="w-full h-16 rounded-xl font-black uppercase tracking-[0.2em] text-lg active:scale-[0.97] transition-all disabled:opacity-20 disabled:grayscale flex items-center justify-center gap-3 border-b-4 border-black/40"
                  style={{ 
                    background: manualError ? "hsl(var(--tac-danger))" : accent, 
                    color: "hsl(var(--tac-bg))" 
                  }}
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin" />
                      PROCESSANDO…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-6 w-6" />
                      VALIDAR CÓDIGO
                    </>
                  )}
                </button>
                
                <p className="text-center mt-6 text-[10px] font-mono uppercase tracking-[0.2em] opacity-40">
                  ESTADO: {isValidating ? "SYNC" : "READY"} // V.4.2
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
