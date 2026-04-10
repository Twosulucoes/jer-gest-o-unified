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

  const { data: delegation, isLoading } = useQuery({
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

  if (!delegation) {
    return <div className="text-center py-12 text-muted-foreground">Delegação não encontrada.</div>;
  }

  const statusInfo = STATUS_MAP[delegation.status] ?? { label: delegation.status, variant: "outline" as const };

  const handleBack = () => {
    if (location.key !== "default") {
      navigate(-1);
    } else {
      navigate("/admin/delegacoes");
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0 h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/admin/delegacoes">Delegações</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{institution?.name ?? "Detalhe"}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 shrink-0 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-foreground truncate">
            {institution?.name ?? "Delegação"}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            {event && (
              <span className="text-sm text-muted-foreground">
                {event.name} ({event.year})
              </span>
            )}
            {participantCount != null && (
              <span className="text-sm text-muted-foreground">
                • {participantCount} participante{participantCount !== 1 ? "s" : ""}
              </span>
            )}
            {institution?.city && (
              <span className="text-sm text-muted-foreground">
                • {institution.city}{institution.state ? `/${institution.state}` : ""}
              </span>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex gap-1.5 shrink-0 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setActiveTab("participantes")}>
            <Users className="h-3.5 w-3.5 mr-1" />Participantes
          </Button>
          {canCredential && (
            <Button size="sm" variant="outline" onClick={() => setActiveTab("credenciamento")}>
              <IdCard className="h-3.5 w-3.5 mr-1" />Credenciamento
            </Button>
          )}
          {institution && (
            <Button size="sm" variant="ghost" asChild>
              <Link to={`/admin/instituicoes`}>
                <ExternalLink className="h-3.5 w-3.5 mr-1" />Instituição
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
          <TabsTrigger value="resumo" className="gap-1.5">
            <LayoutDashboard className="h-3.5 w-3.5" />Resumo
          </TabsTrigger>
          <TabsTrigger value="participantes" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />Participantes
          </TabsTrigger>
          <TabsTrigger value="esportivo" className="gap-1.5">
            <Trophy className="h-3.5 w-3.5" />Esportivo
          </TabsTrigger>
          <TabsTrigger value="credenciamento" className="gap-1.5">
            <IdCard className="h-3.5 w-3.5" />Credenciamento
          </TabsTrigger>
          <TabsTrigger value="logistica" className="gap-1.5">
            <Bus className="h-3.5 w-3.5" />Logística
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumo">
          <DelegationResumoTab delegation={delegation} institution={institution} event={event} />
        </TabsContent>
        <TabsContent value="participantes">
          <DelegationParticipantesTab delegationId={delegation.id} eventId={delegation.event_id} />
        </TabsContent>
        <TabsContent value="esportivo">
          <DelegationEsportivoTab delegationId={delegation.id} eventId={delegation.event_id} />
        </TabsContent>
        <TabsContent value="credenciamento">
          <DelegationCredenciamentoTab delegationId={delegation.id} eventId={delegation.event_id} />
        </TabsContent>
        <TabsContent value="logistica">
          <DelegationLogisticaTab delegationId={delegation.id} eventId={delegation.event_id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
