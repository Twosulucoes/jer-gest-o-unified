import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle, AlertCircle, Database, ShieldCheck, Key, ExternalLink, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function SupabaseSetupPage() {
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<{
    url: boolean;
    anonKey: boolean;
    dbConnection: boolean;
    error?: string;
  }>({
    url: !!import.meta.env.VITE_SUPABASE_URL,
    anonKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
    dbConnection: false
  });

  const checkConnection = async () => {
    setChecking(true);
    try {
      // Teste simples para ver se conseguimos falar com o Supabase
      const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true }).limit(1);
      
      setStatus(prev => ({
        ...prev,
        dbConnection: !error,
        error: error?.message
      }));
    } catch (err: any) {
      setStatus(prev => ({
        ...prev,
        dbConnection: false,
        error: err.message
      }));
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const needsSecrets = !status.dbConnection || !status.url;

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Database className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Configuração do Supabase</h1>
          <p className="text-muted-foreground">Verificação de integração e variáveis de ambiente.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              SUPABASE_URL
              {status.url ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={status.url ? "default" : "destructive"}>
              {status.url ? "Configurado" : "Ausente"}
            </Badge>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              ANON_KEY
              {status.anonKey ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={status.anonKey ? "default" : "destructive"}>
              {status.anonKey ? "Configurado" : "Ausente"}
            </Badge>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Conexão Banco
              {status.dbConnection ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={status.dbConnection ? "default" : "destructive"}>
              {status.dbConnection ? "Ativa" : "Inativa"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {needsSecrets && (
        <Alert variant="destructive" className="bg-red-950/20 border-red-900/50">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Conexão Pendente</AlertTitle>
          <AlertDescription>
            Detectamos que o projeto ainda não está totalmente integrado ao Supabase. 
            A Lovable precisa dessas credenciais para que eu possa executar comandos no banco e implantar funções.
          </AlertDescription>
        </Alert>
      )}

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Fluxo Guiado de Conexão
          </CardTitle>
          <CardDescription>
            Siga os passos abaixo para habilitar todas as funcionalidades do sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-none w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">1</div>
              <div className="space-y-1">
                <p className="font-medium text-zinc-100">Clique no botão "Connect Supabase"</p>
                <p className="text-sm text-muted-foreground italic">Este botão fica no canto superior direito da interface do Lovable.</p>
                <div className="mt-2 p-2 border border-zinc-800 rounded bg-zinc-950 text-xs font-mono text-zinc-400">
                  Ao clicar, a Lovable configurará automaticamente as variáveis:
                  <br />• SUPABASE_URL
                  <br />• SUPABASE_SERVICE_ROLE_KEY
                  <br />• DATABASE_URL
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-none w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">2</div>
              <div className="space-y-1">
                <p className="font-medium text-zinc-100">Verifique os Segredos (Secrets)</p>
                <p className="text-sm text-muted-foreground">
                  No menu lateral, vá em <strong>Settings &gt; Secrets</strong> e confirme se as chaves acima aparecem lá.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-none w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">3</div>
              <div className="space-y-1">
                <p className="font-medium text-zinc-100">Revalide a Conexão</p>
                <p className="text-sm text-muted-foreground">
                  Após conectar, clique no botão abaixo para testar se o frontend já consegue acessar o banco.
                </p>
                <Button 
                  onClick={checkConnection} 
                  disabled={checking}
                  variant="outline"
                  size="sm"
                  className="mt-2"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
                  Testar Conexão Agora
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-zinc-950/50 border-t border-zinc-800 flex justify-between items-center py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Key className="h-4 w-4" />
            Precisa de ajuda manual?
          </div>
          <Button variant="ghost" size="sm" asChild>
            <a href="https://docs.lovable.dev/integrations/supabase" target="_blank" rel="noreferrer">
              Ver Documentação <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </CardFooter>
      </Card>

      {!status.dbConnection && status.error && (
        <Card className="bg-zinc-950 border-red-900/30">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold text-red-400">Detalhes Técnicos do Erro</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs text-red-300 font-mono bg-red-950/10 p-2 rounded overflow-auto">
              {status.error}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
