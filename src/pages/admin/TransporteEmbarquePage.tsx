import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCredentialLookup } from "@/hooks/useCredentialLookup";
import { toast } from "sonner";
import {
  ArrowLeft, Search, UserPlus, LogOut as AlightIcon, Users, Loader2, XCircle, QrCode, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ParticipantReviewDialog } from "@/components/admin/ParticipantReviewDialog";

const PASSENGER_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  boarded: { label: "Embarcado", variant: "default" },
  alighted: { label: "Desembarcado", variant: "secondary" },
  cancelled: { label: "Cancelado", variant: "destructive" },
  no_show: { label: "Não compareceu", variant: "outline" },
};

export default function TransporteEmbarquePage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, hasRole } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [qrResult, setQrResult] = useState<{ name: string; participantId: string; cpf: string | null; type: string; photo_url?: string | null; institution?: string | null; birth_date?: string | null } | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const { lookupByQrCode, loading: qrLoading } = useCredentialLookup();
  const canOperate = hasRole("admin") || hasRole("secretaria") || hasRole("transporte");

  // Load trip
  const { data: trip, isLoading: tripLoading } = useQuery({
    queryKey: ["transport_trip", tripId],
    queryFn: async () => {
      const { data, error } = await supabase.from("transport_trips").select("*").eq("id", tripId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!tripId,
  });

  // Load route info
  const { data: route } = useQuery({
    queryKey: ["transport_route", trip?.route_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("transport_routes").select("*").eq("id", trip!.route_id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!trip?.route_id,
  });

  // Load vehicle info
  const { data: vehicle } = useQuery({
    queryKey: ["transport_vehicle", trip?.vehicle_id],
    queryFn: async () => {
      if (!trip?.vehicle_id) return null;
      const { data, error } = await supabase.from("transport_vehicles").select("*").eq("id", trip.vehicle_id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!trip?.vehicle_id,
  });

  // Load current passengers
  const { data: passengers = [], isLoading: passengersLoading } = useQuery({
    queryKey: ["transport_passengers", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transport_passengers")
        .select("*")
        .eq("trip_id", tripId!)
        .order("boarded_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tripId,
  });

  // Load participant details for passengers
  const passengerParticipantIds = passengers.map((p) => p.participant_id);
  const { data: passengerParticipants = [] } = useQuery({
    queryKey: ["passenger-participants", passengerParticipantIds],
    queryFn: async () => {
      if (!passengerParticipantIds.length) return [];
      const { data, error } = await supabase.from("participants").select("id, person_id").in("id", passengerParticipantIds);
      if (error) throw error;
      return data;
    },
    enabled: passengerParticipantIds.length > 0,
  });

  const passengerPersonIds = passengerParticipants.map((p) => p.person_id);
  const { data: passengerPeople = [] } = useQuery({
    queryKey: ["passenger-people", passengerPersonIds],
    queryFn: async () => {
      if (!passengerPersonIds.length) return [];
      const { data, error } = await supabase.from("people").select("id, full_name, cpf").in("id", passengerPersonIds);
      if (error) throw error;
      return data;
    },
    enabled: passengerPersonIds.length > 0,
  });

  const participantMap = new Map(passengerParticipants.map((p) => [p.id, p]));
  const peopleMap = new Map(passengerPeople.map((p) => [p.id, p]));

  const getPersonForPassenger = (participantId: string) => {
    const part = participantMap.get(participantId);
    return part ? peopleMap.get(part.person_id) : null;
  };

  // Stage participant IDs for the trip's stage (for search scoping)
  const { data: tripStageParticipantIds } = useQuery({
    queryKey: ["stage_participant_ids", trip?.event_stage_id],
    enabled: !!(trip as any)?.event_stage_id,
    queryFn: async () => {
      const { data, error } = await (supabase.from("participant_event_stages" as never) as any)
        .select("participant_id")
        .eq("event_stage_id", (trip as any).event_stage_id);
      if (error) throw error;
      return new Set<string>((data ?? []).map((r: any) => r.participant_id as string));
    },
  });

  // Search participants to add — limited to trip's stage when available
  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ["search-participants-transport", trip?.event_id, (trip as any)?.event_stage_id, searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2 || !trip?.event_id) return [];

      // Search people first
      const { data: ppl, error: pplErr } = await supabase
        .from("people")
        .select("id, full_name, cpf")
        .or(`full_name.ilike.%${searchTerm}%,cpf.eq.${searchTerm}`)
        .limit(20);
      if (pplErr) throw pplErr;
      if (!ppl.length) return [];

      const personIds = ppl.map((p) => p.id);
      const { data: parts, error: partsErr } = await supabase
        .from("participants")
        .select("id, person_id, status, participant_type")
        .eq("event_id", trip.event_id)
        .eq("is_active", true)
        .in("person_id", personIds);
      if (partsErr) throw partsErr;

      const mapped = parts.map((pt) => ({
        ...pt,
        person: ppl.find((p) => p.id === pt.person_id),
      }));
      if ((trip as any).event_stage_id && tripStageParticipantIds) {
        return mapped.filter((pt) => tripStageParticipantIds.has(pt.id));
      }
      return mapped;
    },
    enabled: !!searchTerm && searchTerm.length >= 2 && !!trip?.event_id,
  });

  // Already boarded IDs (active)
  const boardedIds = new Set(
    passengers.filter((p) => p.status === "boarded").map((p) => p.participant_id)
  );

  // Board mutation
  const boardMut = useMutation({
    mutationFn: async (participantId: string) => {
      const { error } = await supabase.from("transport_passengers").insert({
        trip_id: tripId!,
        participant_id: participantId,
        status: "boarded",
        boarded_at: new Date().toISOString(),
        boarded_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transport_passengers", tripId] });
      toast.success("Participante embarcado!");
      setShowReview(false);
      setQrCode("");
      setQrResult(null);
    },
    onError: (e: Error) => {
      if (e.message?.includes("uq_transport_passenger_active")) {
        toast.error("Participante já está embarcado nesta viagem.");
      } else {
        toast.error("Erro: " + e.message);
      }
    },
  });

  // Alight mutation
  const alightMut = useMutation({
    mutationFn: async (passengerId: string) => {
      const { error } = await supabase.from("transport_passengers").update({
        status: "alighted",
        alighted_at: new Date().toISOString(),
        alighted_by: user?.id,
      }).eq("id", passengerId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transport_passengers", tripId] });
      toast.success("Desembarque registrado!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const boardedCount = passengers.filter((p) => p.status === "boarded").length;
  const totalCount = passengers.filter((p) => !["cancelled", "no_show"].includes(p.status)).length;

  if (tripLoading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}</div>;
  }

  if (!trip) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <XCircle className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground font-medium">Viagem não encontrada</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/transporte/viagens")}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/transporte/viagens")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Embarque</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {route?.name ?? "—"} • {vehicle ? (vehicle.label || vehicle.plate) : "Sem veículo"}
            {trip.scheduled_at && ` • ${new Date(trip.scheduled_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Embarcados</p>
            <p className="text-2xl font-bold text-foreground">{boardedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Total registros</p>
            <p className="text-2xl font-bold text-foreground">{totalCount}</p>
          </CardContent>
        </Card>
        {vehicle && (
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Capacidade</p>
              <p className="text-2xl font-bold text-foreground">{vehicle.capacity}</p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant={trip.status === "in_progress" ? "default" : "outline"}>{trip.status}</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Search to add */}
      {canOperate && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Adicionar participante</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* QR Code lookup */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1">
                <QrCode className="h-3 w-3" /> Busca por QR Code
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="Escanear ou colar código QR..."
                  value={qrCode}
                  onChange={(e) => { setQrCode(e.target.value); setQrResult(null); setQrError(null); }}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && qrCode.trim() && trip?.event_id) {
                      const { data, error } = await lookupByQrCode(qrCode.trim(), trip.event_id);
                      if (error) { setQrError(error.message); setQrResult(null); }
                      else if (data) {
                        setQrResult({ 
                          name: data.person_name, 
                          participantId: data.participant_id, 
                          cpf: data.person_cpf, 
                          type: data.participant_type,
                          photo_url: data.photo_url,
                          institution: data.institution,
                          birth_date: data.birth_date
                        });
                        setQrError(null);
                        setShowReview(true);
                      }
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!qrCode.trim() || qrLoading}
                  onClick={async () => {
                    if (qrCode.trim() && trip?.event_id) {
                      const { data, error } = await lookupByQrCode(qrCode.trim(), trip.event_id);
                      if (error) { setQrError(error.message); setQrResult(null); }
                      else if (data) {
                        setQrResult({ 
                          name: data.person_name, 
                          participantId: data.participant_id, 
                          cpf: data.person_cpf, 
                          type: data.participant_type,
                          photo_url: data.photo_url,
                          institution: data.institution,
                          birth_date: data.birth_date
                        });
                        setQrError(null);
                        setShowReview(true);
                      }
                    }
                  }}
                >
                  {qrLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                </Button>
              </div>
              {qrError && (
                <div className="mt-2 flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" /> {qrError}
                </div>
              )}
              {qrResult && (
                <div className="mt-2 flex items-center justify-between rounded-lg border px-4 py-2.5 bg-muted/30">
                  <div>
                    <p className="text-sm font-medium text-foreground">{qrResult.name}</p>
                    <p className="text-xs text-muted-foreground">{qrResult.cpf ?? "Sem CPF"} • {qrResult.type === "athlete" ? "Atleta" : qrResult.type}</p>
                  </div>
                  <Button
                    size="sm"
                    disabled={boardedIds.has(qrResult.participantId) || boardMut.isPending}
                    variant={boardedIds.has(qrResult.participantId) ? "secondary" : "default"}
                    onClick={() => { boardMut.mutate(qrResult.participantId); setQrCode(""); setQrResult(null); }}
                  >
                    {boardedIds.has(qrResult.participantId) ? "Já embarcado" : <><UserPlus className="mr-1 h-3 w-3" />Embarcar</>}
                  </Button>
                </div>
              )}
            </div>

            {/* Manual search */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1">
                <Search className="h-3 w-3" /> Busca manual por nome/CPF
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou CPF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            {searching && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Buscando...</div>}
            {searchResults.length > 0 && (
              <div className="rounded-lg border divide-y max-h-60 overflow-y-auto">
                {searchResults.map((sr) => {
                  const alreadyBoarded = boardedIds.has(sr.id);
                  return (
                    <div key={sr.id} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-foreground">{sr.person?.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {sr.person?.cpf ?? "Sem CPF"} • {sr.participant_type === "athlete" ? "Atleta" : sr.participant_type}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={alreadyBoarded ? "secondary" : "default"}
                        disabled={alreadyBoarded || boardMut.isPending}
                        onClick={() => boardMut.mutate(sr.id)}
                      >
                        {alreadyBoarded ? "Já embarcado" : <><UserPlus className="mr-1 h-3 w-3" />Embarcar</>}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Passenger list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Manifesto de embarque
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {passengersLoading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)}</div>
          ) : !passengers.length ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Nenhum passageiro registrado nesta viagem.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Embarque</TableHead>
                  {canOperate && <TableHead className="w-[100px]">Ação</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {passengers.map((p) => {
                  const person = getPersonForPassenger(p.participant_id);
                  const st = PASSENGER_STATUS[p.status] ?? { label: p.status, variant: "outline" as const };
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{person?.full_name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{person?.cpf ?? "—"}</TableCell>
                      <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.boarded_at ? new Date(p.boarded_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                      </TableCell>
                      {canOperate && (
                        <TableCell>
                          {p.status === "boarded" && (
                            <Button size="sm" variant="outline" onClick={() => alightMut.mutate(p.id)} disabled={alightMut.isPending}>
                              <AlightIcon className="mr-1 h-3 w-3" />Desemb.
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
