import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { isNativeApp } from "@/lib/runtime";
import QrScanner from "@/components/QrScanner";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import {
  ShieldCheck,
  Camera,
  Wifi,
  Smartphone,
  Copy,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";

type CheckStatus = "ok" | "warn" | "error" | "pending";

interface DiagCheck {
  label: string;
  status: CheckStatus;
  detail: string;
}

type TestModule = "alojamento" | "transporte" | "alimentacao" | null;

export default function QrDiagnosticoPage() {
  const [checks, setChecks] = useState<DiagCheck[]>([]);
  const [cameraStatus, setCameraStatus] = useState<CheckStatus>("pending");
  const [testModule, setTestModule] = useState<TestModule>(null);
  const [lastPayload, setLastPayload] = useState<string | null>(null);

  const runChecks = useCallback(async () => {
    const results: DiagCheck[] = [];

    // HTTPS check
    const isSecure = location.protocol === "https:" || location.hostname === "localhost" || isNativeApp();
    results.push({
      label: "HTTPS",
      status: isSecure ? "ok" : "error",
      detail: isSecure ? location.protocol : "Conexão insegura — câmera pode não funcionar",
    });

    // getUserMedia API
    const hasMedia = !!navigator.mediaDevices?.getUserMedia;
    results.push({
      label: "API de Câmera",
      status: hasMedia ? "ok" : "error",
      detail: hasMedia ? "navigator.mediaDevices disponível" : "API não disponível neste navegador",
    });

    // Environment
    const native = isNativeApp();
    results.push({
      label: "Ambiente",
      status: "ok",
      detail: native ? "Capacitor (App Nativo)" : "Navegador Web (PWA)",
    });

    // Prefixes info
    results.push({
      label: "Prefixos Aceitos",
      status: "ok",
      detail: 'Alojamento: JER-ALJ:, JER: | Transporte: JER: | Alimentação: JER:',
    });

    setChecks(results);
  }, []);

  const testCameraPermission = useCallback(async () => {
    setCameraStatus("pending");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      stream.getTracks().forEach((t) => t.stop());
      setCameraStatus("ok");
      toast.success("Permissão de câmera concedida");
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setCameraStatus("error");
        toast.error("Permissão de câmera negada");
      } else if (err.name === "NotFoundError") {
        setCameraStatus("warn");
        toast.warning("Nenhuma câmera encontrada");
      } else {
        setCameraStatus("error");
        toast.error(err.message || "Erro ao acessar câmera");
      }
    }
  }, []);

  const handleTestDetected = useCallback((payload: string) => {
    setLastPayload(payload);
    toast.success("QR lido com sucesso!");
  }, []);

  const copyPayload = () => {
    if (lastPayload) {
      navigator.clipboard.writeText(lastPayload);
      toast.success("Copiado!");
    }
  };

  const statusIcon = (s: CheckStatus) => {
    switch (s) {
      case "ok": return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "warn": return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case "error": return <XCircle className="h-5 w-5 text-destructive" />;
      default: return <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />;
    }
  };

  const prefixesForModule = (m: TestModule): string[] => {
    if (m === "alojamento") return ["JER-ALJ:", "JER:"];
    return ["JER:"];
  };

  return (
    <div className="min-h-screen bg-background">
      <PwaHeader title="Diagnóstico QR" icon={ShieldCheck} backTo="/pwa" />

      <main className="p-4 max-w-md mx-auto space-y-4">
        {/* Auto checks */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Wifi className="h-4 w-4" />
              Verificações do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {checks.length === 0 ? (
              <Button onClick={runChecks} className="w-full">
                Executar diagnóstico
              </Button>
            ) : (
              <>
                {checks.map((c, i) => (
                  <div key={i} className="flex items-start gap-3">
                    {statusIcon(c.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{c.label}</p>
                      <p className="text-xs text-muted-foreground break-all">{c.detail}</p>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={runChecks}>
                  Reexecutar
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Camera permission test */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Permissão de Câmera
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              {statusIcon(cameraStatus)}
              <span className="text-sm">
                {cameraStatus === "pending" && "Não testado"}
                {cameraStatus === "ok" && "Câmera acessível"}
                {cameraStatus === "warn" && "Câmera não encontrada"}
                {cameraStatus === "error" && "Permissão negada"}
              </span>
            </div>
            <Button onClick={testCameraPermission} variant="outline" className="w-full">
              Testar Permissão
            </Button>
          </CardContent>
        </Card>

        {/* Module test */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              Teste por Módulo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(["alojamento", "transporte", "alimentacao"] as TestModule[]).map((m) => (
                <Button
                  key={m}
                  variant={testModule === m ? "module" : "outline"}
                  size="sm"
                  onClick={() => {
                    setTestModule(testModule === m ? null : m);
                    setLastPayload(null);
                  }}
                >
                  {m === "alojamento" && "🏠 Alojamento"}
                  {m === "transporte" && "🚌 Transporte"}
                  {m === "alimentacao" && "🍽️ Alimentação"}
                </Button>
              ))}
            </div>

            {testModule && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Prefixos: {prefixesForModule(testModule).join(", ")}
                </p>
                <QrScanner
                  onDetected={handleTestDetected}
                  allowedPrefixes={prefixesForModule(testModule)}
                  torch
                />
              </div>
            )}

            {lastPayload && (
              <div className="p-3 rounded-lg bg-muted space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Último payload:</p>
                <code className="text-sm break-all block">{lastPayload}</code>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyPayload}>
                    <Copy className="h-3 w-3 mr-1" />
                    Copiar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setLastPayload(null)}>
                    <Trash2 className="h-3 w-3 mr-1" />
                    Limpar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Module status summary */}
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Status dos módulos de scan:</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                /pwa/alojamento/scan
              </Badge>
              <Badge variant="outline">
                /pwa/transporte/scan
              </Badge>
              <Badge variant="outline">
                /pwa/alimentacao/scan
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Todos usam o componente QrScanner unificado com suporte a câmera nativa (Capacitor) e fallback web (html5-qrcode).
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
