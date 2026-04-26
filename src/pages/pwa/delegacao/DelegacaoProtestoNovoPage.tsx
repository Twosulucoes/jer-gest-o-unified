import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Gavel, AlertTriangle, Clock, Upload, X, CheckCircle2 } from "lucide-react";
import { PwaRefreshButton } from "@/components/pwa/PwaRefreshButton";
import { toast } from "@/hooks/use-toast";
import { format, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/jpg", "video/mp4"];
const MAX_SIZE = 20 * 1024 * 1024;

export default function DelegacaoProtestoNovoPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialMatchId = params.get("matchId") ?? "";

  const [matches, setMatches] = useState<any[]>([]);
  const [matchId, setMatchId] = useState(initialMatchId);
  const [fundamentation, setFundamentation] = useState("");
  const [request, setRequest] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // Carrega partidas elegíveis (encerradas, da delegação)
  useEffect(() => {
    (async () => {
      const { data: ud } = await supabase.from("user_delegations").select("delegation_id").maybeSingle();
      if (!ud) return;

      // Buscar partidas onde a delegação participou (via teams)
      const { data: teams } = await supabase.from("teams").select("id").eq("delegation_id", ud.delegation_id);
      const teamIds = (teams ?? []).map((t) => t.id);
      if (teamIds.length === 0) return;

      const { data: entries } = await supabase
        .from("competition_match_entries")
        .select("match_id")
        .in("team_id", teamIds);
      const matchIds = Array.from(new Set((entries ?? []).map((e) => e.match_id)));
      if (matchIds.length === 0) return;

      const { data: ms } = await supabase
        .from("competition_matches")
        .select("id, match_number, match_date, start_time, end_time, status")
        .in("id", matchIds)
        .not("end_time", "is", null)
        .order("end_time", { ascending: false })
        .limit(50);
      setMatches(ms ?? []);
    })();
  }, []);

  const selectedMatch = useMemo(() => matches.find((m) => m.id === matchId), [matches, matchId]);
  const deadline = selectedMatch?.end_time ? new Date(new Date(selectedMatch.end_time).getTime() + 60 * 60 * 1000) : null;
  const minutesLeft = deadline ? differenceInMinutes(deadline, now) : null;
  const expired = minutesLeft !== null && minutesLeft < 0;

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const valid: File[] = [];
    for (const f of selected) {
      if (!ALLOWED_MIME.includes(f.type)) {
        toast({ title: "Formato inválido", description: `${f.name} — use PDF, JPG, PNG ou MP4.`, variant: "destructive" });
        continue;
      }
      if (f.size > MAX_SIZE) {
        toast({ title: "Arquivo muito grande", description: `${f.name} excede 20MB.`, variant: "destructive" });
        continue;
      }
      valid.push(f);
    }
    setFiles((prev) => [...prev, ...valid].slice(0, 6));
    e.target.value = "";
  };

  const submit = async () => {
    if (!matchId) return toast({ title: "Selecione a partida", variant: "destructive" });
    if (fundamentation.trim().length < 10) return toast({ title: "Fundamentação muito curta (mín. 10 caracteres)", variant: "destructive" });
    if (request.trim().length < 5) return toast({ title: "Pedido muito curto", variant: "destructive" });
    if (expired) return toast({ title: "Prazo encerrado", variant: "destructive" });

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("rpc_create_protest", {
        p_match_id: matchId,
        p_fundamentation: fundamentation,
        p_request: request,
        p_contact_name: contactName || null,
        p_contact_phone: contactPhone || null,
        p_contact_email: contactEmail || null,
      });
      if (error) throw error;

      const protest = data as any;
      const protestId = protest.id;

      // Upload anexos
      for (const f of files) {
        const path = `${protestId}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("protestos").upload(path, f);
        if (upErr) {
          toast({ title: `Falha ao enviar ${f.name}`, description: upErr.message, variant: "destructive" });
          continue;
        }
        await supabase.from("protest_attachments").insert({
          protest_id: protestId,
          file_name: f.name,
          storage_path: path,
          mime_type: f.type,
          size_bytes: f.size,
          uploaded_by: (await supabase.auth.getUser()).data.user!.id,
        });
      }

      toast({ title: `Protocolo nº ${protest.protocol_number} criado`, description: "Seu protesto foi enviado à comissão." });
      navigate("/pwa/delegacao/protestos");
    } catch (e: any) {
      toast({ title: "Erro ao protocolar", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-2 border-b bg-card px-4 h-14">
        <button onClick={() => navigate("/pwa/delegacao/protestos")} className="text-muted-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Gavel className="h-5 w-5 text-primary" />
        <span className="font-semibold text-foreground">Novo Protesto</span>
        <div className="ml-auto"><PwaRefreshButton /></div>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <Label>Partida / Prova *</Label>
              <select
                value={matchId}
                onChange={(e) => setMatchId(e.target.value)}
                className="mt-1 w-full h-11 rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="">Selecione...</option>
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>
                    Partida #{m.match_number ?? "—"} — {m.end_time ? format(new Date(m.end_time), "dd/MM HH:mm") : "?"}
                  </option>
                ))}
              </select>
              {matches.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Nenhuma partida encerrada da sua delegação.</p>
              )}
            </div>

            {selectedMatch && deadline && (
              <div className={`rounded-lg p-3 text-sm flex items-start gap-2 ${expired ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning-foreground"}`}>
                {expired ? <AlertTriangle className="h-4 w-4 mt-0.5" /> : <Clock className="h-4 w-4 mt-0.5" />}
                <div>
                  <p className="font-semibold">
                    Prazo limite: {format(deadline, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                  {expired ? (
                    <p>Prazo encerrado. Procure a Secretaria Geral para orientação.</p>
                  ) : (
                    <p>Tempo restante: {minutesLeft} min</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <Label>Fundamentação *</Label>
              <Textarea rows={5} value={fundamentation} onChange={(e) => setFundamentation(e.target.value)} placeholder="Descreva os fatos e fundamentos regulamentares..." />
            </div>
            <div>
              <Label>Pedido *</Label>
              <Textarea rows={3} value={request} onChange={(e) => setRequest(e.target.value)} placeholder="O que está sendo pedido à comissão?" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Contato responsável</p>
            <Input placeholder="Nome" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            <Input placeholder="Telefone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            <Input placeholder="E-mail" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <Label>Anexos (PDF, JPG, PNG, MP4 — até 20MB cada, máx. 6)</Label>
            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.mp4" onChange={handleFiles} className="hidden" id="file-input" />
            <label htmlFor="file-input">
              <Button type="button" variant="outline" className="w-full" asChild>
                <span><Upload className="h-4 w-4" /> Adicionar arquivo</span>
              </Button>
            </label>
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-muted/50 px-2 py-1.5 rounded">
                <span className="truncate">{f.name}</span>
                <button onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Button onClick={submit} disabled={submitting || expired || !matchId} className="w-full" variant="gradient">
          <CheckCircle2 className="h-4 w-4" /> {submitting ? "Enviando..." : "Protocolar protesto"}
        </Button>
      </main>
    </div>
  );
}
