import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, GitCommit, Calendar, Globe, Database } from "lucide-react";

interface VersionData {
  appVersion: string;
  environment: string;
  branch: string;
  commit: string;
  commitFull: string;
  buildDate: string;
  supabaseProjectRef: string;
}

const StatusPage = () => {
  const [version, setVersion] = useState<VersionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/version.json?t=" + Date.now())
      .then((res) => {
        if (!res.ok) throw new Error("Falha ao carregar version.json");
        return res.json();
      })
      .then((data) => {
        setVersion(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl pt-12">
      <Card className="border-t-4 border-t-primary shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
          <CardTitle className="text-2xl font-bold">Status do Deploy</CardTitle>
          <Badge variant="secondary" className="gap-1 px-3 py-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Online
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? (
            <div className="p-4 bg-destructive/10 text-destructive rounded-md border border-destructive/20">
              Erro: {error}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Globe className="h-4 w-4" /> Ambiente
                  </p>
                  <p className="text-lg font-semibold uppercase">{version?.environment || "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Database className="h-4 w-4" /> Versão do App
                  </p>
                  <p className="text-lg font-semibold">{version?.appVersion || "N/A"}</p>
                </div>
              </div>

              <div className="space-y-1 p-4 bg-muted/50 rounded-lg border">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-2">
                  <GitCommit className="h-4 w-4" /> Commit Deployado
                </p>
                <div className="flex flex-col gap-1">
                  <code className="text-sm bg-background p-2 rounded border break-all font-mono">
                    {version?.commitFull || version?.commit || "N/A"}
                  </code>
                  <p className="text-xs text-muted-foreground mt-1">
                    Branch: <span className="font-medium text-foreground">{version?.branch || "N/A"}</span>
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Data do Build
                </p>
                <p className="text-base font-medium">
                  {version?.buildDate ? new Date(version.buildDate).toLocaleString("pt-BR") : "N/A"}
                </p>
              </div>

              <div className="pt-4 border-t text-center">
                <p className="text-xs text-muted-foreground">
                  Ref: {version?.supabaseProjectRef || "N/A"}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      
      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>Esta página exibe as informações contidas no arquivo <code>version.json</code> gerado durante o processo de build.</p>
      </div>
    </div>
  );
};

export default StatusPage;
