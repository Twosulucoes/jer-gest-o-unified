import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, ShieldCheck, User2 } from "lucide-react";
import { PwaBrandLogo } from "@/components/pwa/PwaBrandLogo";
import { useEventContext } from "@/contexts/EventContext";

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
  for (const role of ["admin", "super_admin", "secretaria"]) {
    if (roles.includes(role)) return ROLE_REDIRECT_MAP[role];
  }
  const opRoles = roles.filter((r) => ROLE_REDIRECT_MAP[r]);
  if (opRoles.length === 1) return ROLE_REDIRECT_MAP[opRoles[0]];
  if (opRoles.length > 1) return "/pwa";
  return "/pwa";
}

export default function PwaLoginPage() {
  const navigate = useNavigate();
  const { activeEvent } = useEventContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="op-screen relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-5 py-10">
      {/* glow decorativo */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-amber/15 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-sm space-y-7">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-module-soft text-module shadow-app-md ring-1 ring-inset border-module">
            <User2 className="h-7 w-7" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-extrabold tracking-tight text-foreground">JER Gestão</h1>
            <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">Operadores de Campo</p>
          </div>
          <div className="h-px w-12 bg-border/70" />
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="op-card space-y-4 p-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="operador@jergestao.rr"
                className="h-12 rounded-xl border-border/70 bg-background/60 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-12 rounded-xl border-border/70 bg-background/60 pr-10 text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="op-btn-primary" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Acessar Plataforma"}
            </Button>

            <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-module" />
              Acesso restrito a operadores autorizados
            </p>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate("/pwa/recover")}
              className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Esqueci minha senha
            </button>
          </div>
        </form>

        {/* Active event info removed from login to maintain focus on session */}
      </div>
    </div>
  );
}
