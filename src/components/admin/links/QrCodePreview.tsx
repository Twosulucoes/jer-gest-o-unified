import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

interface QrCodePreviewProps {
  value: string;
  size?: number;
  filename?: string;
  showDownload?: boolean;
}

/**
 * Real QR Code rendered to canvas via the `qrcode` library.
 * Replaces the previous icon-based placeholder.
 */
export function QrCodePreview({
  value,
  size = 120,
  filename = "qrcode",
  showDownload = false,
}: QrCodePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!canvasRef.current || !value) return;
    setReady(false);
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="rounded-lg border bg-white p-2 flex items-center justify-center"
        style={{ width: size + 16, height: size + 16 }}
      >
        {!ready && (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground absolute" />
        )}
        <canvas ref={canvasRef} aria-label={`QR Code: ${value}`} />
      </div>
      {showDownload && (
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs"
          onClick={handleDownload}
          disabled={!ready}
        >
          <Download className="h-3.5 w-3.5" /> Baixar PNG
        </Button>
      )}
    </div>
  );
}
