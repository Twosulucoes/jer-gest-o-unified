import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { toast } from "sonner";
import { CheckCircle2, FileSignature, ShieldCheck } from "lucide-react";

export default function CdeAssinarPage() {
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signed, setSigned] = useState(false);

  const [caseData, setCaseData] = useState<any>(null);
  const [signatures, setSignatures] = useState<any[]>([]);

  const [form, setForm] = useState({
    signer_name: "",
    signer_role: "",
    signer_document: "",
  });

  const consultaUrl = useMemo(() => {
    if (!caseData?.public_token) return "";
    return `${window.location.origin}/cde/consulta/${caseData.public_token}`;
  }, [caseData]);

  function update(key: string, value: string) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function load() {
    if (!token) return;

    setLoading(true);

    try {
      const { data, error } = await (supabase as any)
        .from("cde_cases")
        .select("*")
        .eq("public_token", token)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setCaseData(null);
        return;
      }

      setCaseData(data);

      const { data: sigs, error: sigError } = await (supabase as any)
        .from("cde_decision_signatures")
        .select("*")
        .eq("case_id", data.id)
        .order("signed_at", { ascending: true });

      if (sigError) throw sigError;

      setSignatures(sigs || []);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao carregar assinatura.");
    } finally {
      setLoading(false);
    }
  }

  async function assinar() {
    if (!caseData) return;

    if (!form.signer_name.trim() || !form.signer_role.trim()) {
      toast.error("Preencha nome completo e função.");
      return;
    }

    setSaving(true);

    try {
      const userAgent = navigator.userAgent || "";

      const { error } = await (supabase as any)
        .from("cde_decision_signatures")
        .insert({
          case_id: caseData.id,
          public_token: caseData.public_token,
          signer_name: form.signer_name.trim(),
          signer_role: form.signer_role.trim(),
          signer_document: form.signer_document.trim() || null,
          user_agent: userAgent,
        });

      if (error) throw error;

      await (supabase as any).from("cde_case_history").insert({
        case_id: caseData.id,
        action_type: "signature",
        action_label: "Documento assinado eletronicamente",
        action_description: `${form.signer_name.trim()} assinou como ${form.signer_role.trim()}.`,
        created_by: form.signer_name.trim(),
      });

      toast.success("Documento assinado com sucesso.");
      setSigned(true);
      load();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao registrar assinatura.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Carregando documento para assinatura...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="p-6 text-center space-y-4">
            <h1 className="text-2xl font-bold">Documento não encontrado</h1>

            <p className="text-sm text-muted-foreground">
              O link de assinatura é inválido ou expirou.
            </p>

            <Link to="/">
              <Button variant="outline">Voltar ao início</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-xl w-full">
          <CardContent className="p-6 space-y-4 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />

            <h1 className="text-2xl font-bold text-green-600">
              Assinatura registrada
            </h1>

            <p className="text-sm text-muted-foreground">
              Sua assinatura eletrônica foi registrada com sucesso na decisão da CDE.
            </p>

            <div className="rounded-lg border bg-background p-4">
              <p className="text-xs text-muted-foreground">Protocolo</p>
              <p className="text-xl font-bold">{caseData.protocol}</p>
            </div>

            <a href={consultaUrl}>
              <Button className="w-full">Ver decisão pública</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="mx-auto max-w-2xl space-y-4">
        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-3 text-primary">
                <FileSignature className="h-6 w-6" />
              </div>

              <div>
                <h1 className="text-2xl font-bold">
                  Assinatura eletrônica da decisão
                </h1>

                <p className="text-sm text-muted-foreground">
                  Comissão Disciplinar Especial — Jogos Escolares
                </p>
              </div>
            </div>

            <div className="rounded-lg border bg-background p-4 space-y-2">
              <p className="text-xs text-muted-foreground">Protocolo</p>
              <p className="text-xl font-bold">{caseData.protocol}</p>

              <div className="grid md:grid-cols-2 gap-3 pt-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Escola</p>
                  <p className="font-semibold">{caseData.escola || "—"}</p>
                </div>

                <div>
                  <p className="text-muted-foreground">Modalidade</p>
                  <p className="font-semibold">{caseData.modalidade || "—"}</p>
                </div>

                <div>
                  <p className="text-muted-foreground">Categoria</p>
                  <p className="font-semibold">{caseData.categoria || "—"}</p>
                </div>

                <div>
                  <p className="text-muted-foreground">Naipe</p>
                  <p className="font-semibold">{caseData.naipe || "—"}</p>
                </div>

                <div>
                  <p className="text-muted-foreground">Decisão</p>
                  <p className="font-semibold">{caseData.decision || "—"}</p>
                </div>

                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-semibold">{caseData.status || "—"}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-amber-50 p-4 text-sm">
              <div className="flex gap-2">
                <ShieldCheck className="h-5 w-5 shrink-0 text-amber-700" />

                <div>
                  <p className="font-semibold text-amber-900">
                    Termo de assinatura eletrônica
                  </p>

                  <p className="mt-1 text-amber-900/80">
                    Ao assinar, declaro ciência e concordância com a decisão
                    registrada pela Comissão Disciplinar Especial, vinculada ao
                    protocolo acima. Esta assinatura eletrônica registra nome,
                    função, data, hora e informações técnicas do dispositivo.
                  </p>
                </div>
              </div>
            </div>

            {signatures.length > 0 && (
              <div className="rounded-lg border bg-background p-4 space-y-2">
                <p className="text-sm font-semibold">
                  Assinaturas já registradas
                </p>

                {signatures.map((s) => (
                  <div key={s.id} className="rounded-md border p-3 text-sm">
                    <p className="font-semibold">{s.signer_name}</p>
                    <p className="text-muted-foreground">{s.signer_role}</p>
                    <p className="text-xs text-muted-foreground">
                      Assinado em{" "}
                      {s.signed_at
                        ? new Date(s.signed_at).toLocaleString("pt-BR")
                        : "—"}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg border bg-background p-4 space-y-3">
              <p className="text-sm font-semibold">Dados do assinante</p>

              <Input
                placeholder="Nome completo *"
                value={form.signer_name}
                onChange={(e) => update("signer_name", e.target.value)}
              />

              <Input
                placeholder="Função na CDE * Ex: Presidente, Relator, Membro"
                value={form.signer_role}
                onChange={(e) => update("signer_role", e.target.value)}
              />

              <Input
                placeholder="Documento/CPF/Matrícula (opcional)"
                value={form.signer_document}
                onChange={(e) => update("signer_document", e.target.value)}
              />
            </div>

            <Button disabled={saving} onClick={assinar} className="w-full">
              {saving ? "Registrando assinatura..." : "Assinar eletronicamente"}
            </Button>

            <a href={consultaUrl}>
              <Button variant="outline" className="w-full">
                Ver decisão pública
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
