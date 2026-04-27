import { useState } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { generateCredentialCode, generateSignedQrCodeValue } from "@/lib/credentialUtils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, User, IdCard, Bus, Trophy, CheckCircle, Tag, ArrowLeft, Eye, RefreshCw, Activity, QrCode, Edit } from "lucide-react";
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
// import ParticipantVoucherTab from "@/components/admin/participant/ParticipantVoucherTab";
import { SingleLabelDialog } from "@/components/admin/CredentialLabelPrint";
import CredentialPreviewDialog from "@/components/admin/CredentialPreviewDialog";
import { BackButton } from "@/components/navigation/BackButton";
import PessoaFormDialog from "@/components/admin/people/PessoaFormDialog";

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
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: participant, isLoading: loadingParticipant, error: participantError } = useQuery({
    queryKey: ["participant_full", participantId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("participants") as any)
        .select("id, participant_type, person_id, delegation_id, event_id, status, is_active, notes, created_at")
        .eq("id", participantId!)
        .maybeSingle();
      
      if (error) throw error;
      return data as any;
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
        .maybeSingle();
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
        .maybeSingle();
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
        .maybeSingle();
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
      const qrCodeValue = await generateSignedQrCodeValue(participant.event_id, participant.id, credentialCode);
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
      const qrCodeValue = await generateSignedQrCodeValue(participant.event_id, participant.id, credentialCode);
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
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Carregando dados do participante...</p>
      </div>
    );
  }

  if (participantError) {
    const errorMessage = participantError instanceof Error 
      ? participantError.message 
      : typeof participantError === 'object' && participantError !== null
        ? (participantError as any).message || JSON.stringify(participantError)
        : String(participantError);

    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 max-w-md mx-auto text-center">
        <div className="bg-destructive/10 p-3 rounded-full">
          <Activity className="h-8 w-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold">Erro ao carregar dados</h2>
          <p className="text-sm text-muted-foreground">
            Ocorreu um problema ao buscar os dados deste participante. 
            Isso pode ser causado por uma falha na conexão ou um erro inesperado no banco de dados.
          </p>
          <p className="text-xs font-mono bg-muted p-2 rounded border break-all whitespace-pre-wrap">
            {errorMessage}
          </p>
        </div>
        <Button onClick={() => window.location.reload()}>Tentar Novamente</Button>
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
        <User className="h-10 w-10 text-muted-foreground opacity-50" />
        <div className="space-y-1">
          <p className="text-muted-foreground font-medium">Participante não encontrado.</p>
          <p className="text-sm text-muted-foreground">Verifique se o link está correto ou se o participante ainda existe.</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/admin/participantes">Voltar para a Lista</Link>
        </Button>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[participant.status] ?? { label: participant.status, variant: "outline" as const };
  const initials = person?.full_name?.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() ?? "?";
  const canCredential = (participant.status === "confirmed" || participant.status === "pending") && !activeCredential;
  const hasCredential = !!activeCredential;
  const canManageCredentials = hasRole("admin") || hasRole("secretaria") || hasRole("coordenacao_tecnica");

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Breadcrumbs + back */}
      <div className="flex items-center gap-2">
        <BackButton fallbackTo="/admin/participantes" />
        <Breadcrumb className="min-w-0">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/admin/participantes">Participantes</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden sm:inline-flex" />
            <BreadcrumbItem className="hidden sm:inline-flex min-w-0">
              <BreadcrumbPage className="truncate max-w-[48vw]">{person?.full_name ?? "Detalhe"}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Header */}
      <div className="rounded-xl border bg-card p-3 sm:p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-14 w-14 shrink-0 ring-2 ring-primary/20">
            <AvatarImage src={person?.photo_url ?? undefined} />
            <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-foreground leading-tight break-words">
              {person?.full_name ?? "Participante"}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2 text-xs gap-1.5 text-primary hover:text-primary hover:bg-primary/5"
                onClick={() => setEditDialogOpen(true)}
              >
                <Edit className="h-3.5 w-3.5" />
                Editar Dados
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="outline">{TYPE_LABELS[participant.participant_type] ?? participant.participant_type}</Badge>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
              {!participant.is_active && <Badge variant="destructive">Inativo</Badge>}
            </div>
            {institution && (
              <p className="text-sm text-muted-foreground mt-2 break-words leading-snug">{institution.name}</p>
            )}
          </div>
        </div>

        {/* Quick actions — permission-gated */}
        {canManageCredentials && (
          <div className="flex flex-col sm:flex-row gap-2">
            {canCredential && (
              <Button
                className="w-full sm:w-auto"
                size="sm"
                onClick={() => emitCredentialMutation.mutate()}
                disabled={emitCredentialMutation.isPending}
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                {emitCredentialMutation.isPending ? "Emitindo..." : "Registrar presença e emitir"}
              </Button>
            )}
            {hasCredential && (
              <div className="grid grid-cols-3 sm:flex gap-2 w-full sm:w-auto">
                {credentialTemplate && (
                  <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)} className="w-full">
                    <Eye className="h-3.5 w-3.5 mr-1" />Credencial
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setLabelOpen(true)} className="w-full">
                  <Tag className="h-3.5 w-3.5 mr-1" />Etiqueta
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setReissueConfirmOpen(true)}
                  disabled={reissueCredentialMutation.isPending}
                  className="w-full"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  {reissueCredentialMutation.isPending ? "Reemitindo..." : "2ª Via"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="resumo" className="w-full">
        <TabsList className="w-full justify-start h-auto gap-1 overflow-x-auto overscroll-x-contain touch-pan-x whitespace-nowrap">
          <TabsTrigger value="resumo" className="gap-1.5">
            <User className="h-3.5 w-3.5" />Resumo
          </TabsTrigger>
          {participant.participant_type === "athlete" && (
            <TabsTrigger value="historico" className="gap-1.5">
              <Trophy className="h-3.5 w-3.5" />Esportivo
            </TabsTrigger>
          )}
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
        {participant.participant_type === "athlete" && (
          <TabsContent value="historico">
            <ParticipantHistoricoTab participantId={participant.id} />
          </TabsContent>
        )}
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
        {/* Fluxo de voucher nominal desativado pela regra JER-VOU-01 */}
        {/* <TabsContent value="vouchers">
          <ParticipantVoucherTab participantId={participant.id} eventId={participant.event_id} />
        </TabsContent> */}
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

      <PessoaFormDialog 
        open={editDialogOpen} 
        onOpenChange={setEditDialogOpen} 
        participantId={participantId} 
      />
    </div>
  );
}
