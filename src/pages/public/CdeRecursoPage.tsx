import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

function gerarProtocolo() {
  const ano = new Date().getFullYear();
  const n = Math.floor(Math.random() * 999999).toString().padStart(6, "0");
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
    pedido: "",
  });

  const consultaUrl = useMemo(() => {
    if (!sent?.public_token) return "";
    return `${window.location.origin}/cde/consulta/${sent.public_token}`;
  }, [sent]);

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
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
        professor_telefone: form.professor_telefone.trim(),
        escola: form.escola.trim(),
        municipio: form.municipio.trim(),
        modalidade: form.modalidade.trim(),
        categoria: form.categoria.trim(),
        naipe: form.naipe.trim(),
        jogo_descricao: form.jogo_descricao.trim(),
        tipo_recurso: form.tipo_recurso.trim(),
        relato: form.relato.trim(),
        pedido: form.pedido.trim(),

        status: "pendente",
        priority: "normal",
      };

const { data, error } = await (supabase as any)
  .from("cde_cases")
  .insert(payload)
  .select("*")
  .single();

      if (error) throw error;

      try {
        await supabase.functions.invoke("send-cde-notification", {
          body: data,
        });
      } catch {
        console.warn("Notificação CDE não enviada.");
      }

      setSent(data);
      toast.success("Recurso enviado com sucesso.");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao enviar recurso.");
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
              Recurso enviado com sucesso
            </h1>

            <p className="text-sm text-muted-foreground">
              Seu recurso foi registrado na Comissão Disciplinar Especial.
            </p>

            <div className="rounded-lg border p-4 bg-background">
              <p className="text-xs text-muted-foreground">Protocolo</p>
              <p className="text-2xl font-bold">{sent.protocol}</p>
            </div>

            <div className="text-left rounded-lg border p-4 bg-background">
              <p className="text-sm font-semibold">Link de acompanhamento</p>
              <p className="text-xs text-muted-foreground break-all mt-1">
                {consultaUrl}
              </p>
            </div>

            <Button
              className="w-full"
              onClick={() => navigator.clipboard.writeText(consultaUrl)}
            >
              Copiar link de acompanhamento
            </Button>

            <Link to="/cde/recurso">
              <Button variant="outline" className="w-full">
                Enviar novo recurso
              </Button>
            </Link>

            <p className="text-xs text-muted-foreground">
              Guarde o protocolo para acompanhar a análise da CDE.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="mx-auto max-w-2xl space-y-4">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <h1 className="text-2xl font-bold">Recurso CDE</h1>
              <p className="text-sm text-muted-foreground">
                Comissão Disciplinar Especial — Jogos Escolares
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <Input
                placeholder="Nome do professor *"
                value={form.professor_nome}
                onChange={(e) => update("professor_nome", e.target.value)}
              />

              <Input
                placeholder="Email do professor *"
                type="email"
                value={form.professor_email}
                onChange={(e) => update("professor_email", e.target.value)}
              />

              <Input
                placeholder="Telefone"
                value={form.professor_telefone}
                onChange={(e) => update("professor_telefone", e.target.value)}
              />

              <Input
                placeholder="Escola *"
                value={form.escola}
                onChange={(e) => update("escola", e.target.value)}
              />

              <Input
                placeholder="Município"
                value={form.municipio}
                onChange={(e) => update("municipio", e.target.value)}
              />

              <Input
                placeholder="Modalidade *"
                value={form.modalidade}
                onChange={(e) => update("modalidade", e.target.value)}
              />

              <Input
                placeholder="Categoria ex: 12 a 14"
                value={form.categoria}
                onChange={(e) => update("categoria", e.target.value)}
              />

              <Input
                placeholder="Naipe"
                value={form.naipe}
                onChange={(e) => update("naipe", e.target.value)}
              />
            </div>

            <Input
              placeholder="Jogo/partida ex: Escola A x Escola B"
              value={form.jogo_descricao}
              onChange={(e) => update("jogo_descricao", e.target.value)}
            />

            <Input
              placeholder="Tipo do recurso *"
              value={form.tipo_recurso}
              onChange={(e) => update("tipo_recurso", e.target.value)}
            />

            <Textarea
              placeholder="Relato do ocorrido *"
              rows={5}
              value={form.relato}
              onChange={(e) => update("relato", e.target.value)}
            />

            <Textarea
              placeholder="Pedido do recurso"
              rows={3}
              value={form.pedido}
              onChange={(e) => update("pedido", e.target.value)}
            />

            <Button disabled={loading} onClick={enviar} className="w-full">
              {loading ? "Enviando..." : "Enviar recurso"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}