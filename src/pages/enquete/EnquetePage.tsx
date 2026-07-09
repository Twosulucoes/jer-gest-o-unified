import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { toast } from "sonner";
import { cn } from "@/lib/utils";

import {
  ENQUETE_TAGS,
  ENQUETE_SELOS_ZOEIRA,
  XP_POR_TAG,
  XP_POR_SUBJETIVA,
  calcXpPreview,
  phoneMask,
  normalizeTelefone,
  type EnqueteFinalizarCadastroResult,
} from "@/lib/enquete";

const XP_MAXIMO = ENQUETE_TAGS.length * XP_POR_TAG + 2 * XP_POR_SUBJETIVA;
const SELO_NENHUM = "nenhum";

interface CadastroSucesso {
  numeroSorte?: number;
  titulo?: string;
  xp?: number;
}

export default function EnquetePage() {
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [setor, setSetor] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [momentoMvp, setMomentoMvp] = useState("");
  const [perrengue, setPerrengue] = useState("");
  const [seloZoeira, setSeloZoeira] = useState("");
  const [exibirNoMural, setExibirNoMural] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState<CadastroSucesso | null>(null);

  const xpAtual = useMemo(
    () => calcXpPreview({ tags, momentoMvp, perrengue }),
    [tags, momentoMvp, perrengue]
  );

  const progresso = Math.min(100, Math.round((xpAtual / XP_MAXIMO) * 100));

  function alternarTag(id: string) {
    setTags((atual) => (atual.includes(id) ? atual.filter((t) => t !== id) : [...atual, id]));
  }

  function selecionarSelo(value: string) {
    const proximoSelo = value === SELO_NENHUM ? "" : value;
    setSeloZoeira(proximoSelo);
    if (!proximoSelo) setExibirNoMural(false);
  }

  async function enviar() {
    const telefone = normalizeTelefone(whatsapp);

    if (!nome.trim()) {
      toast.error("Informe seu nome.");
      return;
    }

    if (telefone.length < 10 || telefone.length > 11) {
      toast.error("Informe um WhatsApp válido.");
      return;
    }

    if (!setor.trim()) {
      toast.error("Informe seu setor.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await (supabase as any).rpc("enq_finalizar_cadastro", {
        p_nome: nome.trim(),
        p_telefone: telefone,
        p_orgao: setor.trim(),
        p_tags: tags,
        p_momento_mvp: momentoMvp.trim() || null,
        p_perrengue: perrengue.trim() || null,
        p_selo: seloZoeira || null,
        p_selo_publico: exibirNoMural,
        p_avatar_url: null,
      });

      if (error) throw error;

      const resultado = data as EnqueteFinalizarCadastroResult;

      if (!resultado.ok) {
        toast.error(resultado.erro || "Não foi possível concluir o cadastro.");
        return;
      }

      setSucesso({
        numeroSorte: resultado.numero_sorte,
        titulo: resultado.titulo,
        xp: resultado.xp,
      });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao enviar cadastro.");
    } finally {
      setLoading(false);
    }
  }

  if (sucesso) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 space-y-4 text-center">
            <h1 className="text-2xl font-bold text-green-600">Cadastro confirmado!</h1>

            <p className="text-sm text-muted-foreground">
              Obrigado por participar da Enquete de Reconhecimento JER 2026.
            </p>

            <div className="rounded-lg border p-4 bg-background">
              <p className="text-xs text-muted-foreground">Seu número da sorte</p>
              <p className="text-4xl font-bold text-primary">{sucesso.numeroSorte ?? "-"}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 bg-background">
                <p className="text-xs text-muted-foreground">Título</p>
                <p className="font-semibold">{sucesso.titulo || "-"}</p>
              </div>

              <div className="rounded-lg border p-3 bg-background">
                <p className="text-xs text-muted-foreground">XP</p>
                <p className="font-semibold">{sucesso.xp ?? xpAtual}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-8">
      <div className="sticky top-0 z-20 border-b bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto max-w-lg space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">Seu XP</span>
            <span className="font-semibold text-primary">{xpAtual} XP</span>
          </div>
          <Progress value={progresso} />
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-4 p-4">
        <div>
          <h1 className="text-2xl font-bold">Enquete de Reconhecimento JER 2026</h1>
          <p className="text-sm text-muted-foreground">
            Conte sua contribuição nos Jogos e concorra ao sorteio.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-3 p-4">
            <Input placeholder="Seu nome *" value={nome} onChange={(e) => setNome(e.target.value)} />

            <Input
              placeholder="WhatsApp *"
              inputMode="numeric"
              value={whatsapp}
              onChange={(e) => setWhatsapp(phoneMask(e.target.value))}
            />

            <Input
              placeholder="Setor / função *"
              value={setor}
              onChange={(e) => setSetor(e.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div>
              <p className="text-sm font-semibold">O que você fez nos Jogos?</p>
              <p className="text-xs text-muted-foreground">
                Marque tudo que se aplica. Cada tag vale {XP_POR_TAG} XP.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {ENQUETE_TAGS.map((tag) => {
                const selecionada = tags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => alternarTag(tag.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors",
                      selecionada
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted"
                    )}
                  >
                    <span>{tag.emoji}</span>
                    <span>{tag.label}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-semibold">Conte mais (vale {XP_POR_SUBJETIVA} XP cada)</p>

            <Textarea
              placeholder="Qual foi seu momento MVP nos Jogos?"
              rows={3}
              value={momentoMvp}
              onChange={(e) => setMomentoMvp(e.target.value)}
            />

            <Textarea
              placeholder="Qual foi seu maior perrengue?"
              rows={3}
              value={perrengue}
              onChange={(e) => setPerrengue(e.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-semibold">Selo de zoeira (opcional)</p>

            <Select value={seloZoeira || SELO_NENHUM} onValueChange={selecionarSelo}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um selo" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value={SELO_NENHUM}>Nenhum</SelectItem>
                {ENQUETE_SELOS_ZOEIRA.map((selo) => (
                  <SelectItem key={selo.id} value={selo.id}>
                    {selo.emoji} {selo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={exibirNoMural}
                disabled={!seloZoeira}
                onCheckedChange={(checked) => setExibirNoMural(checked === true)}
              />
              Exibir meu selo no mural
            </label>
          </CardContent>
        </Card>

        <Button disabled={loading} onClick={enviar} className="w-full" size="lg">
          {loading ? "Enviando..." : "Confirmar meu cadastro"}
        </Button>
      </div>
    </div>
  );
}
