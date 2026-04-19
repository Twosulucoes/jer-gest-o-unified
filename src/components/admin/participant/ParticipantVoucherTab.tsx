import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { QrCode, Plus, Ban, Loader2, History } from "lucide-react";
import QRCode from "qrcode";

interface Props {
  participantId: string;
  eventId: string;
}

const SERVICE_LABELS: Record<string, string> = {
  transport: "Transporte", meals: "Alimentação", lodging: "Alojamento",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default", revoked: "destructive", expired: "outline",
};

function generateQrValue(eventId: string, participantId: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `voucher:${eventId}:${participantId}:${ts}-${rnd}`;
}

export default function ParticipantVoucherTab({ participantId, eventId }: Props) {
  const { user, hasRole } = useAuth();
  const qc = useQueryClient();
  const canManage = hasRole("admin") || hasRole("secretaria") || hasRole("super_admin");

  const [createOpen, setCreateOpen] = useState(false);
  const [scopeT, setScopeT] = useState(false);
  const [scopeM, setScopeM] = useState(true);
  const [scopeL, setScopeL] = useState(false);
  const [validUntil, setValidUntil] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [notes, setNotes] = useState("");
  const [qrPreview, setQrPreview] = useState<{ value: string; dataUrl: string } | null>(null);

  const { data: vouchers = [], isLoading } = useQuery({
    queryKey: ["service_vouchers", participantId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("service_vouchers" as never) as any)
        .select("id, qr_code_value, scope_transport, scope_meals, scope_lodging, valid_from, valid_until, max_uses, current_uses, status, notes, created_at")
        .eq("participant_id", participantId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão inválida");
      if (!scopeT && !scopeM && !scopeL) throw new Error("Selecione pelo menos um serviço");
      const qr = generateQrValue(eventId, participantId);
      const { data, error } = await (supabase.from("service_vouchers" as never) as any).insert({
        event_id: eventId,
        participant_id: participantId,
        qr_code_value: qr,
        scope_transport: scopeT,
        scope_meals: scopeM,
        scope_lodging: scopeL,
        valid_until: validUntil || null,
        max_uses: maxUses ? parseInt(maxUses, 10) : null,
        notes: notes || null,
        issued_by: user.id,
      }).select("qr_code_value").single();
      if (error) throw error;
      const dataUrl = await QRCode.toDataURL(data.qr_code_value, { width: 320, margin: 2 });
      return { value: data.qr_code_value, dataUrl };
    },
    onSuccess: (result) => {
      toast({ title: "Voucher emitido" });
      setQrPreview(result);
      setCreateOpen(false);
      setScopeT(false); setScopeM(true); setScopeL(false);
      setValidUntil(""); setMaxUses(""); setNotes("");
      qc.invalidateQueries({ queryKey: ["service_vouchers", participantId] });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message ?? String(err), variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: async (voucherId: string) => {
      if (!user) throw new Error("Sessão inválida");
      const { error } = await (supabase.from("service_vouchers" as never) as any).update({
        status: "revoked", revoked_by: user.id, revoked_at: new Date().toISOString(),
      }).eq("id", voucherId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Voucher revogado" });
      qc.invalidateQueries({ queryKey: ["service_vouchers", participantId] });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message ?? String(err), variant: "destructive" }),
  });

  const reprintQr = async (value: string) => {
    const dataUrl = await QRCode.toDataURL(value, { width: 320, margin: 2 });
    setQrPreview({ value, dataUrl });
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <QrCode className="h-4 w-4" />Vouchers de serviço
          </h3>
          <p className="text-xs text-muted-foreground">Use vouchers para liberar serviços a pessoas sem credencial.</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />Emitir voucher
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : vouchers.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8 text-sm text-muted-foreground">
            Nenhum voucher emitido. {canManage && "Clique em \"Emitir voucher\" para criar um."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {vouchers.map((v: any) => {
            const scopes = [
              v.scope_transport && "Transporte",
              v.scope_meals && "Alimentação",
              v.scope_lodging && "Alojamento",
            ].filter(Boolean).join(" • ");
            return (
              <Card key={v.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={STATUS_VARIANT[v.status]}>{v.status}</Badge>
                        <span className="text-sm font-medium">{scopes}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 font-mono truncate">{v.qr_code_value}</p>
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                        <span>Usos: <strong>{v.current_uses}</strong>{v.max_uses ? ` / ${v.max_uses}` : " (ilimitado)"}</span>
                        {v.valid_until && <span>Expira: {new Date(v.valid_until).toLocaleString("pt-BR")}</span>}
                      </div>
                      {v.notes && <p className="text-xs text-muted-foreground mt-1">{v.notes}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => reprintQr(v.qr_code_value)} title="Reimprimir QR">
                        <QrCode className="h-3.5 w-3.5" />
                      </Button>
                      {canManage && v.status === "active" && (
                        <Button size="sm" variant="ghost" onClick={() => revokeMutation.mutate(v.id)} disabled={revokeMutation.isPending} title="Revogar">
                          <Ban className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Emitir voucher de serviço</DialogTitle>
            <DialogDescription>Voucher único multiuso. Defina escopo, validade e limite.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Serviços liberados *</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <label className="flex items-center gap-2 border rounded p-2 cursor-pointer">
                  <Checkbox checked={scopeT} onCheckedChange={v => setScopeT(!!v)} />
                  <span className="text-sm">Transporte</span>
                </label>
                <label className="flex items-center gap-2 border rounded p-2 cursor-pointer">
                  <Checkbox checked={scopeM} onCheckedChange={v => setScopeM(!!v)} />
                  <span className="text-sm">Alimentação</span>
                </label>
                <label className="flex items-center gap-2 border rounded p-2 cursor-pointer">
                  <Checkbox checked={scopeL} onCheckedChange={v => setScopeL(!!v)} />
                  <span className="text-sm">Alojamento</span>
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Válido até</Label>
                <Input type="datetime-local" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
              </div>
              <div>
                <Label>Limite de usos</Label>
                <Input type="number" min={1} value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder="Ilimitado" />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createMutation.isPending}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Emitir voucher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR preview */}
      <Dialog open={!!qrPreview} onOpenChange={(v) => !v && setQrPreview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR Code do voucher</DialogTitle>
            <DialogDescription>Imprima ou compartilhe com a pessoa.</DialogDescription>
          </DialogHeader>
          {qrPreview && (
            <div className="flex flex-col items-center gap-3 py-3">
              <img src={qrPreview.dataUrl} alt="QR Code" className="border rounded" />
              <p className="text-xs font-mono text-muted-foreground break-all text-center">{qrPreview.value}</p>
              <Button variant="outline" onClick={() => window.print()}>Imprimir</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
