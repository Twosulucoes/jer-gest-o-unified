import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Link2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  participantId: string;
  eventId: string;
  activeCredentialId?: string | null;
}

export default function VincularQrDialog({ open, onOpenChange, participantId, eventId, activeCredentialId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [code, setCode] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado");
      const trimmed = code.trim().toUpperCase();
      if (!trimmed) throw new Error("Digite um código de credencial.");

      const { error } = await supabase.rpc("link_external_credential" as any, {
        p_event_id: eventId,
        p_participant_id: participantId,
        p_credential_code: trimmed,
        p_user_id: user.id,
        p_replace_id: activeCredentialId ?? null,
        p_is_internal_mode: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("QR vinculado com sucesso.");
      qc.invalidateQueries({ queryKey: ["participant_credentials", participantId] });
      qc.invalidateQueries({ queryKey: ["participant_active_cred_header", participantId] });
      qc.invalidateQueries({ queryKey: ["participant_full", participantId] });
      setCode("");
      onOpenChange(false);
    },
    onError: (err: any) => {
      const msg: string = err?.message ?? String(err);
      if (msg.includes("23505") || msg.toLowerCase().includes("vinculada")) {
        toast.error("Código já vinculado a outro participante.");
      } else {
        toast.error(msg || "Erro ao vincular QR.");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!mutation.isPending) { setCode(""); onOpenChange(v); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Vincular QR existente
          </DialogTitle>
          <DialogDescription>
            Digite o código da credencial física (etiqueta ou QR code) para associar a este participante.
            {activeCredentialId && (
              <span className="block mt-1 text-amber-600 text-xs">
                A credencial ativa atual será substituída pela nova.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="qr-code-input">Código da credencial</Label>
            <Input
              id="qr-code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ex: J04382"
              autoFocus
              autoComplete="off"
              disabled={mutation.isPending}
              className="font-mono text-lg tracking-widest"
            />
            <p className="text-xs text-muted-foreground">
              Aceita códigos no formato J + 5 dígitos ou qualquer código externo de credencial.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!code.trim() || mutation.isPending}>
              {mutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Vinculando…</>
              ) : (
                "Vincular"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
