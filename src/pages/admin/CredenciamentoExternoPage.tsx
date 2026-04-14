import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle, ScanLine, Search, User, XCircle } from "lucide-react";
import { toast } from "sonner";
import QrCodeScanner from "@/components/pwa/QrCodeScanner";
import ModuleHeader from "@/components/admin/ModuleHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Participant {
  id: string;
  full_name: string;
  cpf: string | null;
  photo_url: string | null;
  delegation_name: string | null;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Ativa", variant: "default" },
  cancelled: { label: "Cancelada", variant: "destructive" },
  lost: { label: "Perdida", variant: "destructive" },
  replaced: { label: "Substituída", variant: "secondary" },
};

export default function CredenciamentoExternoPage() {
  const eventId = useActiveEventId();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  // Search participants
  const { data: participants, isLoading: searchLoading } = useQuery({
    queryKey: ["ext-cred-search", eventId, search],
    queryFn: async () => {
      if (!eventId || search.length < 2) return [];
      const { data } = await supabase
        .from("participants")
        .select("id, full_name, cpf, photo_url, delegation:delegations(institution:institutions(name))")
        .eq("event_id", eventId)
        .or(`full_name.ilike.%${search}%,cpf.ilike.%${search}%`)
        .order("full_name")
        .limit(20);
      return (data ?? []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        cpf: p.cpf,
        photo_url: p.photo_url,
        delegation_name: p.delegation?.institution?.name ?? null,
      }));
    },
    enabled: !!eventId && search.length >= 2,
  });

  // Get existing credential for selected participant
  const { data: existingCred, isLoading: credLoading } = useQuery({
    queryKey: ["ext-cred-existing", eventId, selectedParticipant?.id],
    queryFn: async () => {
      if (!eventId || !selectedParticipant) return null;
      const { data } = await supabase
        .from("external_credentials")
        .select("*")
        .eq("event_id", eventId)
        .eq("participant_id", selectedParticipant.id)
        .eq("status", "active")
        .maybeSingle();
      return data;
    },
    enabled: !!eventId && !!selectedParticipant,
  });

  // Link credential mutation
  const linkMutation = useMutation({
    mutationFn: async ({ code, replaceId }: { code: string; replaceId?: string }) => {
      if (!eventId || !selectedParticipant || !user) throw new Error("Dados insuficientes");

      // Check if code is already used in this event
      const { data: existing } = await supabase
        .from("external_credentials")
        .select("id, participant:participants(full_name)")
        .eq("event_id", eventId)
        .eq("credential_code", code)
        .maybeSingle();

      if (existing) {
        throw new Error(`Credencial já vinculada a ${(existing as any).participant?.full_name || "outro participante"}`);
      }

      // If replacing, cancel old one
      if (replaceId) {
        await supabase
          .from("external_credentials")
          .update({ status: "replaced" })
          .eq("id", replaceId);
      }

      const { error } = await supabase.from("external_credentials").insert({
        event_id: eventId,
        participant_id: selectedParticipant.id,
        credential_code: code,
        linked_by_user_id: user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Credencial vinculada com sucesso!");
      if (navigator.vibrate) navigator.vibrate(200);
      qc.invalidateQueries({ queryKey: ["ext-cred-existing", eventId, selectedParticipant?.id] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao vincular credencial");
    },
  });

  // Cancel credential mutation
  const cancelMutation = useMutation({
    mutationFn: async (credId: string) => {
      const { error } = await supabase
        .from("external_credentials")
        .update({ status: "cancelled" })
        .eq("id", credId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Credencial cancelada");
      qc.invalidateQueries({ queryKey: ["ext-cred-existing", eventId, selectedParticipant?.id] });
    },
    onError: () => toast.error("Erro ao cancelar credencial"),
  });

  const handleScan = useCallback((rawValue: string) => {
    setScannerOpen(false);
    const code = rawValue.trim();
    if (!code) return;

    if (existingCred) {
      setPendingCode(code);
      setReplaceDialogOpen(true);
    } else {
      linkMutation.mutate({ code });
    }
  }, [existingCred, linkMutation]);

  const confirmReplace = () => {
    if (pendingCode && existingCred) {
      linkMutation.mutate({ code: pendingCode, replaceId: (existingCred as any).id });
    }
    setReplaceDialogOpen(false);
    setPendingCode(null);
  };

  return (
    <div className="space-y-6">
      <ModuleHeader title="Credenciamento Externo" description="Vincular credenciais físicas pré-impressas aos participantes" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Search */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar participante por nome ou CPF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {searchLoading && <Skeleton className="h-20 w-full" />}

          {!searchLoading && search.length >= 2 && participants?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhum participante encontrado
            </div>
          )}

          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {participants?.map((p) => (
              <Card
                key={p.id}
                className={`cursor-pointer transition-colors hover:border-primary/50 ${selectedParticipant?.id === p.id ? "border-primary ring-1 ring-primary/30" : ""}`}
                onClick={() => setSelectedParticipant(p)}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  {p.photo_url ? (
                    <img src={p.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {p.delegation_name || "Sem delegação"} {p.cpf ? `• ${p.cpf}` : ""}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setSelectedParticipant(p); }}>
                    Selecionar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Right: Selected participant + credential */}
        <div>
          {!selectedParticipant ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Selecione um participante na lista à esquerda</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  {selectedParticipant.photo_url ? (
                    <img src={selectedParticipant.photo_url} alt="" className="h-14 w-14 rounded-full object-cover" />
                  ) : (
                    <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-7 w-7 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-lg">{selectedParticipant.full_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{selectedParticipant.delegation_name || "Sem delegação"}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {credLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : existingCred ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="font-medium">Credencial Vinculada</span>
                      <Badge variant={STATUS_LABELS[(existingCred as any).status]?.variant || "outline"}>
                        {STATUS_LABELS[(existingCred as any).status]?.label || (existingCred as any).status}
                      </Badge>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Código</p>
                      <p className="font-mono text-lg font-bold">{(existingCred as any).credential_code}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => cancelMutation.mutate((existingCred as any).id)}
                        disabled={cancelMutation.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-1" /> Cancelar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setScannerOpen(true)}
                        disabled={linkMutation.isPending}
                      >
                        <ScanLine className="h-4 w-4 mr-1" /> Substituir
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <AlertTriangle className="h-5 w-5" />
                      <span className="text-sm">Nenhuma credencial externa vinculada</span>
                    </div>
                    <Button
                      className="w-full min-h-[56px] text-base"
                      onClick={() => setScannerOpen(true)}
                      disabled={linkMutation.isPending}
                    >
                      <ScanLine className="h-5 w-5 mr-2" />
                      Escanear Credencial
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <QrCodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        title="Escanear Credencial Externa"
      />

      <AlertDialog open={replaceDialogOpen} onOpenChange={setReplaceDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir credencial?</AlertDialogTitle>
            <AlertDialogDescription>
              Este participante já possui a credencial <strong className="font-mono">{(existingCred as any)?.credential_code}</strong>. 
              Deseja cancelar a credencial atual e vincular a nova?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReplace}>Substituir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
