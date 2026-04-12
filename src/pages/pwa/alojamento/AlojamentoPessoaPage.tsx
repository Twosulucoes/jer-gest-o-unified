import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { rpcCheckin, rpcCheckout, getDeviceId, getSelectedFacility } from "@/hooks/useAlojamento";
import { ArrowLeft, User, LogIn, LogOut, Bed } from "lucide-react";

interface PersonDetail {
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
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
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

    // Get stay info
    const { data: stay } = await supabase.schema("alojamento" as any)
      .from("stays").select("id, checkin_at, facility_id")
      .eq("person_id", id).eq("status", "hospedado").limit(1).maybeSingle();

    let facilityName: string | null = null;
    if (stay) {
      const { data: fac } = await supabase.schema("alojamento" as any)
        .from("facilities").select("name").eq("id", (stay as any).facility_id).single();
      facilityName = (fac as any)?.name || null;
    }

    // Get assignment
    const { data: assignment } = await supabase.schema("alojamento" as any)
      .from("assignments").select("bed_id").eq("person_id", id).eq("active", true).maybeSingle();

    let bedCode: string | null = null;
    let roomCode: string | null = null;
    let blockName: string | null = null;
    if (assignment) {
      const { data: bed } = await supabase.schema("alojamento" as any)
        .from("beds").select("bed_code, room:rooms(code, block:blocks(name))").eq("id", (assignment as any).bed_id).single();
      if (bed) {
        const b = bed as any;
        bedCode = b.bed_code;
        roomCode = b.room?.code || null;
        blockName = b.room?.block?.name || null;
      }
    }

    setPerson({
      full_name: p.person?.full_name || "—",
      birth_date: p.person?.birth_date || null,
      gender: p.person?.gender || "—",
      participant_type: p.participant_type,
      delegation_name: delegationName,
      is_checked_in: !!stay,
      stay_checkin_at: (stay as any)?.checkin_at || null,
      facility_name: facilityName,
      bed_code: bedCode,
      room_code: roomCode,
      block_name: blockName,
    });
    setLoading(false);
  };

  useEffect(() => { loadPerson(); }, [id, facilityId]);

  const handleCheckin = async () => {
    if (!id || !facilityId) return;
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
      // Need to get QR token for this person, or use direct ID approach
      // For search-based checkout, we pass the participant UUID directly
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
      <header className="flex items-center gap-2 border-b bg-card px-4 h-14">
        <button onClick={() => navigate(-1)} className="text-muted-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <User className="h-5 w-5 text-primary" />
        <span className="font-semibold text-foreground">Perfil</span>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : !person ? (
          <div className="text-center py-8 text-muted-foreground">Pessoa não encontrada</div>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{person.full_name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Tipo:</span> {person.participant_type}</p>
                <p><span className="text-muted-foreground">Gênero:</span> {person.gender}</p>
                {person.birth_date && <p><span className="text-muted-foreground">Nascimento:</span> {person.birth_date}</p>}
                {person.delegation_name && <p><span className="text-muted-foreground">Delegação:</span> {person.delegation_name}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Status de Hospedagem</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Badge variant={person.is_checked_in ? "default" : "secondary"} className="text-sm">
                  {person.is_checked_in ? "Hospedado" : "Não hospedado"}
                </Badge>
                {person.is_checked_in && person.facility_name && (
                  <p className="text-sm text-muted-foreground">
                    em {person.facility_name} desde {person.stay_checkin_at ? new Date(person.stay_checkin_at).toLocaleString("pt-BR") : "—"}
                  </p>
                )}
                {person.bed_code && (
                  <div className="flex items-center gap-2 text-sm">
                    <Bed className="h-4 w-4 text-muted-foreground" />
                    <span>{person.block_name} / {person.room_code} / Leito {person.bed_code}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-2">
              {!person.is_checked_in ? (
                <Button className="flex-1 h-12" onClick={handleCheckin} disabled={actionLoading}>
                  <LogIn className="h-4 w-4 mr-2" /> Check-in
                </Button>
              ) : (
                <Button variant="outline" className="flex-1 h-12" onClick={handleCheckout} disabled={actionLoading}>
                  <LogOut className="h-4 w-4 mr-2" /> Check-out
                </Button>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
