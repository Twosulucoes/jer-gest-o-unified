import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowLeft, Users, XCircle, QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

  // Already boarded IDs (active)
  const boardedIds = new Set(
    passengers.filter((p) => p.status === "boarded").map((p) => p.participant_id)
  );

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

      {/* Adicionar participante - Substituído por botão para PWA */}
      {canOperate && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6 pb-6 flex flex-col items-center text-center space-y-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <QrCode className="h-8 w-8 text-primary" />
            </div>
            <div className="max-w-md">
              <h3 className="text-lg font-bold text-foreground">Registrar Embarque</h3>
              <p className="text-sm text-muted-foreground mt-1">
                O registro de embarque de passageiros agora deve ser realizado através do módulo PWA para melhor experiência e suporte a leitura de QR Code.
              </p>
            </div>
            <Button 
              size="lg" 
              className="w-full max-w-xs"
              onClick={() => window.location.href = "/pwa/transporte"}
            >
              Ir para Embarque (PWA)
            </Button>
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
      <ParticipantReviewDialog
        open={showReview}
        onOpenChange={setShowReview}
        participant={qrResult}
        onConfirm={() => {
          if (qrResult) {
            boardMut.mutate(qrResult.participantId);
          }
        }}
        confirmLabel={boardedIds.has(qrResult?.participantId ?? "") ? "Já Embarcado" : "Registrar Embarque"}
        loading={boardMut.isPending}
        title="Validar Embarque"
        statusLabel={boardedIds.has(qrResult?.participantId ?? "") ? "JÁ EMBARCADO" : "PRONTO PARA EMBARCAR"}
        statusColor={boardedIds.has(qrResult?.participantId ?? "") ? "bg-muted border-border" : "bg-blue-50 border-blue-200 text-blue-700"}
        statusIcon={boardedIds.has(qrResult?.participantId ?? "") ? <AlertTriangle className="h-8 w-8 text-muted-foreground" /> : <CheckCircle2 className="h-8 w-8 text-blue-600" />}
        message={boardedIds.has(qrResult?.participantId ?? "") ? "Este participante já está registrado nesta viagem." : "Confirme os dados para registrar o embarque."}
      />
    </div>
  );
}
