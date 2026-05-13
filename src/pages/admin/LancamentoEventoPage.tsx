import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEventId } from "@/contexts/EventContext";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Calendar, ChevronDown, ChevronRight, Camera, Trash2, Upload, Users,
  UserCheck, ClipboardList, CheckCircle2, Loader2, Plus, X, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface SportEventOpt {
  id: string;
  name: string;
  isCollective: boolean;
  resultType: string | null;
}

interface DelegationOpt {
  id: string;
  institutionName: string;
  institutionId: string;
}

interface ParticipantOpt {
  pse_id: string;
  participantId: string;
  name: string;
  delegationId: string;
  institutionName: string;
}

interface IndividualResult {
  pse_id: string;
  participantId: string;
  name: string;
  delegationId: string;
  institutionName: string;
  position: number;
  scoreFinal: string;
  selected: boolean;
}

interface OfficialEntry {
  role: string;
  name: string;
  id: string; // client-side id for list management
}

interface PhotoPreview {
  file: File;
  preview: string;
}

const OFFICIAL_ROLES = [
  { value: "arbitro", label: "Árbitro" },
  { value: "arbitro_auxiliar", label: "Árbitro Auxiliar" },
  { value: "mesario", label: "Mesário" },
  { value: "delegado_partida", label: "Delegado" },
  { value: "cronometrista", label: "Cronometrista" },
  { value: "anotador", label: "Anotador" },
  { value: "outro", label: "Outro" },
];

const MAX_PHOTOS = 10;
const STORAGE_BUCKET = "evidencias-partida";

// ────────────────────────────────────────────────────────────────────────────
// Section wrapper
// ────────────────────────────────────────────────────────────────────────────

