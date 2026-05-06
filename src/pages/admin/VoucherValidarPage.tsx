import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEventId } from "@/contexts/EventContext";
import { useStageScope } from "@/hooks/useStageScope";
import { format } from "date-fns";
import QrCodeScanner from "@/components/pwa/QrCodeScanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { QrCode, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { tryRedeemVoucher, type ServiceKind } from "@/lib/voucherScan";
import { voucherErrorMessage } from "@/lib/voucherMessages";

const SERVICE_LABELS: Record<ServiceKind, string> = {
  transport: "Transporte",
  meals: "Alimentação",
  lodging: "Alojamento",
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
  const eventId = useActiveEventId();
  const { stageId } = useStageScope();

  const [serviceKind, setServiceKind] = useState<ServiceKind>("meals");
  const [contextId, setContextId] = useState<string>("");
  const [manualValue, setManualValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<RedeemResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Carrega instâncias da etapa ativa para forçar o operador a escolher uma
  // janela/viagem/local antes de validar — sem isso a RPC trata como
  // wrong_instance (regra canônica: 1 voucher × 1 dia × 1 janela).
  const { data: instances = { meals: [], trips: [], locations: [] } } = useQuery({
    queryKey: ["voucher-validar-instances", eventId, stageId],
    queryFn: async () => {
      let mealsQ = supabase
        .from("meal_windows")
        .select("id, label, service_date, start_time, end_time")
        .eq("event_id", eventId);
      if (stageId) mealsQ = mealsQ.eq("event_stage_id", stageId);

      let tripsQ = supabase
        .from("transport_trips")
        .select("id, scheduled_at, route_id, routes(name)")
        .eq("event_id", eventId);
      if (stageId) tripsQ = tripsQ.eq("event_stage_id", stageId);

      let locsQ = supabase
        .from("lodging_locations")
        .select("id, name")
        .eq("event_id", eventId);
      if (stageId) locsQ = locsQ.eq("event_stage_id", stageId);

      const [meals, trips, locations] = await Promise.all([mealsQ, tripsQ, locsQ]);
      return {
        meals: meals.data ?? [],
        trips: (trips.data as any[]) ?? [],
        locations: locations.data ?? [],
      };
    },
    enabled: !!eventId,
  });

  const contextOptions = useMemo(() => {
    if (serviceKind === "meals") {
      return instances.meals.map((m: any) => ({
        id: m.id,
        label: `${m.label} — ${m.service_date}${m.start_time ? ` ${m.start_time.slice(0, 5)}` : ""}${m.end_time ? `–${m.end_time.slice(0, 5)}` : ""}`,
      }));
    }
    if (serviceKind === "transport") {
      return instances.trips.map((t: any) => ({
        id: t.id,
        label: `${t.routes?.name || "Viagem"} — ${format(new Date(t.scheduled_at), "dd/MM HH:mm")}`,
      }));
    }
    return instances.locations.map((l: any) => ({ id: l.id, label: l.name }));
  }, [serviceKind, instances]);

  const canValidate =
    hasRole("admin") ||
    hasRole("secretaria") ||
    hasRole("super_admin") ||
    hasRole("alimentacao") ||
    hasRole("transporte") ||
    hasRole("alojamento") ||
    hasRole("coordenacao_tecnica");

  const redeem = async (qrValue: string) => {
    if (!qrValue) return;
    if (!contextId) {
      toast({
        title: "Selecione a janela/viagem/local",
        description: "Voucher é válido somente no dia e janela específicos.",
        variant: "destructive",
      });
      return;
    }
    let normalizedValue = qrValue.trim();
    if (!normalizedValue.toLowerCase().startsWith("voucher:")) {
      normalizedValue = `voucher:${normalizedValue.toUpperCase()}`;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await tryRedeemVoucher(normalizedValue, serviceKind, contextId);
      if (!res) {
        toast({ title: "QR não é um voucher", variant: "destructive" });
        return;
      }
      setResult(res as RedeemResult);
      if (res.ok) {
        toast({
          title: "Voucher validado",
          description: `${res.person_name ?? res.label ?? "Pessoa"} — ${SERVICE_LABELS[serviceKind]}`,
        });
      } else {
        const msg = voucherErrorMessage(res.reason);
        toast({ title: "Voucher inválido", description: msg.text, variant: "destructive" });
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
        <p className="text-sm text-muted-foreground">
          Escaneie o QR ou cole o código. A janela/viagem/local é obrigatória — voucher vale somente no dia.
        </p>
      </div>

      {!stageId && (
        <Card className="border-amber-500/50 bg-amber-50/50">
          <CardContent className="pt-4 text-sm text-amber-900">
            Sem etapa ativa selecionada. As listas abaixo mostram instâncias do evento inteiro — recomenda‑se acessar via
            <code className="mx-1 px-1 bg-amber-100 rounded">/admin/etapa/:id/voucher/validar</code>.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Contexto da validação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Serviço</Label>
            <Select
              value={serviceKind}
              onValueChange={(v: ServiceKind) => {
                setServiceKind(v);
                setContextId("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="meals">Alimentação</SelectItem>
                <SelectItem value="transport">Transporte</SelectItem>
                <SelectItem value="lodging">Alojamento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>
              {serviceKind === "meals" ? "Janela de refeição" : serviceKind === "transport" ? "Viagem" : "Local de alojamento"}
            </Label>
            <Select value={contextId} onValueChange={setContextId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {contextOptions.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground">
                    Nenhuma instância encontrada para a etapa atual.
                  </div>
                ) : (
                  contextOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setScanning(true)} className="flex-1" disabled={!contextId}>
              <QrCode className="h-4 w-4 mr-1" />
              Escanear QR
            </Button>
          </div>

          <div>
            <Label>Ou cole o código manualmente</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                placeholder="voucher:..."
              />
              <Button
                onClick={() => redeem(manualValue)}
                disabled={!manualValue || loading || !contextId}
              >
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
        <Card
          className={
            result.ok
              ? "border-success/50 bg-success/5"
              : "border-destructive/50 bg-destructive/5"
          }
        >
          <CardContent className="pt-4">
            {result.ok ? (
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-8 w-8 text-success shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">Validado com sucesso</p>
                  <p className="text-sm">{result.person_name}</p>
                  <Badge variant="secondary" className="mt-1">
                    {SERVICE_LABELS[serviceKind]}
                  </Badge>
                  {result.remaining_uses !== null && result.remaining_uses !== undefined && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Usos restantes: {result.remaining_uses}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <XCircle className="h-8 w-8 text-destructive shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">Voucher inválido</p>
                  <p className="text-sm text-muted-foreground">
                    {voucherErrorMessage(result.reason).text}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
