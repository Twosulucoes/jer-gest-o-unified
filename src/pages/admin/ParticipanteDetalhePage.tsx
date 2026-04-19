import { useState } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { generateCredentialCode, generateQrCodeValue } from "@/lib/credentialUtils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, User, IdCard, Bus, Trophy, CheckCircle, Tag, ArrowLeft, Eye, RefreshCw, Activity, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import ParticipantResumoTab from "@/components/admin/participant/ParticipantResumoTab";
import ParticipantHistoricoTab from "@/components/admin/participant/ParticipantHistoricoTab";
import ParticipantCredencialTab from "@/components/admin/participant/ParticipantCredencialTab";
import ParticipantLogisticaTab from "@/components/admin/participant/ParticipantLogisticaTab";
import ParticipantRastreamentoTab from "@/components/admin/participant/ParticipantRastreamentoTab";
import ParticipantVoucherTab from "@/components/admin/participant/ParticipantVoucherTab";
import { SingleLabelDialog } from "@/components/admin/CredentialLabelPrint";
import CredentialPreviewDialog from "@/components/admin/CredentialPreviewDialog";

const TYPE_LABELS: Record<string, string> = {
  athlete: "Atleta", coach: "Técnico", head_of_delegation: "Chefe Delegação", staff: "Staff",
};
const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Pendente", variant: "outline" },
  confirmed: { label: "Confirmado", variant: "secondary" },
  credentialed: { label: "Credenciado", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

export default function ParticipanteDetalhePage() {
  const { participantId } = useParams<{ participantId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();

  const [labelOpen, setLabelOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reissueConfirmOpen, setReissueConfirmOpen] = useState(false);

  const { data: participant, isLoading: loadingParticipant } = useQuery({
    queryKey: ["participant_full", participantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participants")
        .select("id, participant_type, person_id, delegation_id, event_id, status, is_active, notes, created_at")
        .eq("id", participantId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!participantId,
  });

  const { data: person } = useQuery({
    queryKey: ["person_detail", participant?.person_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("people")
        .select("id, full_name, cpf, gender, birth_date, email, phone, photo_url, food_restrictions, disability_type, medical_notes")
        .eq("id", participant!.person_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!participant?.person_id,
  });

  const { data: delegation } = useQuery({
    queryKey: ["delegation_detail", participant?.delegation_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delegations")
        .select("id, institution_id")
        .eq("id", participant!.delegation_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!participant?.delegation_id,
  });

  const { data: institution } = useQuery({
    queryKey: ["institution_detail", delegation?.institution_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institutions")
        .select("id, name")
        .eq("id", delegation!.institution_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!delegation?.institution_id,
  });

  const { data: activeCredential } = useQuery({
    queryKey: ["participant_active_cred_header", participantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_credentials")
        .select("id, status, credential_code, qr_code_value")
        .eq("participant_id", participantId!)
        .eq("event_id", participant!.event_id)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!participant?.event_id,
  });

  const { data: credentialTemplate } = useQuery({
    queryKey: ["credential_template_active", participant?.event_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credential_templates")
        .select("*")
        .eq("event_id", participant!.event_id)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!participant?.event_id,
  });

  const emitCredentialMutation = useMutation({
    mutationFn: async () => {
      if (!participant || !user) throw new Error("Dados insuficientes");
      const credentialCode = generateCredentialCode();
      const qrCodeValue = generateQrCodeValue(participant.event_id, participant.id, credentialCode);
      const { error } = await supabase.from("participant_credentials").insert({
        participant_id: participant.id,
        event_id: participant.event_id,
        credential_code: credentialCode,
        qr_code_value: qrCodeValue,
        status: "active",
        is_active: true,
        binding_source: "manual",
        activated_at: new Date().toISOString(),
        activated_by: user.id,
        issued_at: new Date().toISOString(),
        issued_by: user.id,
      });
      if (error) throw error;
      await supabase
        .from("participants")
        .update({ status: "credentialed", credentialed_at: new Date().toISOString(), credentialed_by: user.id })
        .eq("id", participant.id);
    },
    onSuccess: () => {
      toast({ title: "Credencial emitida com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["participant_active_cred_header"] });
      queryClient.invalidateQueries({ queryKey: ["participant_credentials"] });
      queryClient.invalidateQueries({ queryKey: ["participant_full"] });
      queryClient.invalidateQueries({ queryKey: ["participant_active_credential"] });
    },
    onError: (err) => {
      toast({ title: "Erro ao emitir credencial", description: String(err), variant: "destructive" });
    },
  });

  const reissueCredentialMutation = useMutation({
    mutationFn: async () => {
      if (!participant || !user || !activeCredential) throw new Error("Dados insuficientes");
      await supabase
        .from("participant_credentials")
        .update({ status: "reissued", is_active: false, revoked_at: new Date().toISOString() })
        .eq("id", activeCredential.id);
      const credentialCode = generateCredentialCode();
      const qrCodeValue = generateQrCodeValue(participant.event_id, participant.id, credentialCode);
      const { error } = await supabase.from("participant_credentials").insert({
        participant_id: participant.id,
        event_id: participant.event_id,
        credential_code: credentialCode,
        qr_code_value: qrCodeValue,
        status: "active",
        is_active: true,
        binding_source: "reissue",
        activated_at: new Date().toISOString(),
        activated_by: user.id,
        issued_at: new Date().toISOString(),
        issued_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "2ª via emitida com sucesso!" });
      setReissueConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["participant_active_cred_header"] });
      queryClient.invalidateQueries({ queryKey: ["participant_credentials"] });
      queryClient.invalidateQueries({ queryKey: ["participant_active_credential"] });
      queryClient.invalidateQueries({ queryKey: ["credential_scans"] });
    },
    onError: (err) => {
      toast({ title: "Erro ao reemitir credencial", description: String(err), variant: "destructive" });
      setReissueConfirmOpen(false);
    },
  });

  if (loadingParticipant) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="text-center py-12 text-muted-foreground">Participante não encontrado.</div>
    );
  }

  const statusInfo = STATUS_LABELS[participant.status] ?? { label: participant.status, variant: "outline" as const };
  const initials = person?.full_name?.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() ?? "?";
  const canCredential = (participant.status === "confirmed" || participant.status === "pending") && !activeCredential;
  const hasCredential = !!activeCredential;
  const canManageCredentials = hasRole("admin") || hasRole("secretaria") || hasRole("coordenacao_tecnica");

  const handleBack = () => {
    if (location.key !== "default") {
      navigate(-1);
    } else {
      navigate("/admin/participantes");
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Breadcrumbs + back */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0 h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/admin/participantes">Participantes</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{person?.full_name ?? "Detalhe"}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar className="h-14 w-14 shrink-0 ring-2 ring-primary/20">
          <AvatarImage src={person?.photo_url ?? undefined} />
          <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-foreground truncate">{person?.full_name ?? "Participante"}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge variant="outline">{TYPE_LABELS[participant.participant_type] ?? participant.participant_type}</Badge>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            {!participant.is_active && <Badge variant="destructive">Inativo</Badge>}
            {institution && (
              <span className="text-sm text-muted-foreground">• {institution.name}</span>
            )}
          </div>
        </div>

        {/* Quick actions — permission-gated */}
        {canManageCredentials && (
          <div className="flex gap-1.5 shrink-0 flex-wrap">
            {canCredential && (
              <Button
                size="sm"
                onClick={() => emitCredentialMutation.mutate()}
                disabled={emitCredentialMutation.isPending}
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                {emitCredentialMutation.isPending ? "Emitindo..." : "Registrar presença e emitir"}
              </Button>
            )}
            {hasCredential && (
              <>
                {credentialTemplate && (
                  <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
                    <Eye className="h-3.5 w-3.5 mr-1" />Credencial
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setLabelOpen(true)}>
                  <Tag className="h-3.5 w-3.5 mr-1" />Etiqueta
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setReissueConfirmOpen(true)}
                  disabled={reissueCredentialMutation.isPending}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  {reissueCredentialMutation.isPending ? "Reemitindo..." : "2ª Via"}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="resumo" className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
          <TabsTrigger value="resumo" className="gap-1.5">
            <User className="h-3.5 w-3.5" />Resumo
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5">
            <Trophy className="h-3.5 w-3.5" />Esportivo
          </TabsTrigger>
          <TabsTrigger value="credencial" className="gap-1.5">
            <IdCard className="h-3.5 w-3.5" />Credencial
          </TabsTrigger>
          <TabsTrigger value="logistica" className="gap-1.5">
            <Bus className="h-3.5 w-3.5" />Logística
          </TabsTrigger>
          <TabsTrigger value="rastreamento" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" />Rastreamento
          </TabsTrigger>
          <TabsTrigger value="vouchers" className="gap-1.5">
            <QrCode className="h-3.5 w-3.5" />Vouchers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumo">
          <ParticipantResumoTab participant={participant} person={person} institution={institution} />
        </TabsContent>
        <TabsContent value="historico">
          <ParticipantHistoricoTab participantId={participant.id} />
        </TabsContent>
        <TabsContent value="credencial">
          <ParticipantCredencialTab
            participantId={participant.id}
            eventId={participant.event_id}
            onEmitLabel={() => setLabelOpen(true)}
            onPreviewCredential={credentialTemplate ? () => setPreviewOpen(true) : undefined}
          />
        </TabsContent>
        <TabsContent value="logistica">
          <ParticipantLogisticaTab participantId={participant.id} eventId={participant.event_id} />
        </TabsContent>
        <TabsContent value="rastreamento">
          <ParticipantRastreamentoTab participantId={participant.id} eventId={participant.event_id} />
        </TabsContent>
        <TabsContent value="vouchers">
          <ParticipantVoucherTab participantId={participant.id} eventId={participant.event_id} />
        </TabsContent>
      </Tabs>

      {/* Reissue confirmation dialog */}
      <AlertDialog open={reissueConfirmOpen} onOpenChange={setReissueConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar reemissão de credencial</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">Ao confirmar, a credencial ativa atual será <strong>substituída</strong>.</span>
              <span className="block">• Um novo código e QR Code serão gerados</span>
              <span className="block">• A credencial anterior ficará com status "Reemitida"</span>
              <span className="block">• O histórico completo será preservado</span>
              <span className="block mt-2 text-foreground font-medium">Deseja prosseguir com a 2ª via?</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reissueCredentialMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                reissueCredentialMutation.mutate();
              }}
              disabled={reissueCredentialMutation.isPending}
            >
              {reissueCredentialMutation.isPending ? "Reemitindo..." : "Confirmar 2ª Via"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialogs */}
      {participantId && participant && (
        <>
          <SingleLabelDialog
            open={labelOpen}
            onOpenChange={setLabelOpen}
            participantId={participantId}
            eventId={participant.event_id}
          />
          {credentialTemplate && (
            <CredentialPreviewDialog
              open={previewOpen}
              onOpenChange={setPreviewOpen}
              template={credentialTemplate}
              participantId={participantId}
            />
          )}
        </>
      )}
    </div>
  );
}
