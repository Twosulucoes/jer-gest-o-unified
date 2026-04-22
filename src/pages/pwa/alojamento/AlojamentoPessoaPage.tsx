import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { rpcCheckin, rpcCheckout, getDeviceId, getSelectedFacility } from "@/hooks/useAlojamento";
import { ArrowLeft, User, LogIn, LogOut, Bed, ScanLine, AlertCircle, Building, Loader2 } from "lucide-react";
import { AlojamentoNavHeader } from "@/components/pwa/alojamento/AlojamentoNavHeader";
import { useEventContext } from "@/contexts/EventContext";

interface PersonDetail {
  id: string;
  full_name: string;
  birth_date: string | null;
  gender: string;
  participant_type: string;
  delegation_name: string | null;
  is_checked_in: boolean;
  stay_checkin_at: string | null;
  facility_name: string | null;
  bed_code: string | null;
  room_code: string | null;
  block_name: string | null;
}

export default function AlojamentoPessoaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeEvent } = useEventContext();
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [credentialStatus, setCredentialStatus] = useState<string | null>(null);
  const facilityId = getSelectedFacility();

  const loadPerson = async () => {
    if (!id || !facilityId) return;
    setLoading(true);

    const { data: participant } = await supabase
      .from("participants")
      .select("id, participant_type, delegation_id, person:people(full_name, birth_date, gender)")
      .eq("id", id)
      .single();

    if (!participant) {
      setLoading(false);
      return;
    }

    const p = participant as any;

    // Get delegation name
    let delegationName: string | null = null;
    if (p.delegation_id) {
      const { data: del } = await supabase.from("delegations").select("institution:institutions(name)").eq("id", p.delegation_id).single();
      delegationName = (del as any)?.institution?.name || null;
    }

    // Check credential status for active stage
    const { data: activeStage } = await supabase
      .from("event_stages")
      .select("id")
      .eq("event_id", activeEvent?.id)
      .eq("status", "active")
      .maybeSingle();

    if (activeStage) {
      const { data: pse } = await supabase
        .from("participant_event_stages")
        .select("status")
        .eq("participant_id", id)
        .eq("event_stage_id", activeStage.id)
        .maybeSingle();
      
      setCredentialStatus(pse?.status || "missing");
    }

    // Get stay + assignment info via public wrapper
    const { data: alj } = await supabase.rpc("get_alojamento_person_detail" as any, {
      p_participant_id: id,
      p_facility_id: facilityId,
    });
    const aljData = (alj as any) || {};

    setPerson({
      id: id,
      full_name: p.person?.full_name || "—",
      birth_date: p.person?.birth_date || null,
      gender: p.person?.gender || "—",
      participant_type: p.participant_type,
      delegation_name: delegationName,
      is_checked_in: aljData.is_checked_in ?? false,
      stay_checkin_at: aljData.stay_checkin_at || null,
      facility_name: aljData.facility_name || null,
      bed_code: aljData.bed_code || null,
      room_code: aljData.room_code || null,
      block_name: aljData.block_name || null,
    });
    setLoading(false);
  };

  useEffect(() => { loadPerson(); }, [id, facilityId, activeEvent?.id]);

  const handleCheckin = async () => {
    if (!id || !facilityId) return;
    
    // Validate credential before checkin
    if (credentialStatus !== "active") {
      toast.error("Este participante não possui credencial ativa para a etapa atual!");
      if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
      return;
    }

    setActionLoading(true);
    try {
      const res = await rpcCheckin(getDeviceId(), id, facilityId, "search");
      if (res.ok) {
        toast.success("Check-in realizado!");
        loadPerson();
      } else {
        toast.error(res.message || res.error);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
    setActionLoading(false);
  };

  const handleCheckout = async () => {
    if (!id || !facilityId) return;
    setActionLoading(true);
    try {
      const res = await rpcCheckout(getDeviceId(), id, facilityId);
      if (res.ok) {
        toast.success("Check-out realizado!");
        loadPerson();
      } else {
        toast.error(res.message || res.error);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
    setActionLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <AlojamentoNavHeader currentPathLabel="Perfil" />

      <main className="p-4 max-w-md mx-auto space-y-4 pb-20">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        ) : !person ? (
          <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-2xl border-dashed">
            <User className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Pessoa não encontrada</p>
          </div>
        ) : (
          <>
            <Card className="rounded-2xl border-border/60 shadow-md overflow-hidden">
               <div className="h-2 bg-primary/20" />
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold">{person.full_name}</CardTitle>
                <Badge variant="outline" className="w-fit text-[10px] font-bold uppercase border-primary/20 bg-primary/5 text-primary">
                  {person.participant_type}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Gênero</p>
                    <p className="font-medium">{person.gender}</p>
                  </div>
                  {person.birth_date && (
                    <div>
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Nascimento</p>
                      <p className="font-medium">{new Date(person.birth_date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                    </div>
                  )}
                </div>
                {person.delegation_name && (
                  <div>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Delegação</p>
                    <p className="font-medium">{person.delegation_name}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Credential Status Warning */}
            {credentialStatus !== "active" && !person.is_checked_in && (
              <Card className="rounded-2xl border-destructive/30 bg-destructive/5">
                <CardContent className="p-4 flex gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-destructive">Credencial Irregular</p>
                    <p className="text-xs text-destructive/80 font-medium">
                      Este participante não possui uma credencial ativa para a etapa atual. O check-in está bloqueado.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="rounded-2xl border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Building className="h-4 w-4 text-purple-500" />
                  Hospedagem
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant={person.is_checked_in ? "default" : "secondary"} className={`text-xs font-bold ${person.is_checked_in ? "bg-green-600" : ""}`}>
                    {person.is_checked_in ? "Hospedado" : "Não hospedado"}
                  </Badge>
                </div>
                {person.is_checked_in && person.facility_name && (
                  <div className="p-3 rounded-xl bg-muted/30 border border-border/40 space-y-1">
                    <p className="text-xs font-bold text-foreground">Local: {person.facility_name}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">
                      Check-in em {person.stay_checkin_at ? new Date(person.stay_checkin_at).toLocaleString("pt-BR") : "—"}
                    </p>
                  </div>
                )}
                {person.bed_code && (
                  <div className="flex items-center gap-2 text-sm font-medium p-3 rounded-xl bg-primary/5 border border-primary/10">
                    <Bed className="h-4 w-4 text-primary" />
                    <span>{person.block_name} / {person.room_code} / Leito {person.bed_code}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3 pt-2">
              {!person.is_checked_in ? (
                <Button 
                  className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg shadow-primary/10" 
                  onClick={handleCheckin} 
                  disabled={actionLoading || credentialStatus !== "active"}
                >
                  {actionLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <LogIn className="h-5 w-5 mr-2" />}
                  Realizar Check-in
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  className="w-full h-14 rounded-2xl text-lg font-bold border-destructive/20 text-destructive hover:bg-destructive/5" 
                  onClick={handleCheckout} 
                  disabled={actionLoading}
                >
                   {actionLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <LogOut className="h-5 w-5 mr-2" />}
                  Realizar Check-out
                </Button>
              )}
              
              <Button 
                variant="ghost" 
                className="w-full h-12 rounded-xl font-bold text-muted-foreground hover:text-foreground" 
                onClick={() => navigate("/pwa/alojamento/scan")}
              >
                <ScanLine className="h-4 w-4 mr-2" /> Próximo Escaneamento
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
