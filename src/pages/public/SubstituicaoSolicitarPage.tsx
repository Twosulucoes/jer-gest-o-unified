import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const REASON_OPTIONS = [
  { value: "lesao",       label: "Lesão" },
  { value: "desistencia", label: "Desistência" },
  { value: "disciplinar", label: "Medida disciplinar" },
  { value: "convocacao",  label: "Convocação externa" },
  { value: "outro",       label: "Outro" },
];

const DOCUMENT_SLOTS = [
  { key: "foto_atleta",        label: "Foto do atleta entrante" },
  { key: "rg_frente",          label: "RG — frente" },
  { key: "rg_verso",           label: "RG — verso" },
  { key: "termo_inscricao",    label: "Termo de inscrição" },
  { key: "aptidao_fisica",     label: "Aptidão física" },
  { key: "oficio_substituicao", label: "Ofício de substituição da escola" },
];

type Step = 1 | 2 | 3 | 4;

interface DelegacaoInfo {
  delegation_id: string;
  institution_name: string;
  city: string;
  chief_name: string;
}

interface Athlete {
  participant_id: string;
  full_name: string;
}

interface SportEvent {
  sport_event_id: string;
  sport_event_name: string;
  sport_name: string;
  category_name: string;
}

export default function SubstituicaoSolicitarPage() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [protocol, setProtocol] = useState<string | null>(null);

  // Etapa 1 — Identificação
  const [events, setEvents] = useState<{ event_id: string; event_name: string }[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [eventId, setEventId] = useState("");
  const [stages, setStages] = useState<{ stage_id: string; stage_name: string }[]>([]);
  const [stageId, setStageId] = useState("");
  const [phoneSuffix, setPhoneSuffix] = useState("");
  const [delegacao, setDelegacao] = useState<DelegacaoInfo | null>(null);

  // Etapa 2 — Substituição
  const [sportEvents, setSportEvents] = useState<SportEvent[]>([]);
  const [sportEventId, setSportEventId] = useState("");
  const [outAthletes, setOutAthletes] = useState<Athlete[]>([]);
  const [inAthletes, setInAthletes] = useState<Athlete[]>([]);
  const [participantOutId, setParticipantOutId] = useState("");
  const [participantInId, setParticipantInId] = useState("");
  const [reasonCode, setReasonCode] = useState("lesao");
  const [reason, setReason] = useState("");

  // Etapa 3 — Documentos
  const [docs, setDocs] = useState<Record<string, File>>({});
  const [docPaths, setDocPaths] = useState<Record<string, string>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Etapa 4 — E-mail
  const [contactEmail, setContactEmail] = useState("");

  // ── Carregar eventos ao montar ──────────────────────────────────────────
  const loadEvents = async () => {
    if (eventsLoaded) return;
    const { data, error } = await (supabase as any).rpc("substituicao_buscar_eventos");
    if (error) { toast.error("Não foi possível carregar os eventos."); return; }
    setEvents((data ?? []) as any[]);
    setEventsLoaded(true);
  };

  const handleEventChange = async (eid: string) => {
    setEventId(eid);
    setStageId("");
    setStages([]);
    const { data, error } = await (supabase as any).rpc("substituicao_buscar_etapas", { p_event_id: eid });
    if (!error) setStages((data ?? []) as any[]);
  };

  // ── Etapa 1 → buscar delegação ──────────────────────────────────────────
  const handleIdentificar = async () => {
    if (!eventId || !stageId || phoneSuffix.length !== 4) {
      toast.error("Preencha o evento, a etapa e os 4 dígitos do telefone.");
      return;
    }
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("substituicao_buscar_delegacao", {
      p_phone_suffix: phoneSuffix,
      p_event_id: eventId,
    });
    setLoading(false);
    if (error || !data || data.length === 0) {
      toast.error("Delegação não encontrada. Verifique o evento e o telefone.");
      return;
    }
    setDelegacao(data[0] as DelegacaoInfo);

    // Carrega provas e vai para etapa 2
    const { data: seData } = await (supabase as any).rpc("substituicao_buscar_provas", {
      p_event_id: eventId,
      p_stage_id: stageId,
    });
    setSportEvents((seData ?? []) as SportEvent[]);
    setStep(2);
  };

  // ── Etapa 2 → carregar atletas ao selecionar prova ─────────────────────
  const handleSportEventChange = async (seid: string) => {
    setSportEventId(seid);
    setParticipantOutId("");
    setParticipantInId("");
    if (!delegacao) return;

    const [outRes, inRes] = await Promise.all([
      (supabase as any).rpc("substituicao_buscar_atletas_saindo", {
        p_delegation_id: delegacao.delegation_id,
        p_sport_event_id: seid,
        p_stage_id: stageId,
      }),
      (supabase as any).rpc("substituicao_buscar_atletas_entrando", {
        p_delegation_id: delegacao.delegation_id,
        p_sport_event_id: seid,
        p_stage_id: stageId,
        p_event_id: eventId,
      }),
    ]);
    setOutAthletes((outRes.data ?? []) as Athlete[]);
    setInAthletes((inRes.data ?? []) as Athlete[]);
  };

  const selectedSE = sportEvents.find((s) => s.sport_event_id === sportEventId);

  // ── Etapa 3 → upload de documento ──────────────────────────────────────
  const handleFileChange = async (key: string, file: File | undefined) => {
    if (!file) return;
    setDocs((prev) => ({ ...prev, [key]: file }));
  };

  const uploadDocs = async (): Promise<Record<string, string>> => {
    const tempId = crypto.randomUUID();
    const paths: Record<string, string> = {};
    setUploading(true);
    for (const [key, file] of Object.entries(docs)) {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `temp/${tempId}/${key}.${ext}`;
      const { error } = await supabase.storage
        .from("substitution-docs")
        .upload(path, file, { upsert: true });
      if (error) {
        toast.error(`Erro no upload de ${key}: ${error.message}`);
      } else {
        paths[key] = path;
      }
    }
    setUploading(false);
    setDocPaths(paths);
    return paths;
  };

  // ── Etapa 4 → enviar formulário ─────────────────────────────────────────
  const handleSubmit = async () => {
    if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setLoading(true);

    // Upload dos docs (se ainda não feito)
    let paths = docPaths;
    if (Object.keys(paths).length === 0 && Object.keys(docs).length > 0) {
      paths = await uploadDocs();
    }

    const { data, error } = await supabase.functions.invoke("submit-substitution-public", {
      body: {
        phone_suffix: phoneSuffix,
        event_id: eventId,
        stage_id: stageId,
        sport_event_id: sportEventId,
        participant_out_id: participantOutId,
        participant_in_id: participantInId,
        reason_code: reasonCode,
        reason: reason.trim() || null,
        contact_email: contactEmail,
        doc_paths: paths,
      },
    });

    setLoading(false);

    if (error) {
      toast.error(`Erro ao enviar: ${error.message}`);
      return;
    }

    const result = data as { ok: boolean; protocol_number?: string; error?: string };
    if (!result.ok) {
      toast.error(result.error ?? "Erro ao processar a solicitação.");
      return;
    }

    setProtocol(result.protocol_number ?? "");
  };

  const stepLabel = ["Identificação", "Substituição", "Documentos", "Enviar"];

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Header */}
      <header className="bg-background border-b border-border px-6 py-4 flex items-center gap-3">
        <div className="font-bold text-lg tracking-tight">JER Gestão</div>
        <span className="text-muted-foreground text-sm">— Solicitação de Substituição</span>
      </header>

      <main className="flex-1 flex items-start justify-center p-4 md:p-8">
        <div className="w-full max-w-xl space-y-6">
          {/* Stepper */}
          <div className="flex items-center gap-1">
            {stepLabel.map((label, i) => {
              const s = (i + 1) as Step;
              const active = step === s;
              const done = step > s;
              return (
                <div key={s} className="flex items-center gap-1 flex-1">
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${
                    active ? "text-primary" : done ? "text-emerald-600" : "text-muted-foreground"
                  }`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      active ? "bg-primary text-primary-foreground" :
                      done ? "bg-emerald-500 text-white" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {done ? "✓" : s}
                    </span>
                    <span className="hidden sm:inline">{label}</span>
                  </div>
                  {i < stepLabel.length - 1 && (
                    <div className="flex-1 h-px bg-border mx-1" />
                  )}
                </div>
              );
            })}
          </div>

          {/* ── ETAPA 1: Identificação ── */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Identificação da Delegação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label>Evento</Label>
                  <Select
                    value={eventId}
                    onValueChange={handleEventChange}
                    onOpenChange={(open) => { if (open) loadEvents(); }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione o evento" /></SelectTrigger>
                    <SelectContent>
                      {events.map((e) => (
                        <SelectItem key={e.event_id} value={e.event_id}>{e.event_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Etapa</Label>
                  <Select value={stageId} onValueChange={setStageId} disabled={!eventId}>
                    <SelectTrigger><SelectValue placeholder="Selecione a etapa" /></SelectTrigger>
                    <SelectContent>
                      {stages.map((s) => (
                        <SelectItem key={s.stage_id} value={s.stage_id}>{s.stage_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>4 últimos dígitos do telefone do chefe de delegação</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={phoneSuffix}
                    onChange={(e) => setPhoneSuffix(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="Ex.: 5678"
                    className="tracking-widest text-lg"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use o número cadastrado para a sua delegação no sistema.
                  </p>
                </div>

                <Button
                  className="w-full"
                  onClick={handleIdentificar}
                  disabled={loading || !eventId || !stageId || phoneSuffix.length !== 4}
                >
                  {loading
                    ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    : <ArrowRight className="h-4 w-4 mr-1.5" />}
                  Identificar delegação
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ── ETAPA 2: Substituição ── */}
          {step === 2 && delegacao && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados da Substituição</CardTitle>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge variant="outline">{delegacao.institution_name}</Badge>
                  {delegacao.city && <Badge variant="outline">{delegacao.city}</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label>Modalidade</Label>
                  <Select value={sportEventId} onValueChange={handleSportEventChange}>
                    <SelectTrigger><SelectValue placeholder="Selecione a modalidade" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {sportEvents.map((s) => (
                        <SelectItem key={s.sport_event_id} value={s.sport_event_id}>
                          {s.sport_event_name}
                          <span className="text-muted-foreground text-xs ml-2">
                            · {s.sport_name} · {s.category_name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedSE && (
                  <div className="space-y-0.5">
                    <Label className="text-xs text-muted-foreground">Categoria</Label>
                    <p className="text-sm font-medium">{selectedSE.category_name}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Atleta que sai</Label>
                    <Select value={participantOutId} onValueChange={setParticipantOutId} disabled={!sportEventId}>
                      <SelectTrigger>
                        <SelectValue placeholder={
                          !sportEventId ? "—" :
                          outAthletes.length === 0 ? "Nenhum inscrito" : "Selecione"
                        } />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {outAthletes.map((a) => (
                          <SelectItem key={a.participant_id} value={a.participant_id}>
                            {a.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Atleta que entra</Label>
                    <Select value={participantInId} onValueChange={setParticipantInId} disabled={!sportEventId}>
                      <SelectTrigger>
                        <SelectValue placeholder={
                          !sportEventId ? "—" :
                          inAthletes.length === 0 ? "Nenhum disponível" : "Selecione"
                        } />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {inAthletes
                          .filter((a) => a.participant_id !== participantOutId)
                          .map((a) => (
                            <SelectItem key={a.participant_id} value={a.participant_id}>
                              {a.full_name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Motivo</Label>
                  <Select value={reasonCode} onValueChange={setReasonCode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REASON_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Observações (opcional)</Label>
                  <Textarea
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ex.: atestado médico será apresentado presencialmente."
                  />
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                    <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => setStep(3)}
                    disabled={!sportEventId || !participantOutId || !participantInId}
                  >
                    Próximo <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── ETAPA 3: Documentos ── */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Documentos do Atleta Entrante</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Faça o upload dos documentos obrigatórios (imagem ou PDF, máx. 10 MB cada).
                </p>
                <div className="space-y-2">
                  {DOCUMENT_SLOTS.map((slot) => (
                    <div
                      key={slot.key}
                      className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{slot.label}</p>
                        {docs[slot.key] ? (
                          <p className="text-[10px] text-emerald-600 truncate">{docs[slot.key].name}</p>
                        ) : (
                          <p className="text-[10px] text-muted-foreground">Nenhum arquivo</p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="shrink-0 flex items-center gap-1 text-xs text-primary hover:underline"
                        onClick={() => fileRefs.current[slot.key]?.click()}
                      >
                        {docs[slot.key]
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          : <Upload className="h-4 w-4" />}
                        {docs[slot.key] ? "Alterar" : "Selecionar"}
                      </button>
                      <input
                        ref={(el) => { fileRefs.current[slot.key] = el; }}
                        type="file"
                        className="hidden"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={(e) => handleFileChange(slot.key, e.target.files?.[0])}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                    <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
                  </Button>
                  <Button className="flex-1" onClick={() => setStep(4)}>
                    Próximo <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── ETAPA 4: Confirmação + Envio ── */}
          {step === 4 && delegacao && selectedSE && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Confirmação e Envio</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Resumo */}
                <div className="rounded-md bg-muted/50 p-3 space-y-1.5 text-sm">
                  <p><span className="text-muted-foreground">Escola:</span> {delegacao.institution_name}</p>
                  <p><span className="text-muted-foreground">Modalidade:</span> {selectedSE.sport_event_name}</p>
                  <p>
                    <span className="text-muted-foreground">Sai:</span>{" "}
                    <span className="font-medium text-amber-700 dark:text-amber-300">
                      {outAthletes.find((a) => a.participant_id === participantOutId)?.full_name ?? "—"}
                    </span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Entra:</span>{" "}
                    <span className="font-medium text-emerald-700 dark:text-emerald-300">
                      {inAthletes.find((a) => a.participant_id === participantInId)?.full_name ?? "—"}
                    </span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Documentos anexados:</span>{" "}
                    {Object.keys(docs).length} de {DOCUMENT_SLOTS.length}
                  </p>
                </div>

                <div className="space-y-1">
                  <Label>E-mail para receber o protocolo</Label>
                  <Input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="email@escola.edu.br"
                  />
                  <p className="text-xs text-muted-foreground">
                    Você receberá o número de protocolo neste endereço assim que a solicitação for registrada.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(3)} disabled={loading || uploading}>
                    <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
                  </Button>
                  <Button className="flex-1" onClick={handleSubmit} disabled={loading || uploading}>
                    {(loading || uploading) && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                    {uploading ? "Enviando docs…" : loading ? "Processando…" : "Enviar solicitação"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <p className="text-center text-xs text-muted-foreground">
            JER Gestão · Jogos Escolares de Roraima 2026
          </p>
        </div>
      </main>

      {/* Modal de protocolo */}
      <Dialog open={!!protocol} onOpenChange={(o) => { if (!o) window.location.reload(); }}>
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="flex flex-col items-center gap-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              Solicitação enviada!
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <span className="block text-sm">Seu número de protocolo:</span>
              <span className="block text-2xl font-bold tracking-widest text-foreground font-mono">
                {protocol}
              </span>
              <span className="block text-xs text-muted-foreground">
                Um e-mail foi enviado para <strong>{contactEmail}</strong> com este protocolo.
                Sua solicitação será analisada pela comissão técnica do JER.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="justify-center">
            <Button onClick={() => window.location.reload()}>
              Nova solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
