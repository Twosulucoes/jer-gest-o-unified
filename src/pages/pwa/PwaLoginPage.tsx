import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { PwaBrandLogo } from "@/components/pwa/PwaBrandLogo";

const ROLE_REDIRECT_MAP: Record<string, string> = {
  admin: "/admin",
  super_admin: "/admin",
  secretaria: "/admin",
  transporte: "/pwa/transporte",
  alimentacao: "/pwa/alimentacao",
  alojamento: "/pwa/alojamento",
  coordenacao_tecnica: "/pwa/coordenacao-tecnica",
  coordenador_modalidade: "/pwa/coordenacao-tecnica",
  delegacao: "/pwa/delegacao",
  mesario: "/aovivo",
  arbitragem: "/aovivo",
  pesquisa: "/pwa/pesquisa/login",
};

function resolveRedirect(roles: string[]): string {
  // Priority: admin roles first, then specific operational roles
  for (const role of ["admin", "super_admin", "secretaria"]) {
    if (roles.includes(role)) return ROLE_REDIRECT_MAP[role];
  }
  // Single operational role → go directly
  const opRoles = roles.filter((r) => ROLE_REDIRECT_MAP[r]);
  if (opRoles.length === 1) return ROLE_REDIRECT_MAP[opRoles[0]];
  // Multiple operational roles → landing page to choose
  if (opRoles.length > 1) return "/pwa";
  // Fallback
  return "/pwa";
}

export default function PwaLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError("Email ou senha inválidos.");
      setLoading(false);
      return;
    }

    if (data.user) {
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("active").eq("id", data.user.id).single(),
        supabase.from("user_roles").select("role").eq("user_id", data.user.id),
      ]);

      if (profileRes.data && profileRes.data.active === false) {
        await supabase.auth.signOut();
        setError("Sua conta está desativada. Entre em contato com o administrador.");
        setLoading(false);
        return;
      }

      const userRoles = (rolesRes.data || []).map((r) => r.role as string);
      const target = resolveRedirect(userRoles);
      navigate(target, { replace: true });
      return;
    }

    navigate("/pwa");
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-35" />
      <div
        className="relative flex flex-col items-center justify-center px-6 pt-12 pb-8"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(212 84% 36%) 40%, hsl(174 87% 34%) 70%, hsl(133 55% 45%) 100%)",
        }}
      >
        <PwaBrandLogo size="lg" className="drop-shadow-lg brightness-0 invert" />
        <p className="text-primary-foreground/80 text-sm mt-2 font-body">Acesso ao módulo operacional</p>
      </div>

      <div className="relative flex flex-1 items-start justify-center px-4 pt-8">
        <Card className="w-full max-w-sm border-border/80 bg-card/95 shadow-app-xl backdrop-blur-sm">
          <CardHeader className="pb-2">
            <h2 className="font-heading text-base font-semibold text-card-foreground">Entrar no módulo</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="h-12 text-base" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className="h-12 text-base" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Entrar"}
              </Button>

              <div className="text-center">
                <button type="button" onClick={() => navigate("/pwa/recover")} className="text-sm text-primary underline">
                  Esqueci minha senha
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
