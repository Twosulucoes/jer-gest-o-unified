import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CdeConsultaPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState<any>(null);

  useEffect(() => {
    async function carregar() {
      if (!token) return;

      const { data, error } = await (supabase as any)
        .from("cde_cases")
        .select("*")
        .eq("public_token", token)
        .maybeSingle();

      if (!error && data) setCaseData(data);

      setLoading(false);
    }

    carregar();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Carregando recurso...
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-xl w-full">
          <CardContent className="p-6 text-center space-y-4">
            <h1 className="text-2xl font-bold">Recurso não encontrado</h1>
            <p className="text-sm text-muted-foreground">
              Verifique se o link de acompanhamento está correto.
            </p>
            <Link to="/cde/recurso">
              <Button>Enviar novo recurso</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const decisaoPublicada = caseData.is_published === true;

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <h1 className="text-2xl font-bold">Consulta de Recurso CDE</h1>
              <p className="text-sm text-muted-foreground">
                Acompanhe o andamento do seu recurso.
              </p>
            </div>

            <div className="rounded-lg border p-4 bg-background">
              <p className="text-xs text-muted-foreground">Protocolo</p>
              <p className="text-xl font-bold">{caseData.protocol}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="font-semibold uppercase">{caseData.status}</p>
              </div>

              <div>
                <p className="text-muted-foreground">Prioridade</p>
                <p className="font-semibold">{caseData.priority || "normal"}</p>
              </div>

              <div>
                <p className="text-muted-foreground">Professor</p>
                <p className="font-semibold">{caseData.professor_nome}</p>
              </div>

              <div>
                <p className="text-muted-foreground">Escola</p>
                <p className="font-semibold">{caseData.escola}</p>
              </div>

              <div>
                <p className="text-muted-foreground">Município</p>
                <p className="font-semibold">{caseData.municipio || "-"}</p>
              </div>

              <div>
                <p className="text-muted-foreground">Modalidade</p>
                <p className="font-semibold">{caseData.modalidade}</p>
              </div>

              <div>
                <p className="text-muted-foreground">Categoria</p>
                <p className="font-semibold">{caseData.categoria || "-"}</p>
              </div>

              <div>
                <p className="text-muted-foreground">Naipe</p>
                <p className="font-semibold">{caseData.naipe || "-"}</p>
              </div>
            </div>

            <div className="rounded-lg border p-4 bg-background">
              <p className="text-sm font-semibold mb-1">Relato</p>
              <p className="text-sm whitespace-pre-wrap">{caseData.relato}</p>
            </div>

            {caseData.pedido && (
              <div className="rounded-lg border p-4 bg-background">
                <p className="text-sm font-semibold mb-1">Pedido</p>
                <p className="text-sm whitespace-pre-wrap">{caseData.pedido}</p>
              </div>
            )}

            {caseData.status === "decidido" && !decisaoPublicada && (
              <div className="rounded-lg border p-4 bg-yellow-50">
                <p className="text-sm font-semibold mb-1">Decisão em processamento</p>
                <p className="text-sm">
                  A CDE já registrou julgamento interno, mas a decisão ainda não foi publicada para consulta.
                </p>
              </div>
            )}

            {decisaoPublicada && caseData.decision_text && (
              <div className="rounded-lg border p-4 bg-green-50">
                <p className="text-sm font-semibold mb-1">Decisão publicada da CDE</p>
                <p className="text-sm whitespace-pre-wrap">
                  {caseData.decision_text}
                </p>

                {caseData.published_at && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Publicada em: {new Date(caseData.published_at).toLocaleString("pt-BR")}
                  </p>
                )}
              </div>
            )}

            <Link to="/cde/recurso">
              <Button variant="outline" className="w-full">
                Enviar outro recurso
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}