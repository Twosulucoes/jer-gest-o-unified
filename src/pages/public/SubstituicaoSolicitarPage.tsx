import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Upload,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Eye,
  X,
  Printer,
} from "lucide-react";
import { toast } from "sonner";

const DATA_ENCERRAMENTO = new Date("2026-06-24T00:00:00-04:00");

const REASON_OPTIONS = [
  { value: "lesao", label: "Lesão" },
  { value: "desistencia", label: "Desistência" },
  { value: "disciplinar", label: "Medida disciplinar" },
  { value: "outro", label: "Outro" },
];

const DOCUMENT_SLOTS = [
  { key: "foto_atleta", label: "Foto do atleta entrante" },
  { key: "rg_atleta", label: "RG do atleta" },
  { key: "termo_inscricao", label: "Termo de inscrição" },
  { key: "termo_aptidao", label: "Termo de aptidão" },
  { key: "oficio_substituicao", label: "Ofício de substituição" },
];

const MUNICIPIOS_RR = [
  "Alto Alegre",
  "Amajari",
  "Boa Vista",
  "Bonfim",
  "Cantá",
  "Caracaraí",
  "Caroebe",
  "Iracema",
  "Mucajaí",
  "Normandia",
  "Pacaraima",
  "Rorainópolis",
  "São João da Baliza",
  "São Luiz",
  "Uiramutã",
];

type Step = 1 | 2 | 3 | 4;

type SolicitacaoFeita = {
  protocolo: string;
  escola: string;
  municipio: string;
  tipo: string;
  modalidade: string;
  prova: string;
  categoria: string;
  naipe: string;
  atletaSai: string;
  atletaEntra: string;
};