function Section({
  step,
  title,
  icon,
  open,
  onToggle,
  disabled,
  children,
}: {
  step: number;
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className={disabled ? "opacity-50 pointer-events-none" : ""}>
      <CardHeader
        className="cursor-pointer select-none py-4"
        onClick={onToggle}
      >
        <CardTitle className="flex items-center gap-3 text-base">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0">
            {step}
          </span>
          <span className="flex items-center gap-2 flex-1">
            {icon}
            {title}
          </span>
          {onToggle && (
            open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </CardTitle>
      </CardHeader>
      {open && <CardContent className="pt-0 space-y-4">{children}</CardContent>}
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Referee autocomplete
// ────────────────────────────────────────────────────────────────────────────

function RefereeSearch({ onSelect }: { onSelect: (name: string) => void }) {
  const [query, setQuery] = useState("");
  const { data: suggestions = [] } = useQuery({
    queryKey: ["referee-search", query],
    enabled: query.length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("referee_profiles")
        .select("id, full_name")
        .ilike("full_name", `%${query}%`)
        .eq("status", "ativo")
        .limit(8);
      return data ?? [];
    },
  });

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar árbitro cadastrado..."
          className="pl-9"
        />
      </div>
      {query.length >= 2 && (
        <div className="absolute z-10 top-full mt-1 w-full rounded-md border bg-popover shadow-md">
          {suggestions.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground text-center">
              Não encontrado —{" "}
              <button
                type="button"
                className="text-primary underline"
                onClick={() => {
                  onSelect(query);
                  setQuery("");
                }}
              >
                adicionar "{query}"
              </button>
            </div>
          ) : (
            suggestions.map((r: { id: string; full_name: string }) => (
              <button
                key={r.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                onClick={() => {
                  onSelect(r.full_name);
                  setQuery("");
                }}
              >
                {r.full_name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────────────────────────────

export default function LancamentoEventoPage() {
  const { user } = useAuth();
  const eventId = useActiveEventId();
  const qc = useQueryClient();

  const today = format(new Date(), "yyyy-MM-dd");

  // ── Section open state ──
  const [openSection, setOpenSection] = useState<number>(1);

  // ── Step 1: Identificação ──
  const [matchDate, setMatchDate] = useState(today);
  const [sportEventId, setSportEventId] = useState("");
  const [location, setLocation] = useState("");

  // ── Step 2: Participantes ──
  const [delegationA, setDelegationA] = useState(""); // coletivo lado A
  const [delegationB, setDelegationB] = useState(""); // coletivo lado B
  const [selectedDelegationIds, setSelectedDelegationIds] = useState<string[]>([]); // individual

  // ── Step 3: Resultado ──
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [observations, setObservations] = useState("");
  const [individualResults, setIndividualResults] = useState<IndividualResult[]>([]);

  // ── Step 4: Arbitragem ──
  const [officials, setOfficials] = useState<OfficialEntry[]>([
    { role: "arbitro", name: "", id: "1" },
  ]);

  // ── Step 5: Documentos ──
  const [sumulaFile, setSumulaFile] = useState<File | null>(null);
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);

  const sumulaRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<HTMLInputElement>(null);

  // ── Queries ──

  const { data: sportEvents = [], isLoading: seLoading } = useQuery<SportEventOpt[]>({
    queryKey: ["lancamento-sport-events", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sport_events")
        .select("id, name, result_type, sport:sports(is_collective)")
        .eq("event_id", eventId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []).map((se: any) => ({
        id: se.id,
        name: se.name,
        isCollective: se.sport?.is_collective ?? false,
        resultType: se.result_type ?? null,
      }));
    },
  });

  const selectedSportEvent = sportEvents.find((se) => se.id === sportEventId) ?? null;
  const isCollective = selectedSportEvent?.isCollective ?? false;

  const { data: delegations = [], isLoading: delegLoading } = useQuery<DelegationOpt[]>({
    queryKey: ["lancamento-delegations", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delegations")
        .select("id, institution:institutions(id, name)")
        .eq("event_id", eventId!)
        .order("id");
      if (error) throw error;
      return (data ?? []).map((d: any) => ({
        id: d.id,
        institutionName: d.institution?.name ?? "(sem nome)",
        institutionId: d.institution?.id ?? "",
      }));
    },
  });

  const participantQueryDeps = isCollective
    ? [delegationA, delegationB].filter(Boolean)
    : selectedDelegationIds;

  const { data: participants = [], isLoading: partLoading } = useQuery<ParticipantOpt[]>({
    queryKey: ["lancamento-participants", sportEventId, participantQueryDeps],
    enabled: !!sportEventId && participantQueryDeps.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_sport_events")
        .select(`
          id,
          participant:participants(
            id, delegation_id,
            person:people(full_name),
            delegation:delegations(institution:institutions(name))
          )
        `)
        .eq("sport_event_id", sportEventId)
        .in("participant.delegation_id" as any, participantQueryDeps);
      if (error) throw error;
      const rows: ParticipantOpt[] = [];
      for (const pse of data ?? []) {
        const p = (pse as any).participant;
        if (!p) continue;
        rows.push({
          pse_id: pse.id,
          participantId: p.id,
          name: p.person?.full_name ?? "(sem nome)",
          delegationId: p.delegation_id ?? "",
          institutionName: p.delegation?.institution?.name ?? "(escola desconhecida)",
        });
      }
      return rows.sort((a, b) => a.institutionName.localeCompare(b.institutionName) || a.name.localeCompare(b.name));
    },
  });

  // Keep individual results in sync with loaded participants
  const participantsKey = participants.map((p) => p.pse_id).join(",");
  const initIndividualResults = useCallback(() => {
    setIndividualResults(
      participants.map((p, idx) => ({
        ...p,
        position: idx + 1,
        scoreFinal: "",
        selected: true,
      }))
    );
  }, [participantsKey]); // eslint-disable-line

  // Auto-initialize when participants load
  const [lastParticipantsKey, setLastParticipantsKey] = useState("");
  if (participantsKey !== lastParticipantsKey && participantsKey !== "") {
    setLastParticipantsKey(participantsKey);
    initIndividualResults();
  }

  // ── Helpers ──

  function getOutcome(myScore: string, otherScore: string): string {
    const a = parseFloat(myScore);
    const b = parseFloat(otherScore);
    if (isNaN(a) || isNaN(b)) return "draw";
    if (a > b) return "win";
    if (a < b) return "loss";
    return "draw";
  }

  function toggleDelegation(id: string) {
    setSelectedDelegationIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function updateIndividualResult(pse_id: string, field: keyof IndividualResult, value: any) {
    setIndividualResults((prev) =>
      prev.map((r) => (r.pse_id === pse_id ? { ...r, [field]: value } : r))
    );
  }

  function moveParticipant(pse_id: string, direction: "up" | "down") {
    setIndividualResults((prev) => {
      const idx = prev.findIndex((r) => r.pse_id === pse_id);
      if (idx === -1) return prev;
      const next = [...prev];
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next.map((r, i) => ({ ...r, position: i + 1 }));
    });
  }

  function addOfficial() {
    setOfficials((prev) => [
      ...prev,
      { role: "mesario", name: "", id: String(Date.now()) },
    ]);
  }

  function removeOfficial(id: string) {
    setOfficials((prev) => prev.filter((o) => o.id !== id));
  }

  function updateOfficial(id: string, field: "role" | "name", value: string) {
    setOfficials((prev) =>
      prev.map((o) => (o.id === id ? { ...o, [field]: value } : o))
    );
  }

  function handleSumulaFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSumulaFile(file);
    if (sumulaRef.current) sumulaRef.current.value = "";
  }

  function handlePhotoFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const newPhotos: PhotoPreview[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} não é uma imagem.`);
        continue;
      }
      if (photos.length + newPhotos.length >= MAX_PHOTOS) {
        toast.error(`Máximo de ${MAX_PHOTOS} fotos.`);
        break;
      }
      newPhotos.push({ file, preview: URL.createObjectURL(file) });
    }
    setPhotos((prev) => [...prev, ...newPhotos]);
    if (photosRef.current) photosRef.current.value = "";
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[idx].preview);
      copy.splice(idx, 1);
      return copy;
    });
  }

  // ── Save mutation ──

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!eventId) throw new Error("Nenhum evento selecionado.");
      if (!user?.id) throw new Error("Usuário não autenticado.");
      if (!sportEventId) throw new Error("Selecione uma modalidade.");
      if (!matchDate) throw new Error("Informe a data do evento.");

      // 1. Create match
      const { data: matchData, error: matchErr } = await supabase
        .from("competition_matches")
        .insert({
          event_id: eventId,
          sport_event_id: sportEventId,
          match_date: matchDate,
          status: "finished",
          source: "lancamento_simples",
          notes: [location, observations].filter(Boolean).join(" | ") || null,
        })
        .select("id")
        .single();
      if (matchErr) throw new Error(`Erro ao criar registro: ${matchErr.message}`);
      const matchId = matchData.id;

      // 2. Entries + Scores
      if (isCollective) {
        if (!delegationA || !delegationB) throw new Error("Selecione as duas escolas.");

        // Try to find teams
        const [teamARes, teamBRes] = await Promise.all([
          supabase
            .from("teams")
            .select("id, name")
            .eq("sport_event_id", sportEventId)
            .eq("delegation_id", delegationA)
            .maybeSingle(),
          supabase
            .from("teams")
            .select("id, name")
            .eq("sport_event_id", sportEventId)
            .eq("delegation_id", delegationB)
            .maybeSingle(),
        ]);

        const { data: entriesData, error: entriesErr } = await supabase
          .from("competition_match_entries")
          .insert([
            { match_id: matchId, side: "A", team_id: teamARes.data?.id ?? null },
            { match_id: matchId, side: "B", team_id: teamBRes.data?.id ?? null },
          ])
          .select("id, side");
        if (entriesErr) throw new Error(`Erro ao criar entradas: ${entriesErr.message}`);

        const entryA = (entriesData ?? []).find((e: any) => e.side === "A");
        const entryB = (entriesData ?? []).find((e: any) => e.side === "B");

        if (entryA && entryB && (scoreA || scoreB)) {
          const { error: scoresErr } = await supabase.from("match_scores").insert([
            {
              match_id: matchId,
              match_entry_id: entryA.id,
              score_final: scoreA || "0",
              outcome: getOutcome(scoreA, scoreB),
            },
            {
              match_id: matchId,
              match_entry_id: entryB.id,
              score_final: scoreB || "0",
              outcome: getOutcome(scoreB, scoreA),
            },
          ]);
          if (scoresErr) throw new Error(`Erro ao salvar placar: ${scoresErr.message}`);
        }
      } else {
        // Individual
        const participating = individualResults.filter((r) => r.selected);
        for (const r of participating) {
          const { data: entryData, error: entryErr } = await supabase
            .from("competition_match_entries")
            .insert({
              match_id: matchId,
              side: String(r.position),
              participant_sport_event_id: r.pse_id,
            })
            .select("id")
            .single();
          if (entryErr) {
            console.error("Erro ao criar entrada individual:", entryErr);
            continue;
          }
          await supabase.from("match_scores").insert({
            match_id: matchId,
            match_entry_id: entryData.id,
            score_final: r.scoreFinal || null,
            outcome: String(r.position),
          });
        }
      }

      // 3. Officials
      const validOfficials = officials.filter((o) => o.name.trim());
      if (validOfficials.length > 0) {
        const { error: offErr } = await supabase.from("match_officials").insert(
          validOfficials.map((o) => ({
            match_id: matchId,
            name: o.name.trim(),
            role: o.role,
          }))
        );
        if (offErr) console.warn("Erro ao salvar árbitros:", offErr.message);
      }

      // 4. Files
      const evidenceInserts: any[] = [];

      if (sumulaFile) {
        const ext = sumulaFile.name.split(".").pop() ?? "pdf";
        const path = `${eventId}/${matchId}/sumula-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, sumulaFile, { contentType: sumulaFile.type, upsert: false });
        if (upErr) {
          toast.error(`Falha no upload da súmula: ${upErr.message}`);
        } else {
          evidenceInserts.push({
            match_id: matchId,
            event_id: eventId,
            evidence_type: "sumula",
            storage_bucket: STORAGE_BUCKET,
            storage_path: path,
            file_name: sumulaFile.name,
            mime_type: sumulaFile.type,
            uploaded_by: user.id,
          });
        }
      }

      for (const p of photos) {
        const ext = p.file.name.split(".").pop() ?? "jpg";
        const path = `${eventId}/${matchId}/foto-${Date.now()}-${p.file.name}`;
        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, p.file, { contentType: p.file.type, upsert: false });
        if (upErr) {
          toast.error(`Falha no upload de foto (${p.file.name}): ${upErr.message}`);
        } else {
          evidenceInserts.push({
            match_id: matchId,
            event_id: eventId,
            evidence_type: "foto",
            storage_bucket: STORAGE_BUCKET,
            storage_path: path,
            file_name: p.file.name,
            mime_type: p.file.type,
            uploaded_by: user.id,
          });
        }
      }

      if (evidenceInserts.length > 0) {
        const { error: evErr } = await supabase.from("match_evidences").insert(evidenceInserts);
        if (evErr) console.warn("Erro ao registrar evidências:", evErr.message);
      }

      return matchId;
    },
    onSuccess: (matchId) => {
      toast.success("Registro salvo com sucesso!");
      qc.invalidateQueries({ queryKey: ["partidas-modalidade"] });
      // Reset form
      setSportEventId("");
      setLocation("");
      setDelegationA("");
      setDelegationB("");
      setSelectedDelegationIds([]);
      setScoreA("");
      setScoreB("");
      setObservations("");
      setIndividualResults([]);
      setOfficials([{ role: "arbitro", name: "", id: "1" }]);
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      setPhotos([]);
      setSumulaFile(null);
      setOpenSection(1);
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Erro ao salvar registro.");
    },
  });

  // ── Validation ──

  const step1Done = !!sportEventId && !!matchDate;
  const step2Done = isCollective
    ? !!delegationA && !!delegationB && delegationA !== delegationB
    : selectedDelegationIds.length > 0;
  const step3Done = isCollective ? !!(scoreA || scoreB) : individualResults.some((r) => r.selected);
  const canSave = step1Done;

  const delegationAName = delegations.find((d) => d.id === delegationA)?.institutionName ?? "";
  const delegationBName = delegations.find((d) => d.id === delegationB)?.institutionName ?? "";

  if (!eventId) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">Selecione um evento no topo da página para continuar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Registrar Competição</h1>
        <p className="text-muted-foreground text-sm">
          Registre resultado, árbitros e documentos de uma competição em um só lugar.
        </p>
      </div>

      {/* ── SEÇÃO 1: IDENTIFICAÇÃO ── */}
      <Section
        step={1}
        title="Identificação"
        icon={<Calendar className="h-4 w-4" />}
        open={openSection === 1}
        onToggle={() => setOpenSection(openSection === 1 ? 0 : 1)}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="match-date">Data do evento *</Label>
            <Input
              id="match-date"
              type="date"
              value={matchDate}
              onChange={(e) => setMatchDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="location">Local (opcional)</Label>
            <Input
              id="location"
              placeholder="Ex.: Ginásio Municipal"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sport-event">Modalidade / Prova *</Label>
          <Select value={sportEventId} onValueChange={setSportEventId} disabled={seLoading}>
            <SelectTrigger id="sport-event">
              <SelectValue placeholder={seLoading ? "Carregando..." : "Selecione a modalidade"} />
            </SelectTrigger>
            <SelectContent>
              {sportEvents.map((se) => (
                <SelectItem key={se.id} value={se.id}>
                  {se.name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {se.isCollective ? "Coletivo" : "Individual"}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {step1Done && (
          <Button
            size="sm"
            onClick={() => setOpenSection(2)}
            className="w-full sm:w-auto"
          >
            Avançar para Participantes
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </Section>

      {/* ── SEÇÃO 2: PARTICIPANTES ── */}
      <Section
        step={2}
        title="Participantes"
        icon={<Users className="h-4 w-4" />}
        open={openSection === 2}
        onToggle={() => step1Done && setOpenSection(openSection === 2 ? 0 : 2)}
        disabled={!step1Done}
      >
        {isCollective ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Escola A *</Label>
                <Select
                  value={delegationA}
                  onValueChange={setDelegationA}
                  disabled={delegLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar escola" />
                  </SelectTrigger>
                  <SelectContent>
                    {delegations
                      .filter((d) => d.id !== delegationB)
                      .map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.institutionName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Escola B *</Label>
                <Select
                  value={delegationB}
                  onValueChange={setDelegationB}
                  disabled={delegLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar escola" />
                  </SelectTrigger>
                  <SelectContent>
                    {delegations
                      .filter((d) => d.id !== delegationA)
                      .map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.institutionName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {delegationA && delegationB && (
              <div className="text-sm text-muted-foreground rounded-md border bg-muted/30 p-3">
                A equipe é vinculada automaticamente pela escola selecionada.
                {participants.length > 0 && (
                  <span className="ml-1">
                    {participants.length} atleta{participants.length !== 1 ? "s" : ""} inscrito{participants.length !== 1 ? "s" : ""} nesta prova.
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <Label>Escolas participantes *</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto rounded-md border p-3">
              {delegLoading ? (
                <p className="text-sm text-muted-foreground col-span-2">Carregando...</p>
              ) : (
                delegations.map((d) => (
                  <label
                    key={d.id}
                    className="flex items-center gap-2 cursor-pointer rounded-md p-1.5 hover:bg-accent transition-colors"
                  >
                    <Checkbox
                      checked={selectedDelegationIds.includes(d.id)}
                      onCheckedChange={() => toggleDelegation(d.id)}
                    />
                    <span className="text-sm">{d.institutionName}</span>
                  </label>
                ))
              )}
            </div>
            {selectedDelegationIds.length > 0 && partLoading && (
              <p className="text-sm text-muted-foreground">Carregando atletas...</p>
            )}
            {selectedDelegationIds.length > 0 && !partLoading && participants.length > 0 && (
              <div className="text-sm text-muted-foreground rounded-md border bg-muted/30 p-3">
                {participants.length} atleta{participants.length !== 1 ? "s" : ""} inscrito{participants.length !== 1 ? "s" : ""} carregado{participants.length !== 1 ? "s" : ""}.
                Os resultados individuais serão configurados na seção seguinte.
              </div>
            )}
          </div>
        )}
        {step2Done && (
          <Button
            size="sm"
            onClick={() => setOpenSection(3)}
            className="w-full sm:w-auto"
          >
            Avançar para Resultado
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </Section>

      {/* ── SEÇÃO 3: RESULTADO ── */}
      <Section
        step={3}
        title="Resultado"
        icon={<ClipboardList className="h-4 w-4" />}
        open={openSection === 3}
        onToggle={() => step1Done && setOpenSection(openSection === 3 ? 0 : 3)}
        disabled={!step1Done}
      >
        {isCollective ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs truncate block">{delegationAName || "Escola A"}</Label>
                <Input
                  value={scoreA}
                  onChange={(e) => setScoreA(e.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                  className="text-2xl font-bold text-center h-14"
                />
              </div>
              <div className="text-xl font-bold text-muted-foreground pt-5">×</div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs truncate block">{delegationBName || "Escola B"}</Label>
                <Input
                  value={scoreB}
                  onChange={(e) => setScoreB(e.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                  className="text-2xl font-bold text-center h-14"
                />
              </div>
            </div>
            {scoreA && scoreB && scoreA !== scoreB && (
              <div className="text-center text-sm">
                <Badge variant="secondary">
                  Vencedor: {parseFloat(scoreA) > parseFloat(scoreB) ? delegationAName : delegationBName}
                </Badge>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <Label>Classificação dos atletas</Label>
              <span className="text-xs text-muted-foreground">
                Arraste ou use os botões ↑↓ para reordenar
              </span>
            </div>
            {individualResults.length === 0 ? (
              <p className="text-sm text-muted-foreground italic p-3 rounded-md border">
                Selecione as escolas na seção anterior para carregar os atletas.
              </p>
            ) : (
              <div className="space-y-2">
                {individualResults.map((r, idx) => (
                  <div
                    key={r.pse_id}
                    className={`flex items-center gap-2 rounded-md border p-2 transition-colors ${
                      r.selected ? "bg-card" : "bg-muted/40 opacity-60"
                    }`}
                  >
                    <Checkbox
                      checked={r.selected}
                      onCheckedChange={(v) =>
                        updateIndividualResult(r.pse_id, "selected", !!v)
                      }
                    />
                    <span className="w-7 text-center text-sm font-bold text-primary shrink-0">
                      {r.selected ? r.position + "º" : "—"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.institutionName}</p>
                    </div>
                    <Input
                      value={r.scoreFinal}
                      onChange={(e) =>
                        updateIndividualResult(r.pse_id, "scoreFinal", e.target.value)
                      }
                      placeholder="Tempo/dist."
                      className="w-28 text-sm"
                      disabled={!r.selected}
                    />
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        disabled={idx === 0 || !r.selected}
                        onClick={() => moveParticipant(r.pse_id, "up")}
                      >
                        <ChevronDown className="h-3 w-3 rotate-180" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        disabled={idx === individualResults.length - 1 || !r.selected}
                        onClick={() => moveParticipant(r.pse_id, "down")}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Observações (opcional)</Label>
          <Textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Ocorrências, protestos, observações gerais..."
            rows={2}
            maxLength={500}
          />
        </div>
        <Button size="sm" onClick={() => setOpenSection(4)} className="w-full sm:w-auto">
          Avançar para Arbitragem
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </Section>

      {/* ── SEÇÃO 4: ARBITRAGEM ── */}
      <Section
        step={4}
        title="Arbitragem (opcional)"
        icon={<UserCheck className="h-4 w-4" />}
        open={openSection === 4}
        onToggle={() => step1Done && setOpenSection(openSection === 4 ? 0 : 4)}
        disabled={!step1Done}
      >
        <div className="space-y-3">
          {officials.map((official) => (
            <div key={official.id} className="flex gap-2 items-start">
              <Select
                value={official.role}
                onValueChange={(v) => updateOfficial(official.id, "role", v)}
              >
                <SelectTrigger className="w-40 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OFFICIAL_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {official.name ? (
                <div className="flex-1 flex items-center gap-2 rounded-md border px-3 py-2 bg-muted/30">
                  <span className="text-sm flex-1">{official.name}</span>
                  <button
                    type="button"
                    onClick={() => updateOfficial(official.id, "name", "")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex-1">
                  <RefereeSearch
                    onSelect={(name) => updateOfficial(official.id, "name", name)}
                  />
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeOfficial(official.id)}
                className="shrink-0"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addOfficial}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar oficial
          </Button>
        </div>
        <Button size="sm" onClick={() => setOpenSection(5)} className="w-full sm:w-auto">
          Avançar para Documentos
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </Section>

      {/* ── SEÇÃO 5: DOCUMENTOS ── */}
      <Section
        step={5}
        title="Documentos e Fotos"
        icon={<Camera className="h-4 w-4" />}
        open={openSection === 5}
        onToggle={() => step1Done && setOpenSection(openSection === 5 ? 0 : 5)}
        disabled={!step1Done}
      >
        {/* Súmula */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            Foto da Súmula / Boletim
            <Badge variant="outline" className="text-[10px] font-normal">opcional</Badge>
          </Label>
          {sumulaFile ? (
            <div className="flex items-center justify-between rounded-md border p-3 bg-muted/30">
              <span className="text-sm truncate">{sumulaFile.name}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSumulaFile(null)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" asChild className="w-full h-14">
              <label className="cursor-pointer flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Tirar foto ou selecionar arquivo
                <input
                  ref={sumulaRef}
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                  className="hidden"
                  onChange={handleSumulaFile}
                />
              </label>
            </Button>
          )}
        </div>

        <Separator />

        {/* Fotos do evento */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            Fotos do Evento
            <Badge variant="outline" className="text-[10px] font-normal">opcional</Badge>
            {photos.length > 0 && (
              <span className="text-xs text-muted-foreground ml-auto">
                {photos.length}/{MAX_PHOTOS}
              </span>
            )}
          </Label>
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p, idx) => (
                <div key={idx} className="relative aspect-square rounded-md overflow-hidden border bg-muted">
                  <img
                    src={p.preview}
                    alt={`foto-${idx + 1}`}
                    className="object-cover w-full h-full"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute top-1 right-1 bg-destructive/90 text-white rounded-full p-1 hover:bg-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {photos.length < MAX_PHOTOS && (
            <Button variant="outline" asChild className="w-full">
              <label className="cursor-pointer flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Adicionar fotos
                <input
                  ref={photosRef}
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoFiles}
                />
              </label>
            </Button>
          )}
        </div>
      </Section>

      {/* ── SALVAR ── */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Pronto para salvar?</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <span className={step1Done ? "text-green-600" : ""}>
                  {step1Done ? "✓" : "○"} Modalidade e data
                </span>
                <span className={step2Done ? "text-green-600" : ""}>
                  {step2Done ? "✓" : "○"} Participantes
                </span>
                <span className={step3Done ? "text-green-600" : ""}>
                  {step3Done ? "✓" : "○"} Resultado
                </span>
                <span className={sumulaFile ? "text-green-600" : ""}>
                  {sumulaFile ? "✓" : "○"} Súmula
                </span>
              </div>
            </div>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={!canSave || saveMut.isPending}
              size="lg"
              className="shrink-0"
            >
              {saveMut.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Salvar Registro
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
