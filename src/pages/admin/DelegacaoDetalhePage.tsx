import { useState } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Users, Trophy, IdCard, Bus, LayoutDashboard, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useAuth } from "@/hooks/useAuth";
import { BackButton } from "@/components/navigation/BackButton";

import DelegationResumoTab from "@/components/admin/delegation/DelegationResumoTab";
import DelegationParticipantesTab from "@/components/admin/delegation/DelegationParticipantesTab";
import DelegationEsportivoTab from "@/components/admin/delegation/DelegationEsportivoTab";
import DelegationCredenciamentoTab from "@/components/admin/delegation/DelegationCredenciamentoTab";
import DelegationLogisticaTab from "@/components/admin/delegation/DelegationLogisticaTab";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "outline" },
  confirmed: { label: "Confirmada", variant: "default" },
  rejected: { label: "Rejeitada", variant: "destructive" },
  cancelled: { label: "Cancelada", variant: "secondary" },
};

export default function DelegacaoDetalhePage() {
  const { delegationId } = useParams<{ delegationId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState("resumo");

  const canCredential = hasRole("admin") || hasRole("secretaria") || hasRole("coordenacao_tecnica");

  const { data: delegation, isLoading, isError } = useQuery({
    queryKey: ["delegation_detail", delegationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delegations")
        .select("*")
        .eq("id", delegationId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!delegationId,
  });

  const { data: institution } = useQuery({
    queryKey: ["institution_detail", delegation?.institution_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institutions")
        .select("id, name, city, state")
        .eq("id", delegation!.institution_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!delegation?.institution_id,
  });

  const { data: event } = useQuery({
    queryKey: ["event_detail", delegation?.event_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, year")
        .eq("id", delegation!.event_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!delegation?.event_id,
  });

  const { data: participantCount } = useQuery({
    queryKey: ["delegation_participant_count", delegationId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("participants")
        .select("id", { count: "exact", head: true })
        .eq("delegation_id", delegationId!)
        .eq("event_id", delegation!.event_id);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!delegation?.event_id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !delegation) {
    return (
      <div className="text-center py-12 space-y-2">
        <p className="text-muted-foreground font-medium">Delegação não encontrada</p>
        <p className="text-sm text-muted-foreground">Verifique o link ou volte para a listagem.</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/admin/delegacoes")} className="mt-2">
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />Voltar para Delegações
        </Button>
      </div>
    );
  }

  const statusInfo = STATUS_MAP[delegation.status] ?? { label: delegation.status, variant: "outline" as const };

  return (
    <div className="space-y-3 sm:space-y-4 animate-fade-in pb-4">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 -mx-1 sm:mx-0">
        <BackButton fallbackTo="/admin/delegacoes" />
        <Breadcrumb className="min-w-0 flex-1">
          <BreadcrumbList className="flex-nowrap">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/admin/delegacoes" className="text-sm">Delegações</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbPage className="truncate text-sm">{institution?.name ?? "Detalhe"}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Header — card compacto e responsivo */}
      <div className="rounded-xl border bg-card p-3 sm:p-4 shadow-app-sm">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
            <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-xl font-bold text-foreground leading-tight line-clamp-2 break-words">
              {institution?.name ?? "Delegação"}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
              <Badge variant={statusInfo.variant} className="text-xs">{statusInfo.label}</Badge>
              {participantCount != null && (
                <span className="text-xs text-muted-foreground">
                  {participantCount} participante{participantCount !== 1 ? "s" : ""}
                </span>
              )}
              {institution?.city && (
                <span className="text-xs text-muted-foreground truncate">
                  • {institution.city}{institution.state ? `/${institution.state}` : ""}
                </span>
              )}
            </div>
            {event && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {event.name} ({event.year})
              </p>
            )}
          </div>
        </div>

        {/* Quick actions — grid em mobile, inline em desktop */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mt-3 pt-3 border-t">
          <Button size="sm" variant="outline" onClick={() => setActiveTab("participantes")} className="justify-center">
            <Users className="h-3.5 w-3.5" />
            <span className="truncate">Participantes</span>
          </Button>
          {canCredential && (
            <Button size="sm" variant="outline" onClick={() => setActiveTab("credenciamento")} className="justify-center">
              <IdCard className="h-3.5 w-3.5" />
              <span className="truncate">Credenciar</span>
            </Button>
          )}
          {institution && (
            <Button size="sm" variant="ghost" asChild className="justify-center col-span-2 sm:col-span-1">
              <Link to={`/admin/instituicoes`}>
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="truncate">Instituição</span>
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs — scroll horizontal em mobile, sem quebra */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="-mx-1 sm:mx-0 overflow-x-auto scrollbar-none [-webkit-overflow-scrolling:touch]">
          <TabsList className="inline-flex sm:flex w-max sm:w-full justify-start gap-1 px-1 sm:px-1">
            <TabsTrigger value="resumo" className="gap-1.5 shrink-0">
              <LayoutDashboard className="h-3.5 w-3.5" />Resumo
            </TabsTrigger>
            <TabsTrigger value="participantes" className="gap-1.5 shrink-0">
              <Users className="h-3.5 w-3.5" />Participantes
            </TabsTrigger>
            <TabsTrigger value="esportivo" className="gap-1.5 shrink-0">
              <Trophy className="h-3.5 w-3.5" />Esportivo
            </TabsTrigger>
            {canCredential && (
              <TabsTrigger value="credenciamento" className="gap-1.5 shrink-0">
                <IdCard className="h-3.5 w-3.5" />Credenciamento
              </TabsTrigger>
            )}
            <TabsTrigger value="logistica" className="gap-1.5 shrink-0">
              <Bus className="h-3.5 w-3.5" />Logística
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="resumo">
          <DelegationResumoTab delegation={delegation} institution={institution} event={event} />
        </TabsContent>
        <TabsContent value="participantes">
          <DelegationParticipantesTab delegationId={delegation.id} eventId={delegation.event_id} />
        </TabsContent>
        <TabsContent value="esportivo">
          <DelegationEsportivoTab delegationId={delegation.id} eventId={delegation.event_id} />
        </TabsContent>
        {canCredential && (
          <TabsContent value="credenciamento">
            <DelegationCredenciamentoTab delegationId={delegation.id} eventId={delegation.event_id} />
          </TabsContent>
        )}
        <TabsContent value="logistica">
          <DelegationLogisticaTab delegationId={delegation.id} eventId={delegation.event_id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
