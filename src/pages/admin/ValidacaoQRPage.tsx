import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ScanLine,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  User,
  Camera,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActiveEventId } from "@/contexts/EventContext";
import QrCodeScanner from "@/components/pwa/QrCodeScanner";
import { ParticipantReviewDialog } from "@/components/admin/ParticipantReviewDialog";

interface ValidationResult {
  result: "valid" | "not_found" | "revoked" | "suspended" | "not_activated" | "wrong_event" | string;
  message: string | null;
  participant: {
    participant_id: string;
    participant_type: string;
    full_name: string;
    birth_date: string;
    gender: string;
    photo_url: string | null;
    institution: string | null;
    credential_code: string;
  } | null;
  timestamp: string;
}

const RESULT_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  valid: { label: "VÁLIDO", icon: <CheckCircle2 className="h-8 w-8" />, color: "text-green-600 bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" },
  not_found: { label: "NÃO ENCONTRADO", icon: <XCircle className="h-8 w-8" />, color: "text-destructive bg-destructive/10 border-destructive/30" },
  revoked: { label: "REVOGADO", icon: <XCircle className="h-8 w-8" />, color: "text-destructive bg-destructive/10 border-destructive/30" },
  suspended: { label: "SUSPENSO", icon: <AlertTriangle className="h-8 w-8" />, color: "text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800" },
  not_activated: { label: "NÃO ATIVADO", icon: <AlertTriangle className="h-8 w-8" />, color: "text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800" },
  wrong_event: { label: "EVENTO INCORRETO", icon: <XCircle className="h-8 w-8" />, color: "text-destructive bg-destructive/10 border-destructive/30" },
};

export default function ValidacaoQRPage() {
  const selectedEventId = useActiveEventId();
  const [qrInput, setQrInput] = useState("");
  const [scanPoint, setScanPoint] = useState("general");
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleValidate = async () => {
    if (!qrInput.trim() || !selectedEventId) return;
    setValidating(true);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada.");
        return;
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/validate-qr`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          qr_code_value: qrInput.trim(),
          event_id: selectedEventId,
          scan_point: scanPoint,
        }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Erro desconhecido");

      setResult(json);
      setShowConfirm(true);
    } catch (err) {
      toast.error(`Erro: ${(err as Error).message}`);
    } finally {
      setValidating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleValidate();
    }
  };

  const handleNewScan = () => {
    setQrInput("");
    setResult(null);
    setShowConfirm(false);
    // Use a small timeout to ensure the dialog is closed before focusing
    setTimeout(() => {
      document.getElementById("qr-input-field")?.focus();
    }, 100);
  };

  const handleCameraScan = useCallback((raw: string) => {
    setScannerOpen(false);
    setQrInput(raw.trim());
    // Auto-validate after camera scan
    setTimeout(() => {
      document.getElementById("btn-validate-qr")?.click();
    }, 100);
  }, []);

  const resultConfig = result ? RESULT_CONFIG[result.result] ?? {
    label: result.result.toUpperCase(),
    icon: <AlertTriangle className="h-8 w-8" />,
    color: "text-muted-foreground bg-muted border-border",
  } : null;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Validação QR Code</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Escaneie ou insira o código QR para validar credenciais
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Evento</label>
              <Select value={selectedEventId} onValueChange={() => {}}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} ({e.year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Ponto</label>
              <Select value={scanPoint} onValueChange={setScanPoint}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">Geral</SelectItem>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="alimentacao">Alimentação</SelectItem>
                  <SelectItem value="transporte">Transporte</SelectItem>
                  <SelectItem value="alojamento">Alojamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-foreground">Código QR</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Escaneie ou cole o QR Code..."
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={!selectedEventId || validating}
                  autoFocus
                />
                <Button
                  variant="outline"
                  onClick={() => setScannerOpen(true)}
                  disabled={!selectedEventId || validating}
                  title="Abrir câmera"
                >
                  <Camera className="h-4 w-4" />
                </Button>
                <Button
                  id="btn-validate-qr"
                  onClick={handleValidate}
                  disabled={!qrInput.trim() || !selectedEventId || validating}
                >
                  {validating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ScanLine className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {result && resultConfig && (
        <Card className={`border-2 ${resultConfig.color}`}>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              {resultConfig.icon}
              <h2 className="text-2xl font-bold">{resultConfig.label}</h2>
              {result.message && (
                <p className="text-sm opacity-80">{result.message}</p>
              )}

              {result.participant && (
                <div className="w-full max-w-md mt-4 rounded-lg border bg-card p-4 text-left space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{result.participant.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {result.participant.institution ?? "Sem instituição"}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Tipo:</span>{" "}
                      <Badge variant="outline">{result.participant.participant_type === "athlete" ? "Atleta" : result.participant.participant_type}</Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sexo:</span>{" "}
                      {result.participant.gender === "male" ? "Masculino" : "Feminino"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Nascimento:</span>{" "}
                      {new Date(result.participant.birth_date + "T00:00:00").toLocaleDateString("pt-BR")}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Código:</span>{" "}
                      <span className="font-mono text-xs">{result.participant.credential_code}</span>
                    </div>
                  </div>
                </div>
              )}

              <Button onClick={handleNewScan} variant="outline" className="mt-4">
                <ScanLine className="mr-2 h-4 w-4" />
                Nova leitura
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!result && selectedEventId && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <ScanLine className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Pronto para validar</p>
          <p className="text-sm text-muted-foreground mt-1">
            Clique na câmera para escanear ou cole o valor no campo acima.
          </p>
          <Button className="mt-4" onClick={() => setScannerOpen(true)} disabled={!selectedEventId}>
            <Camera className="mr-2 h-4 w-4" /> Abrir câmera
          </Button>
        </div>
      )}

      <QrCodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleCameraScan}
        title="Validar Credencial"
      />

      {result && (
        <ParticipantReviewDialog
          open={showConfirm}
          onOpenChange={setShowConfirm}
          participant={result.participant ? {
            name: result.participant.full_name,
            participantId: result.participant.participant_id,
            cpf: null,
            type: result.participant.participant_type,
            institution: result.participant.institution,
            photo_url: result.participant.photo_url,
            birth_date: result.participant.birth_date,
          } : null}
          onConfirm={handleNewScan}
          confirmLabel="Confirmar e Próximo"
          statusLabel={resultConfig?.label}
          statusIcon={resultConfig?.icon}
          statusColor={resultConfig?.color.split(" ")[1] + " border-b " + (resultConfig?.color.split(" ")[2] || "")}
          message={result.message}
        />
      )}
    </div>
  );
}
