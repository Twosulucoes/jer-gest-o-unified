import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { toast } from "sonner";
import { Upload, X, FileText } from "lucide-react";

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

const CATEGORIAS = [
  "12 a 14 anos",
  "15 a 17 anos",
];

const NAIPES = [
  "Feminino",
  "Masculino",
];

const TIPOS_RECURSO = [
  "Problema com atleta",
  "Problema com resultado",
  "Erro de arbitragem",
  "Conduta antidesportiva",
  "Descumprimento das regras",
  "Problema em súmula",
  "Ausência de equipe / W.O.",
  "Pedido de revisão",
  "Outro",
];

function gerarProtocolo() {
  const ano = new Date().getFullYear();

  const n = Math.floor(Math.random() * 999999)
    .toString()
    .padStart(6, "0");

  return `CDE-${ano}-${n}`;
}

function gerarToken() {
  return crypto.randomUUID();
}

export default function CdeRecursoPage() {
  const [params] = useSearchParams();

  const modalidadeUrl = params.get("modalidade") || "";
  const stageId = params.get("stage_id") || null;
  const eventId = params.get("event_id") || null;

  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<any>(null);
  const [files, setFiles] = useState<File[]>([]);

  const [form, setForm] = useState({
    professor_nome: "",
    professor_email: "",
    professor_telefone: "",
    escola: "",
    municipio: "",
    modalidade: modalidadeUrl,
    categoria: "",
    naipe: "",
    jogo_descricao: "",
    tipo_recurso: "",
    relato: "",
  });

  const consultaUrl = useMemo(() => {
    if (!sent?.public_token) return "";

    return `${window.location.origin}/cde/consulta/${sent.public_token}`;
  }, [sent]);

  function update(key: string, value: string) {
    setForm((f) => ({
      ...f,
      [key]: value,
    }));
  }

  function selecionarArquivos(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const selected = Array.from(e.target.files || []);

    const validos = selected.filter((file) => {
      const maxSize = 10 * 1024 * 1024;

      if (file.size > maxSize) {
        toast.error(
          `Arquivo muito grande: ${file.name}. Máximo 10MB.`
        );

        return false;
      }

      return true;
    });

    setFiles((prev) => [...prev, ...validos].slice(0, 5));

    e.target.value = "";
  }

  function removerArquivo(index: number) {
    setFiles((prev) =>
      prev.filter((_, i) => i !== index)
    );
  }

  async function enviar() {
    if (
      !form.professor_nome.trim() ||
      !form.professor_email.trim() ||
      !form.escola.trim() ||
      !form.modalidade.trim() ||
      !form.tipo_recurso.trim() ||
      !form.relato.trim()
    ) {
      toast.error("Preencha os campos obrigatórios.");

      return;
    }

    setLoading(true);

    try {
      const protocol = gerarProtocolo();

      const public_token = gerarToken();

      const payload = {
        protocol,
        public_token,

        event_id: eventId,
        stage_id: stageId,

        professor_nome: form.professor_nome.trim(),
        professor_email: form.professor_email.trim(),

        professor_telefone:
          form.professor_telefone.trim(),

        escola: form.escola.trim(),
        municipio: form.municipio.trim(),

        modalidade: form.modalidade.trim(),
        categoria: form.categoria.trim(),
        naipe: form.naipe.trim(),

        jogo_descricao:
          form.jogo_descricao.trim(),

        tipo_recurso:
          form.tipo_recurso.trim(),

        relato: form.relato.trim(),

        status: "pendente",
        priority: "normal",
      };

      const { data, error } = await (supabase as any)
        .from("cde_cases")
        .insert(payload)
        .select("*")
        .single();

      if (error) throw error;

      if (files.length > 0) {
        for (const file of files) {
          const ext = file.name
            .split(".")
            .pop();

          const cleanName = file.name
            .replace(/\s+/g, "_")
            .replace(/[^\w.\-]/g, "");

          const path = `${data.id}/${Date.now()}-${cleanName}`;

          const { error: uploadError } =
            await supabase.storage
              .from("cde-attachments")
              .upload(path, file, {
                cacheControl: "3600",
                upsert: false,
              });

          if (uploadError) throw uploadError;

          const { error: attachmentError } =
            await (supabase as any)
              .from("cde_attachments")
              .insert({
                case_id: data.id,
                file_name: file.name,
                file_path: path,
                file_type:
                  file.type || ext || "arquivo",
                file_size: file.size,
              });

          if (attachmentError)
            throw attachmentError;
        }
      }

      try {
        await supabase.functions.invoke(
          "send-cde-notification",
          {
            body: data,
          }
        );
      } catch {
        console.warn(
          "Notificação CDE não enviada."
        );
      }

      await (supabase as any)
        .from("cde_case_history")
        .insert({
          case_id: data.id,

          action_type: "created",

          action_label:
            "Recurso protocolado",

          action_description:
            "Recurso enviado pelo professor responsável.",

          created_by: form.professor_nome,
        });

      setSent(data);

      toast.success(
        "Recurso enviado com sucesso."
      );
    } catch (err: any) {
      console.error(err);

      toast.error(
        err?.message ||
          "Erro ao enviar recurso."
      );
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-xl w-full">
          <CardContent className="p-6 space-y-4 text-center">
            <h1 className="text-2xl font-bold text-green-600">
              Recurso protocolado com sucesso
            </h1>

            <p className="text-sm text-muted-foreground">
              Seu recurso foi registrado na
              Comissão Disciplinar Especial.
            </p>

            <div className="rounded-lg border p-4 bg-background">
              <p className="text-xs text-muted-foreground">
                Protocolo
              </p>

              <p className="text-2xl font-bold">
                {sent.protocol}
              </p>
            </div>

            <div className="text-left rounded-lg border p-4 bg-background">
              <p className="text-sm font-semibold">
                Link de acompanhamento
              </p>

              <p className="text-xs text-muted-foreground break-all mt-1">
                {consultaUrl}
              </p>
            </div>

            <Button
              className="w-full"
              onClick={() =>
                navigator.clipboard.writeText(
                  consultaUrl
                )
              }
            >
              Copiar link de acompanhamento
            </Button>

            <Link to="/cde/recurso">
              <Button
                variant="outline"
                className="w-full"
              >
                Enviar novo recurso
              </Button>
            </Link>

            <p className="text-xs text-muted-foreground">
              Guarde o protocolo para acompanhar
              a análise da CDE.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="mx-auto max-w-3xl space-y-4">
        <Card>
          <CardContent className="p-6 space-y-5">
            <div>
              <h1 className="text-3xl font-bold">
                Recurso CDE
              </h1>

              <p className="text-sm text-muted-foreground">
                Comissão Disciplinar Especial —
                Jogos Escolares
              </p>

              <div className="mt-4 rounded-lg border bg-amber-50 p-3 text-sm">
                <p className="font-medium">
                  Preencha o recurso com o máximo
                  de detalhes possíveis.
                </p>

                <p className="text-muted-foreground mt-1">
                  Anexe súmulas, fotos, prints ou
                  documentos que ajudem na análise.
                </p>
              </div>
            </div>

            <div className="rounded-lg border bg-background/60 p-4">
              <p className="text-sm font-semibold">
                Dados do solicitante
              </p>

              <div className="grid md:grid-cols-2 gap-3 mt-3">
                <Input
                  placeholder="Nome do professor *"
                  value={form.professor_nome}
                  onChange={(e) =>
                    update(
                      "professor_nome",
                      e.target.value
                    )
                  }
                />

                <Input
                  placeholder="Email do professor *"
                  type="email"
                  value={form.professor_email}
                  onChange={(e) =>
                    update(
                      "professor_email",
                      e.target.value
                    )
                  }
                />

                <Input
                  placeholder="Telefone"
                  value={form.professor_telefone}
                  onChange={(e) =>
                    update(
                      "professor_telefone",
                      e.target.value
                    )
                  }
                />

                <Input
                  placeholder="Escola *"
                  value={form.escola}
                  onChange={(e) =>
                    update(
                      "escola",
                      e.target.value
                    )
                  }
                />

                <Select
                  value={form.municipio}
                  onValueChange={(value) =>
                    update("municipio", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Município" />
                  </SelectTrigger>

                  <SelectContent>
                    {MUNICIPIOS_RR.map((m) => (
                      <SelectItem
                        key={m}
                        value={m}
                      >
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border bg-background/60 p-4">
              <p className="text-sm font-semibold">
                Dados da competição
              </p>

              <div className="grid md:grid-cols-2 gap-3 mt-3">
                <Input
                  placeholder="Modalidade *"
                  value={form.modalidade}
                  onChange={(e) =>
                    update(
                      "modalidade",
                      e.target.value
                    )
                  }
                />

                <Select
                  value={form.categoria}
                  onValueChange={(value) =>
                    update("categoria", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>

                  <SelectContent>
                    {CATEGORIAS.map((c) => (
                      <SelectItem
                        key={c}
                        value={c}
                      >
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={form.naipe}
                  onValueChange={(value) =>
                    update("naipe", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Naipe" />
                  </SelectTrigger>

                  <SelectContent>
                    {NAIPES.map((n) => (
                      <SelectItem
                        key={n}
                        value={n}
                      >
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={form.tipo_recurso}
                  onValueChange={(value) =>
                    update(
                      "tipo_recurso",
                      value
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo do recurso" />
                  </SelectTrigger>

                  <SelectContent>
                    {TIPOS_RECURSO.map((tipo) => (
                      <SelectItem
                        key={tipo}
                        value={tipo}
                      >
                        {tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Input
                className="mt-3"
                placeholder="Partida / confronto ex: Escola A x Escola B"
                value={form.jogo_descricao}
                onChange={(e) =>
                  update(
                    "jogo_descricao",
                    e.target.value
                  )
                }
              />
            </div>

            <div className="rounded-lg border bg-background/60 p-4 space-y-3">
              <p className="text-sm font-semibold">
                Relato do ocorrido
              </p>

              <Textarea
                placeholder="Descreva detalhadamente o que aconteceu. *"
                rows={6}
                value={form.relato}
                onChange={(e) =>
                  update(
                    "relato",
                    e.target.value
                  )
                }
              />
            </div>

            <div className="rounded-lg border bg-background/60 p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold">
                  Anexos do recurso
                </p>

                <p className="text-xs text-muted-foreground">
                  Envie documentos, prints,
                  súmulas ou fotos. Máximo 5
                  arquivos, até 10MB cada.
                </p>
              </div>

              <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed p-6 hover:bg-muted/50">
                <div className="text-center">
                  <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />

                  <p className="text-sm font-medium">
                    Clique para anexar arquivos
                  </p>

                  <p className="text-xs text-muted-foreground">
                    PDF, imagem ou documento
                  </p>
                </div>

                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={selecionarArquivos}
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                />
              </label>

              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between rounded-md border bg-background p-2 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground" />

                        <span className="truncate">
                          {file.name}
                        </span>

                        <span className="text-xs text-muted-foreground">
                          {(
                            file.size /
                            1024 /
                            1024
                          ).toFixed(2)}
                          MB
                        </span>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          removerArquivo(index)
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button
              disabled={loading}
              onClick={enviar}
              className="w-full"
            >
              {loading
                ? "Protocolando recurso..."
                : "Protocolar recurso"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
