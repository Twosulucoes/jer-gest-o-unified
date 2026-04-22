import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Building, QrCode, LogIn, LogOut, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveEventId } from "@/contexts/EventContext";
import { useStageScope } from "@/hooks/useStageScope";

export default function AlojamentoOcupacaoPage() {
  const qc = useQueryClient();
  const { user, hasRole } = useAuth();
  const selectedEventId = useActiveEventId();
  const { isStageScoped, stageId } = useStageScope();
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const canOperate = hasRole("admin") || hasRole("secretaria");

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["lodging_locations", selectedEventId, stageId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      let q = supabase.from("lodging_locations").select("*").eq("event_id", selectedEventId).eq("is_active", true).order("name");
      if (isStageScoped && stageId) q = q.eq("event_stage_id", stageId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const { data: units = [] } = useQuery({
    queryKey: ["lodging_units", selectedEventId, stageId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      let q = supabase.from("lodging_units").select("*").eq("event_id", selectedEventId).eq("is_active", true).order("name");
      if (isStageScoped && stageId) q = q.eq("event_stage_id", stageId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!selectedEventId,
  });

  const locationsMap = new Map(locations.map((l) => [l.id, l]));

  // Occupancies for selected unit
  const { data: occupancies = [], isLoading: occLoading } = useQuery({
    queryKey: ["lodging_occupancies", selectedUnitId],
    queryFn: async () => {
      if (!selectedUnitId) return [];
      const { data, error } = await supabase.from("lodging_occupancies").select("*").eq("unit_id", selectedUnitId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedUnitId,
  });

  const activeOccupancies = occupancies.filter((o) => o.status === "allocated" || o.status === "checked_in");

  // Load people for occupancies
  const occParticipantIds = occupancies.map((o) => o.participant_id);
  const { data: occParticipants = [] } = useQuery({
    queryKey: ["occ-participants", occParticipantIds],
    queryFn: async () => {
      if (!occParticipantIds.length) return [];
      const { data, error } = await supabase.from("participants").select("id, person_id, delegation_id").in("id", occParticipantIds);
      if (error) throw error;
      return data;
    },
    enabled: occParticipantIds.length > 0,
  });

  const occPersonIds = occParticipants.map((p) => p.person_id);
  const { data: occPeople = [] } = useQuery({
    queryKey: ["occ-people", occPersonIds],
    queryFn: async () => {
      if (!occPersonIds.length) return [];
      const { data, error } = await supabase.from("people").select("id, full_name, cpf, gender").in("id", occPersonIds);
      if (error) throw error;
      return data;
    },
    enabled: occPersonIds.length > 0,
  });

  const partMap = new Map(occParticipants.map((p) => [p.id, p]));
  const pplMap = new Map(occPeople.map((p) => [p.id, p]));
  const getPersonForOcc = (participantId: string) => {
    const pt = partMap.get(participantId);
    return pt ? pplMap.get(pt.person_id) : null;
  };

  const activeParticipantIds = new Set(activeOccupancies.map((o) => o.participant_id));
  const selectedUnit = units.find((u) => u.id === selectedUnitId);
  const unitFull = selectedUnit ? activeOccupancies.length >= selectedUnit.capacity : false;

  // Check-in
  const checkinMut = useMutation({
    mutationFn: async (occId: string) => {
      const { error } = await supabase.from("lodging_occupancies").update({
        status: "checked_in",
        checked_in_at: new Date().toISOString(),
        checked_in_by: user!.id,
      }).eq("id", occId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lodging_occupancies", selectedUnitId] });
      toast.success("Check-in realizado!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  // Check-out
  const checkoutMut = useMutation({
    mutationFn: async (occId: string) => {
      const { error } = await supabase.from("lodging_occupancies").update({
        status: "checked_out",
        checked_out_at: new Date().toISOString(),
        checked_out_by: user!.id,
      }).eq("id", occId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lodging_occupancies", selectedUnitId] });
      toast.success("Check-out realizado!");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });
  const statusLabel = (s: string) => s === "allocated" ? "Alocado" : s === "checked_in" ? "Check-in" : "Check-out";
  const statusVariant = (s: string): "default" | "secondary" | "outline" => s === "checked_in" ? "default" : s === "allocated" ? "outline" : "secondary";

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Ocupação / Check-in</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestão operacional de alojamento</p>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Evento</label>
              <Select value={selectedEventId} onValueChange={(v) => { setSelectedUnitId(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione o evento" /></SelectTrigger>
                <SelectContent>{events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name} ({e.year})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Unidade</label>
              <Select value={selectedUnitId} onValueChange={setSelectedUnitId} disabled={!selectedEventId}>
                <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                <SelectContent>
                  {units.map((u) => {
                    const loc = locationsMap.get(u.location_id);
                    return (
                      <SelectItem key={u.id} value={u.id}>
                        {loc?.name ? `${loc.name} — ` : ""}{u.name} (cap. {u.capacity})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {selectedUnitId && selectedUnit && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Unidade</p>
            <p className="text-lg font-bold text-foreground">{selectedUnit.name}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Capacidade</p>
            <p className="text-2xl font-bold text-foreground">{selectedUnit.capacity}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Ocupados</p>
            <p className="text-2xl font-bold text-foreground">{activeOccupancies.length}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Vagas</p>
            <p className={`text-2xl font-bold ${unitFull ? "text-destructive" : "text-foreground"}`}>
              {Math.max(0, selectedUnit.capacity - activeOccupancies.length)}
            </p>
          </CardContent></Card>
        </div>
      )}

      {/* Alocar participante - Substituído por botão para PWA */}
      {canOperate && selectedUnitId && !unitFull && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6 pb-6 flex flex-col items-center text-center space-y-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <QrCode className="h-8 w-8 text-primary" />
            </div>
            <div className="max-w-md">
              <h3 className="text-lg font-bold text-foreground">Alocar Participante</h3>
              <p className="text-sm text-muted-foreground mt-1">
                A alocação de participantes e realização de check-in agora deve ser feita através do módulo PWA para melhor experiência e suporte a leitura de QR Code.
              </p>
            </div>
            <Button 
              size="lg" 
              className="w-full max-w-xs"
              onClick={() => window.location.href = "/pwa/alojamento"}
            >
              Ir para Alocação (PWA)
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Occupancy list */}
      {selectedUnitId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building className="h-4 w-4" /> Ocupantes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {occLoading ? (
              <div className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)}</div>
            ) : !occupancies.length ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Nenhum ocupante nesta unidade.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Check-out</TableHead>
                    {canOperate && <TableHead className="w-[120px]" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {occupancies.map((o) => {
                    const person = getPersonForOcc(o.participant_id);
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">{person?.full_name ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">{person?.cpf ?? "—"}</TableCell>
                        <TableCell><Badge variant={statusVariant(o.status)}>{statusLabel(o.status)}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {o.checked_in_at ? new Date(o.checked_in_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {o.checked_out_at ? new Date(o.checked_out_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                        </TableCell>
                        {canOperate && (
                          <TableCell className="space-x-1">
                            {o.status === "allocated" && (
                              <Button size="sm" variant="outline" onClick={() => checkinMut.mutate(o.id)} disabled={checkinMut.isPending}>
                                <LogIn className="mr-1 h-3 w-3" /> In
                              </Button>
                            )}
                            {(o.status === "allocated" || o.status === "checked_in") && (
                              <Button size="sm" variant="outline" onClick={() => checkoutMut.mutate(o.id)} disabled={checkoutMut.isPending}>
                                <LogOut className="mr-1 h-3 w-3" /> Out
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
      )}

      {!selectedEventId && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Building className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Selecione um evento</p>
        </div>
      )}
      {selectedEventId && !selectedUnitId && units.length > 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <Building className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">Selecione uma unidade</p>
        </div>
      )}
    </div>
  );
}
