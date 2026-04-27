import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import QrCodeScanner from "@/components/pwa/QrCodeScanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { QrCode, CheckCircle2, XCircle, Loader2 } from "lucide-react";

const SERVICE_LABELS: Record<string, string> = {
  transport: "Transporte", meals: "Alimentação", lodging: "Alojamento",
};

const REASON_MESSAGES: Record<string, string> = {
  not_found: "Voucher não encontrado",
  inactive: "Voucher revogado ou inativo",
  expired: "Voucher expirado",
  not_yet_valid: "Voucher ainda não está válido",
  scope_denied: "Voucher não cobre este serviço",
  max_uses_reached: "Limite total de usos atingido",
  wrong_instance: "Voucher pertence a outra instância (refeição/viagem/diária)",
  already_used_here: "Voucher já foi consumido nesta instância específica",
};

interface RedeemResult {
  ok: boolean;
  reason?: string;
  status?: string;
  participant_id?: string;
  person_name?: string;
  remaining_uses?: number | null;
  used_at?: string;
  operator_name?: string;
}

export default function VoucherValidarPage() {
  const { hasRole } = useAuth();
  const [serviceKind, setServiceKind] = useState<"transport" | "meals" | "lodging">("meals");
  const [manualValue, setManualValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<RedeemResult | null>(null);
  const [loading, setLoading] = useState(false);

  const redeem = async (qrValue: string) => {
    if (!qrValue) return;
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.rpc("redeem_voucher" as any, {
        p_qr_value: qrValue,
        p_service_kind: serviceKind,
      });
      if (error) throw error;
      const res = data as RedeemResult;
      setResult(res);
      if (res.ok) {
        toast({ title: "Voucher validado com sucesso!", description: `${res.person_name ?? "Pessoa"} - ${SERVICE_LABELS[serviceKind]}` });
      } else {
        let extra = "";
        if (res.reason === 'already_used_here' && res.used_at) {
          extra = ` em ${new Date(res.used_at).toLocaleTimeString()}`;
        }
        toast({ title: "Voucher inválido", description: `${REASON_MESSAGES[res.reason ?? ""] ?? res.reason}${extra}`, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message ?? String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleScan = (value: string) => {
    setScanning(false);
    setManualValue(value);
    redeem(value);
  };

  const canValidate = hasRole("admin") || hasRole("secretaria") || hasRole("super_admin");

  if (!canValidate) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Você não tem permissão para validar vouchers.
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-4 max-w-xl mx-auto">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Validar voucher</h1>
        <p className="text-sm text-muted-foreground">Escaneie o QR ou cole o código do voucher.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Serviço a validar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={serviceKind} onValueChange={(v: any) => setServiceKind(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="transport">Transporte</SelectItem>
              <SelectItem value="meals">Alimentação</SelectItem>
              <SelectItem value="lodging">Alojamento</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button onClick={() => setScanning(true)} className="flex-1">
              <QrCode className="h-4 w-4 mr-1" />Escanear QR
            </Button>
          </div>

          <div>
            <Label>Ou cole o código manualmente</Label>
            <div className="flex gap-2 mt-1">
              <Input value={manualValue} onChange={e => setManualValue(e.target.value)} placeholder="voucher:..." />
              <Button onClick={() => redeem(manualValue)} disabled={!manualValue || loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Validar"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <QrCodeScanner
        isOpen={scanning}
        onScan={handleScan}
        onClose={() => setScanning(false)}
        title="Validar voucher"
        allowedPrefixes={["voucher:"]}
      />

      {result && (
        <Card className={result.ok ? "border-success/50 bg-success/5" : "border-destructive/50 bg-destructive/5"}>
          <CardContent className="pt-4">
            {result.ok ? (
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-8 w-8 text-success shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">Validado com sucesso</p>
                  <p className="text-sm">{result.person_name}</p>
                  <Badge variant="secondary" className="mt-1">{SERVICE_LABELS[serviceKind]}</Badge>
                  {result.remaining_uses !== null && result.remaining_uses !== undefined && (
                    <p className="text-xs text-muted-foreground mt-2">Usos restantes: {result.remaining_uses}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <XCircle className="h-8 w-8 text-destructive shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">Voucher inválido</p>
                  <p className="text-sm text-muted-foreground">{REASON_MESSAGES[result.reason ?? ""] ?? result.reason}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