export default function SubstituicaoSolicitarPage() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [protocol, setProtocol] = useState<string | null>(null);
  const [mostrarVoucher, setMostrarVoucher] = useState(false);
  const [solicitacoesFeitas, setSolicitacoesFeitas] = useState<SolicitacaoFeita[]>([]);

  const [events, setEvents] = useState<{ event_id: string; event_name: string }[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [eventId, setEventId] = useState("");

  const [municipio, setMunicipio] = useState("");
  const [escolaNome, setEscolaNome] = useState("");
  const [responsavelNome, setResponsavelNome] = useState("");
  const [responsavelTelefone, setResponsavelTelefone] = useState("");
  const [responsavelEmail, setResponsavelEmail] = useState("");

  const [tipoModalidade, setTipoModalidade] = useState("");
  const [modalidadeNome, setModalidadeNome] = useState("");
  const [provaNome, setProvaNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [naipe, setNaipe] = useState("");
  const [atletaSaiNome, setAtletaSaiNome] = useState("");
  const [atletaEntraNome, setAtletaEntraNome] = useState("");
  const [reasonCode, setReasonCode] = useState("lesao");
  const [reason, setReason] = useState("");

  const [docs, setDocs] = useState<Record<string, File>>({});
  const [docPaths, setDocPaths] = useState<Record<string, string>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const encerrado = new Date() >= DATA_ENCERRAMENTO;

  const limparDadosSubstituicao = () => {
    setTipoModalidade("");
    setModalidadeNome("");
    setProvaNome("");
    setCategoria("");
    setNaipe("");
    setAtletaSaiNome("");
    setAtletaEntraNome("");
    setReasonCode("lesao");
    setReason("");
    setDocs({});
    setDocPaths({});

    Object.keys(fileRefs.current).forEach((key) => {
      if (fileRefs.current[key]) fileRefs.current[key]!.value = "";
    });
  };

  const previewFile = (file: File) => {
    const url = URL.createObjectURL(file);
    window.open(url, "_blank");
  };

  const loadEvents = async () => {
    if (eventsLoaded) return;

    const { data, error } = await (supabase as any).rpc("substituicao_buscar_eventos");

    if (error) {
      toast.error("Não foi possível carregar os eventos.");
      return;
    }

    setEvents((data ?? []) as any[]);
    setEventsLoaded(true);
  };

  const handleEventChange = async (eid: string) => {
    setEventId(eid);
    setMunicipio("");
  };

  const handleIdentificar = () => {
    if (
      !eventId ||
      !municipio ||
      !escolaNome ||
      !responsavelNome ||
      !responsavelTelefone ||
      !responsavelEmail
    ) {
      toast.error("Preencha todos os dados.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(responsavelEmail)) {
      toast.error("Informe um e-mail válido.");
      return;
    }

    setStep(2);
  };

  const handleFileChange = (key: string, file: File | undefined) => {
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo maior que 10MB.");
      return;
    }

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
        toast.error(`Erro no upload de ${key}`);
      } else {
        paths[key] = path;
      }
    }

    setUploading(false);
    setDocPaths(paths);
    return paths;
  };

  const handleSubmit = async () => {
    if (encerrado) {
      toast.error("O prazo para solicitação de substituições foi encerrado.");
      return;
    }

    if (
      !tipoModalidade ||
      !modalidadeNome ||
      (tipoModalidade === "Individual" && !provaNome) ||
      !categoria ||
      !naipe ||
      !atletaSaiNome ||
      !atletaEntraNome
    ) {
      toast.error("Preencha os dados.");
      return;
    }

    if (atletaSaiNome.trim().toLowerCase() === atletaEntraNome.trim().toLowerCase()) {
      toast.error("O atleta que entra deve ser diferente do atleta que sai.");
      return;
    }

    setLoading(true);

    let paths = docPaths;

    if (Object.keys(paths).length === 0 && Object.keys(docs).length > 0) {
      paths = await uploadDocs();
    }

    const { data, error } = await supabase.functions.invoke("submit-substitution-public", {
      body: {
        event_id: eventId,
        stage_id: null,
        municipio_nome: municipio,
        escola_nome_digitada: escolaNome.trim(),
        tipo_modalidade: tipoModalidade,
        modalidade_nome_digitada: modalidadeNome.trim(),
        prova_nome_digitada: tipoModalidade === "Individual" ? provaNome.trim() : null,
        categoria,
        naipe,
        atleta_sai_nome: atletaSaiNome.trim(),
        atleta_entra_nome: atletaEntraNome.trim(),
        reason_code: reasonCode,
        reason: reason.trim() || null,
        responsavel_nome: responsavelNome.trim(),
        responsavel_telefone: responsavelTelefone.trim(),
        contact_email: responsavelEmail.trim(),
        doc_paths: paths,
      },
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    const result = data as {
      ok: boolean;
      protocol_number?: string;
      error?: string;
    };

    if (!result.ok) {
      toast.error(result.error ?? "Erro");
      return;
    }

    const protocolo = result.protocol_number ?? "";

    setSolicitacoesFeitas((prev) => [
      ...prev,
      {
        protocolo,
        escola: escolaNome,
        municipio,
        tipo: tipoModalidade,
        modalidade: modalidadeNome,
        prova: provaNome,
        categoria,
        naipe,
        atletaSai: atletaSaiNome,
        atletaEntra: atletaEntraNome,
      },
    ]);

    setProtocol(protocolo);
  };

  const stepLabel = ["Identificação", "Substituição", "Documentos", "Enviar"];

  if (encerrado) {
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col">
        <header className="bg-background border-b border-border px-6 py-4 flex items-center gap-3">
          <div className="font-bold text-lg tracking-tight">JER Gestão</div>
          <span className="text-muted-foreground text-sm">
            — Solicitação de Substituição
          </span>
        </header>

        <main className="flex-1 flex items-center justify-center p-4 md:p-8">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle className="text-center text-red-500">
                Período encerrado
              </CardTitle>
            </CardHeader>

            <CardContent className="text-center space-y-3">
              <p className="font-medium">
                O prazo para solicitação de substituições foi encerrado.
              </p>

              <p className="text-sm text-muted-foreground">
                Encerramento em 24/06/2026 às 00:00.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (mostrarVoucher) {
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col">
        <header className="bg-background border-b border-border px-6 py-4">
          <div className="font-bold text-lg">
            JER Gestão — Comprovante de Substituições
          </div>
        </header>

        <main className="flex-1 flex justify-center p-4 md:p-8">
          <div className="w-full max-w-3xl space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Comprovante / Voucher de Solicitações</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="rounded-md bg-muted/50 p-4 text-sm space-y-1">
                  <p><strong>Município:</strong> {municipio}</p>
                  <p><strong>Escola:</strong> {escolaNome}</p>
                  <p><strong>Responsável:</strong> {responsavelNome}</p>
                  <p><strong>Telefone:</strong> {responsavelTelefone}</p>
                  <p><strong>E-mail:</strong> {responsavelEmail}</p>
                </div>

                <div className="space-y-3">
                  {solicitacoesFeitas.map((s, index) => (
                    <div key={s.protocolo} className="border rounded-md p-4 text-sm space-y-1">
                      <p className="font-bold">Substituição {index + 1}</p>
                      <p><strong>Protocolo:</strong> {s.protocolo}</p>
                      <p><strong>Município:</strong> {s.municipio}</p>
                      <p><strong>Tipo:</strong> {s.tipo}</p>
                      <p><strong>Modalidade:</strong> {s.modalidade}</p>

                      {s.tipo === "Individual" && (
                        <p><strong>Prova:</strong> {s.prova}</p>
                      )}

                      <p><strong>Categoria:</strong> {s.categoria}</p>
                      <p><strong>Naipe:</strong> {s.naipe}</p>
                      <p><strong>Sai:</strong> {s.atletaSai}</p>
                      <p><strong>Entra:</strong> {s.atletaEntra}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-5 text-sm leading-relaxed space-y-3">
                  <div className="text-base font-bold text-emerald-400">
                    *CONFIRMADO O PROCEDIMENTO DE SUBSTITUIÇÃO*
                  </div>

                  <p>
                    Entraremos em contato para aprovação final dos dados.
                  </p>

                  <p>
                    Informamos que a retirada dos crachás dos participantes dos municípios de
                    Boa Vista (escola da capital) ocorrerá durante o período de credenciamento,
                    nos dias <strong>24 e 26/06/2026</strong>.
                  </p>

                  <p>
                    Quanto aos demais municípios e Boa Vista (rural), a retirada dos crachás
                    será realizada na data de chegada à capital, prevista para o dia
                    <strong> 02/07/2026</strong>.
                  </p>
                </div>

                <div className="flex gap-2 print:hidden">
                  <Button className="flex-1" onClick={() => window.print()}>
                    <Printer className="h-4 w-4 mr-1.5" />
                    Imprimir / Salvar PDF
                  </Button>

                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.location.reload()}
                  >
                    Nova solicitação do zero
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="bg-background border-b border-border px-6 py-4 flex items-center gap-3">
        <div className="font-bold text-lg tracking-tight">JER Gestão</div>
        <span className="text-muted-foreground text-sm">
          — Solicitação de Substituição
        </span>
      </header>

      <main className="flex-1 flex items-start justify-center p-4 md:p-8">
        <div className="w-full max-w-xl space-y-6">
          <Card className="border-amber-500/40 bg-amber-500/10">
  <CardContent className="py-4">
    <div className="text-sm text-amber-200 space-y-1">
      <p className="font-semibold">
        Atenção: prazo para substituições
      </p>

      <p>
        O sistema ficará disponível até
        <strong> 24/06/2026 às 00:00</strong>.
      </p>
    </div>
  </CardContent>
</Card>
          <div className="flex items-center gap-1">
            {stepLabel.map((label, i) => {
              const s = (i + 1) as Step;
              const active = step === s;
              const done = step > s;

              return (
                <div key={s} className="flex items-center gap-1 flex-1">
                  <div
                    className={`flex items-center gap-1.5 text-xs font-medium ${
                      active
                        ? "text-primary"
                        : done
                        ? "text-emerald-600"
                        : "text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : done
                          ? "bg-emerald-500 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
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

          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Identificação da Solicitação</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label>Evento</Label>

                  <Select
                    value={eventId}
                    onValueChange={handleEventChange}
                    onOpenChange={(open) => {
                      if (open) loadEvents();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o evento" />
                    </SelectTrigger>

                    <SelectContent>
                      {events.map((e) => (
                        <SelectItem key={e.event_id} value={e.event_id}>
                          {e.event_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Município</Label>

                  <Select value={municipio} onValueChange={setMunicipio} disabled={!eventId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o município" />
                    </SelectTrigger>

                    <SelectContent>
                      {MUNICIPIOS_RR.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Escola</Label>

                  <Input
                    value={escolaNome}
                    onChange={(e) => setEscolaNome(e.target.value)}
                    placeholder="Digite o nome da escola"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Professor responsável</Label>

                  <Input
                    value={responsavelNome}
                    onChange={(e) => setResponsavelNome(e.target.value)}
                    placeholder="Digite o nome"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Telefone</Label>

                  <Input
                    value={responsavelTelefone}
                    onChange={(e) => setResponsavelTelefone(e.target.value)}
                    placeholder="(95) 99999-9999"
                  />
                </div>

                <div className="space-y-1">
                  <Label>E-mail</Label>

                  <Input
                    type="email"
                    value={responsavelEmail}
                    onChange={(e) => setResponsavelEmail(e.target.value)}
                    placeholder="email@escola.com"
                  />
                </div>

                <Button className="w-full" onClick={handleIdentificar}>
                  <ArrowRight className="h-4 w-4 mr-1.5" />
                  Continuar
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Dados da Substituição</CardTitle>

                <div className="pt-1 flex flex-wrap gap-2">
                  <Badge variant="outline">{municipio}</Badge>
                  <Badge variant="outline">{escolaNome}</Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label>Tipo da modalidade</Label>

                  <Select
                    value={tipoModalidade}
                    onValueChange={(value) => {
                      setTipoModalidade(value);
                      if (value === "Coletiva") setProvaNome("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="Individual">Individual</SelectItem>
                      <SelectItem value="Coletiva">Coletiva</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Modalidade</Label>

                  <Input
                    value={modalidadeNome}
                    onChange={(e) => setModalidadeNome(e.target.value)}
                    placeholder="Ex.: Atletismo, Futsal..."
                  />
                </div>

                {tipoModalidade === "Individual" && (
                  <div className="space-y-1">
                    <Label>Nome da prova</Label>

                    <Input
                      value={provaNome}
                      onChange={(e) => setProvaNome(e.target.value)}
                      placeholder="100m rasos, salto..."
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <Label>Categoria</Label>

                  <Select value={categoria} onValueChange={setCategoria}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="12 a 14 anos">12 a 14 anos</SelectItem>
                      <SelectItem value="15 a 17 anos">15 a 17 anos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Naipe</Label>

                  <Select value={naipe} onValueChange={setNaipe}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="Feminino">Feminino</SelectItem>
                      <SelectItem value="Masculino">Masculino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Atleta que sai</Label>

                  <Input
                    value={atletaSaiNome}
                    onChange={(e) => setAtletaSaiNome(e.target.value)}
                    placeholder="Digite o nome"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Atleta que entra</Label>

                  <Input
                    value={atletaEntraNome}
                    onChange={(e) => setAtletaEntraNome(e.target.value)}
                    placeholder="Digite o nome"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Motivo</Label>

                  <Select value={reasonCode} onValueChange={setReasonCode}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      {REASON_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Observações</Label>

                  <Textarea
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                    <ArrowLeft className="h-4 w-4 mr-1.5" />
                    Voltar
                  </Button>

                  <Button className="flex-1" onClick={() => setStep(3)}>
                    Próximo
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>Documentos do Atleta Entrante</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                {DOCUMENT_SLOTS.map((slot) => (
                  <div
                    key={slot.key}
                    className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{slot.label}</p>

                      {docs[slot.key] ? (
                        <p className="text-xs text-emerald-500 truncate mt-1">
                          {docs[slot.key].name}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">
                          Nenhum arquivo selecionado
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {docs[slot.key] && (
                        <button
                          type="button"
                          className="flex items-center gap-1 text-xs text-blue-500 hover:underline"
                          onClick={() => previewFile(docs[slot.key])}
                        >
                          <Eye className="h-4 w-4" />
                          Ver
                        </button>
                      )}

                      <button
                        type="button"
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                        onClick={() => fileRefs.current[slot.key]?.click()}
                      >
                        {docs[slot.key] ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}

                        {docs[slot.key] ? "Alterar" : "Selecionar"}
                      </button>

                      {docs[slot.key] && (
                        <button
                          type="button"
                          className="flex items-center gap-1 text-xs text-red-500 hover:underline"
                          onClick={() => {
                            setDocs((prev) => {
                              const novo = { ...prev };
                              delete novo[slot.key];
                              return novo;
                            });

                            setDocPaths((prev) => {
                              const novo = { ...prev };
                              delete novo[slot.key];
                              return novo;
                            });

                            if (fileRefs.current[slot.key]) {
                              fileRefs.current[slot.key]!.value = "";
                            }
                          }}
                        >
                          <X className="h-4 w-4" />
                          Remover
                        </button>
                      )}

                      <input
                        ref={(el) => {
                          fileRefs.current[slot.key] = el;
                        }}
                        type="file"
                        className="hidden"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={(e) => handleFileChange(slot.key, e.target.files?.[0])}
                      />
                    </div>
                  </div>
                ))}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                    <ArrowLeft className="h-4 w-4 mr-1.5" />
                    Voltar
                  </Button>

                  <Button className="flex-1" onClick={() => setStep(4)}>
                    Próximo
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>Confirmação e Envio</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="rounded-md bg-muted/50 p-3 space-y-1.5 text-sm">
                  <p><span className="text-muted-foreground">Município:</span> {municipio}</p>
                  <p><span className="text-muted-foreground">Escola:</span> {escolaNome}</p>
                  <p><span className="text-muted-foreground">Tipo:</span> {tipoModalidade}</p>
                  <p><span className="text-muted-foreground">Modalidade:</span> {modalidadeNome}</p>

                  {tipoModalidade === "Individual" && (
                    <p><span className="text-muted-foreground">Prova:</span> {provaNome}</p>
                  )}

                  <p><span className="text-muted-foreground">Categoria:</span> {categoria}</p>
                  <p><span className="text-muted-foreground">Naipe:</span> {naipe}</p>
                  <p><span className="text-muted-foreground">Sai:</span> {atletaSaiNome}</p>
                  <p><span className="text-muted-foreground">Entra:</span> {atletaEntraNome}</p>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>
                    <ArrowLeft className="h-4 w-4 mr-1.5" />
                    Voltar
                  </Button>

                  <Button className="flex-1" onClick={handleSubmit} disabled={loading || uploading}>
                    {(loading || uploading) && (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    )}
                    Enviar solicitação
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Dialog open={!!protocol} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <DialogTitle className="flex flex-col items-center gap-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              Solicitação enviada!
            </DialogTitle>

            <DialogDescription className="space-y-3 pt-2">
              <span className="block text-sm">Número do protocolo:</span>

              <span className="block text-2xl font-bold tracking-widest font-mono">
                {protocol}
              </span>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex flex-col sm:flex-col gap-2">
            <Button
              onClick={() => {
                setProtocol(null);
                limparDadosSubstituicao();
                setStep(2);
              }}
            >
              Nova substituição da mesma escola
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setProtocol(null);
                setMostrarVoucher(true);
              }}
            >
              Finalizar e ver comprovante
            </Button>

            <Button variant="ghost" onClick={() => window.location.reload()}>
              Nova solicitação do zero
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
