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
  BadgeCheck,
  Maximize2,
  Settings2,
  Receipt,
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
import { cn } from "@/lib/utils";
import { useStageModuleKpis } from "@/contexts/StageModuleKpisContext";
import { isVoucherQr, tryRedeemVoucher, type ServiceKind } from "@/lib/voucherScan";
import { voucherErrorMessage, voucherSuccessMessage } from "@/lib/voucherMessages";
import { getPwaLang } from "@/lib/systemMessages";

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
  not_activated: { label: "CREDENCIAL PENDENTE", icon: <AlertTriangle className="h-8 w-8" />, color: "text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800" },
  no_credential: { label: "SEM CREDENCIAL", icon: <AlertTriangle className="h-8 w-8" />, color: "text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800" },
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
  const [sessionCount, setSessionCount] = useState(0);

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleValidate = async (value?: string) => {
    const codeToValidate = value || qrInput.trim();
    if (!codeToValidate || !selectedEventId) return;
    
    setValidating(true);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada.");
        return;
      }

      const { data: json, error: invokeError } = await supabase.functions.invoke("validate-qr", {
        body: {
          qr_code_value: codeToValidate,
          event_id: selectedEventId,
          scan_point: scanPoint,
        },
      });

      if (invokeError) {
        // Tenta extrair mensagem de erro detalhada do contexto da function
        let detail = invokeError.message;
        try {
          const ctx = (invokeError as any).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            if (body?.error) detail = body.error;
          }
        } catch { /* ignore */ }
        throw new Error(detail || "Erro ao chamar validate-qr");
      }
      if (!json) throw new Error("Resposta vazia do servidor");

      setResult(json);
      
      if (json.result === "valid") {
        toast.success("QR Code validado com sucesso!");
        setSessionCount(prev => prev + 1);
      } else {
        const config = RESULT_CONFIG[json.result];
        toast.error(config?.label || json.error || "QR Code inválido");
      }
      
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
  };

  const handleCameraScan = useCallback((raw: string) => {
    setScannerOpen(false);
    setQrInput(raw.trim());
    handleValidate(raw.trim());
  }, [selectedEventId, scanPoint]);

  const resultConfig = result ? RESULT_CONFIG[result.result] ?? {
    label: result.result.toUpperCase(),
    icon: <AlertTriangle className="h-8 w-8" />,
    color: "text-muted-foreground bg-muted border-border",
  } : null;

  const FRIENDLY_MESSAGES: Record<string, string> = {
    valid: "Credencial válida. Acesso liberado.",
    no_credential: "Este participante ainda não foi credenciado.",
    not_activated: "A credencial existe, mas ainda não foi ativada.",
    revoked: "Credencial revogada. Acesso negado.",
    suspended: "Credencial suspensa. Acesso bloqueado.",
    wrong_event: "Esta credencial pertence a outro evento.",
    not_found: "QR Code não encontrado no sistema.",
  };
  const friendlyMessage = result ? (FRIENDLY_MESSAGES[result.result] ?? result.message ?? null) : null;

  // Registra KPIs do módulo no scaffold pai (sem renderizar outro scaffold)
  useStageModuleKpis(
    [
      {
        label: "Sessão",
        value: sessionCount,
        icon: <BadgeCheck className="h-3.5 w-3.5" />,
        tone: "primary",
      },
      {
        label: "Scanner",
        value: "PRONTO",
        icon: <ScanLine className="h-3.5 w-3.5" />,
        tone: "success",
      },
    ],
    true,
  );

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Validação QR</h1>
            <p className="text-sm text-muted-foreground">Efetue a leitura das credenciais dos participantes</p>
          </div>
          <div className="flex gap-2">
            <Select value={scanPoint} onValueChange={setScanPoint}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <Settings2 className="w-3 h-3 mr-2" />
                <SelectValue placeholder="Ponto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">Ponto: Geral</SelectItem>
                <SelectItem value="entrada">Ponto: Entrada</SelectItem>
                <SelectItem value="alimentacao">Ponto: Alimentação</SelectItem>
                <SelectItem value="transporte">Ponto: Transporte</SelectItem>
                <SelectItem value="alojamento">Ponto: Alojamento</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Lado Esquerdo: Scanner Principal */}
          <Card className={cn(
            "md:col-span-2 relative overflow-hidden transition-all",
            validating && "opacity-80"
          )}>
            <CardContent className="p-0">
              <div 
                className="relative aspect-[4/3] bg-black flex flex-col items-center justify-center cursor-pointer group"
                onClick={() => setScannerOpen(true)}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-64 h-64 border-2 border-primary/50 rounded-2xl flex items-center justify-center relative">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                    
                    <div className="flex flex-col items-center gap-4 text-white">
                      <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center border border-primary/40 group-hover:bg-primary/40 transition-colors">
                        <Camera className="h-8 w-8" />
                      </div>
                      <span className="font-medium text-sm tracking-wide bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
                        CLIQUE PARA ESCANEAR
                      </span>
                    </div>
                  </div>
                </div>
                
                {validating && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[2px] z-10">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-10 w-10 text-primary animate-spin" />
                      <span className="text-primary font-bold animate-pulse text-xs tracking-widest uppercase">Validando...</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Lado Direito: Entrada Manual e Contexto */}
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">Entrada Manual</label>
                  <div className="flex gap-2">
                    <Input
                      id="qr-input-field"
                      placeholder="Cole ou digite o código..."
                      value={qrInput}
                      onChange={(e) => setQrInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={!selectedEventId || validating}
                      className="h-10 text-sm"
                    />
                    <Button
                      id="btn-validate-qr"
                      size="icon"
                      onClick={() => handleValidate()}
                      disabled={!qrInput.trim() || !selectedEventId || validating}
                    >
                      {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="pt-4 border-t border-dashed">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-muted-foreground">Configurações</span>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">Evento Ativo</label>
                    <div className="p-3 rounded-lg border bg-muted/20 text-xs flex items-center justify-between">
                      <span className="font-medium truncate mr-2">
                        {events.find(e => e.id === selectedEventId)?.name || "Nenhum evento selecionado"}
                      </span>
                      <Badge variant="outline" className="text-[9px] h-4">Contexto Global</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Atalho para tela cheia ou scanner fixo se necessário */}
            <Button 
              variant="outline" 
              className="w-full h-12 border-dashed flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary hover:border-primary transition-colors"
              onClick={() => setScannerOpen(true)}
            >
              <Maximize2 className="w-4 h-4" />
              MODO TELA CHEIA
            </Button>
          </div>
        </div>

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
            onCancel={handleNewScan}
            confirmLabel={result.result === "valid" ? "Próximo" : "Entendido"}
            cancelLabel="Nova leitura"
            statusLabel={resultConfig?.label}
            statusIcon={resultConfig?.icon}
            statusColor={resultConfig?.color.split(" ")[1] + " border-b " + (resultConfig?.color.split(" ")[2] || "")}
            message={friendlyMessage}
          />
        )}
    </div>
  );
}


