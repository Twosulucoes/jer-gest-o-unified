import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle, AlertTriangle, Database, RefreshCw, Save, RotateCcw, Eye, EyeOff } from "lucide-react";
import {
  ACTIVE_SUPABASE,
  SUPABASE_DEFAULTS,
  SUPABASE_OVERRIDE_KEYS,
} from "@/integrations/supabase/client";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";

function maskKey(k: string) {
  if (!k) return "";
  if (k.length <= 16) return "••••";
  return `${k.slice(0, 8)}…${k.slice(-6)}`;
}

function isValidUrl(u: string) {
  try {
    const x = new URL(u);
    return x.protocol === "https:" && x.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

function isValidJwt(k: string) {
  return /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(k.trim());
}

export default function SupabaseSetupPage() {
  const initialUrl = typeof window !== "undefined" ? localStorage.getItem(SUPABASE_OVERRIDE_KEYS.url) || "" : "";
  const initialKey = typeof window !== "undefined" ? localStorage.getItem(SUPABASE_OVERRIDE_KEYS.anonKey) || "" : "";

  const [url, setUrl] = useState(initialUrl);
  const [anonKey, setAnonKey] = useState(initialKey);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const usingOverride = !!initialUrl || !!initialKey;
  const usingDefault = ACTIVE_SUPABASE.url === SUPABASE_DEFAULTS.url;

  const urlValid = url === "" || isValidUrl(url);
  const keyValid = anonKey === "" || isValidJwt(anonKey);
  const canSave = url.trim() !== "" && anonKey.trim() !== "" && urlValid && keyValid;

  const projectRef = useMemo(() => {
    try {
      const host = new URL(ACTIVE_SUPABASE.url).hostname;
      return host.split(".")[0];
    } catch {
      return "—";
    }
  }, []);

  const handleTest = async () => {
    if (!canSave) {
      toast.error("Preencha URL e Anon Key válidos antes de testar.");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const client = createClient(url.trim(), anonKey.trim());
      const { error } = await client.from("profiles").select("id", { count: "exact", head: true }).limit(1);
      if (error && !["PGRST116", "42P01"].includes(error.code || "")) {
        // PGRST116 = no rows; 42P01 = table missing (schema diferente, mas conexão OK)
        if (error.message?.toLowerCase().includes("invalid api key") || error.message?.toLowerCase().includes("jwt")) {
          throw error;
        }
      }
      setTestResult({ ok: true, message: "Conexão estabelecida com sucesso." });
      toast.success("Conexão validada");
    } catch (err: any) {
      setTestResult({ ok: false, message: err?.message || "Falha ao conectar." });
      toast.error("Falha na conexão: " + (err?.message || "erro desconhecido"));
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (!canSave) return;
    localStorage.setItem(SUPABASE_OVERRIDE_KEYS.url, url.trim());
    localStorage.setItem(SUPABASE_OVERRIDE_KEYS.anonKey, anonKey.trim());
    toast.success("Credenciais salvas. Recarregando…");
    setTimeout(() => window.location.reload(), 800);
  };

  const handleReset = () => {
    if (!confirm("Remover override e voltar para o projeto Supabase padrão?")) return;
    localStorage.removeItem(SUPABASE_OVERRIDE_KEYS.url);
    localStorage.removeItem(SUPABASE_OVERRIDE_KEYS.anonKey);
    toast.success("Override removido. Recarregando…");
    setTimeout(() => window.location.reload(), 800);
  };

  return (
    <div className="container mx-auto py-8 max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Database className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuração do Supabase</h1>
          <p className="text-sm text-muted-foreground">Troque o projeto Supabase ativo sem editar código.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Conexão ativa</CardTitle>
          <CardDescription>Credenciais que o app está usando agora.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Project Ref</p>
              <p className="text-sm font-mono font-semibold">{projectRef}</p>
            </div>
            <Badge variant={usingOverride ? "default" : "secondary"}>
              {usingOverride ? "Override ativo (localStorage)" : usingDefault ? "Projeto padrão" : "Via env (.env)"}
            </Badge>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">URL</p>
            <p className="text-xs font-mono break-all">{ACTIVE_SUPABASE.url}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Anon Key</p>
            <p className="text-xs font-mono">{maskKey(ACTIVE_SUPABASE.anonKey)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Trocar projeto Supabase</CardTitle>
          <CardDescription>
            Salva as credenciais no <code className="text-xs">localStorage</code> deste navegador. O app passa a usar
            esse projeto até você clicar em <strong>Resetar</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Atenção</AlertTitle>
            <AlertDescription className="text-xs">
              O override fica neste navegador apenas. O novo projeto precisa ter o schema migrado (tabelas, RLS, edge
              functions), senão as queries vão falhar.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="sb-url">VITE_SUPABASE_URL</Label>
            <Input
              id="sb-url"
              placeholder="https://xxxxx.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className={!urlValid ? "border-destructive" : ""}
            />
            {!urlValid && <p className="text-xs text-destructive">URL deve ser https://*.supabase.co</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sb-key">VITE_SUPABASE_PUBLISHABLE_KEY (anon key)</Label>
            <div className="relative">
              <Input
                id="sb-key"
                type={showKey ? "text" : "password"}
                placeholder="eyJhbGciOi..."
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                className={!keyValid ? "border-destructive pr-10" : "pr-10"}
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showKey ? "Ocultar" : "Mostrar"}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {!keyValid && <p className="text-xs text-destructive">Formato JWT inválido.</p>}
            <p className="text-[11px] text-muted-foreground">
              Use a chave <strong>anon / publishable</strong> (NUNCA a service_role).
            </p>
          </div>

          {testResult && (
            <Alert variant={testResult.ok ? "default" : "destructive"}>
              {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              <AlertTitle>{testResult.ok ? "OK" : "Erro"}</AlertTitle>
              <AlertDescription className="text-xs">{testResult.message}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" onClick={handleTest} disabled={!canSave || testing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${testing ? "animate-spin" : ""}`} />
              Testar conexão
            </Button>
            <Button onClick={handleSave} disabled={!canSave}>
              <Save className="mr-2 h-4 w-4" />
              Salvar e recarregar
            </Button>
            {usingOverride && (
              <Button variant="ghost" onClick={handleReset}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Resetar para padrão
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
