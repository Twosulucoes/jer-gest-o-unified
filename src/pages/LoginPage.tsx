import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, CheckCircle } from "lucide-react";
import { brand } from "@/theme/brand";
import { APP_VERSION } from "@/config/version";

const ROLE_REDIRECT_MAP: Record<string, string> = {
  admin: "/admin",
  super_admin: "/admin",
  secretaria: "/admin",
  coordenacao_tecnica: "/admin",
  coordenador_modalidade: "/admin/coordenador-modalidade",
  cde: "/admin",
  transporte: "/pwa/transporte",
  alimentacao: "/pwa/alimentacao",
  alojamento: "/pwa/alojamento",
  delegacao: "/pwa/delegacao",
  mesario: "/aovivo",
  arbitragem: "/aovivo",
  pesquisa: "/pwa/pesquisa/login",
};

const ADMIN_ROLES = ["admin", "super_admin", "secretaria", "coordenacao_tecnica", "cde"];

function resolveRedirect(roles: string[]): string {
  // Check for active event/stage in localStorage
  const activeEventId = localStorage.getItem("jer_active_event_id");
  const activeStageId = localStorage.getItem("jer_active_stage_id");
  const hasPwaContext = !!activeEventId && !!activeStageId;

  // If only coordenador_modalidade, redirect to their dashboard
  if (roles.includes("coordenador_modalidade") && roles.length === 1) {
    return "/admin/coordenador-modalidade";
  }

  // If any other admin role → /admin
  if (roles.some(r => ADMIN_ROLES.includes(r))) return "/admin";

  // Single operational role → direct
  const opRoles = roles.filter(r => ROLE_REDIRECT_MAP[r]);
  if (opRoles.length === 1) {
    const target = ROLE_REDIRECT_MAP[opRoles[0]];
    // If operational role is a PWA role, check context
    if (target.startsWith("/pwa") && !hasPwaContext && target !== "/pwa/configuracao") {
      return "/pwa/configuracao";
    }
    return target;
  }

  // Multiple operational roles → module selector
  if (opRoles.length > 1) return "/selecionar-modulo";

  // Default fallback for PWA users
  return hasPwaContext ? "/pwa" : "/pwa/configuracao";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // If already authenticated, redirect immediately
  const { user: currentUser, roles: currentRoles, loading: authLoading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!authLoading && currentUser && currentRoles.length > 0) {
      // Priority 1: state.from (if reason is not missing_stage or if context exists)
      const from = (location.state as any)?.from?.pathname;
      const reason = (location.state as any)?.reason;
      const activeEventId = localStorage.getItem("jer_active_event_id");
      const activeStageId = localStorage.getItem("jer_active_stage_id");
      const hasPwaContext = !!activeEventId && !!activeStageId;

      if (from && from !== "/login") {
        // If coming from PWA but missing stage, must go to config unless context was recovered
        if (from.startsWith("/pwa") && from !== "/pwa/configuracao" && !hasPwaContext) {
          navigate("/pwa/configuracao", { replace: true, state: { from: (location.state as any)?.from, reason: "missing_stage" } });
        } else {
          navigate(from, { replace: true });
        }
        return;
      }

      const target = resolveRedirect(currentRoles);
      navigate(target, { replace: true });
    }
  }, [authLoading, currentUser, currentRoles, navigate, location]);

  // Recovery modal
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverLoading, setRecoverLoading] = useState(false);
  const [recoverSent, setRecoverSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      if (authError.message.includes("Invalid login")) {
        setError("Email ou senha inválidos.");
      } else {
        setError(authError.message);
      }
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
      
      // Use state.from if available and context is valid
      const from = (location.state as any)?.from?.pathname;
      const activeEventId = localStorage.getItem("jer_active_event_id");
      const activeStageId = localStorage.getItem("jer_active_stage_id");
      const hasPwaContext = !!activeEventId && !!activeStageId;

      if (from && from !== "/login") {
        if (from.startsWith("/pwa") && from !== "/pwa/configuracao" && !hasPwaContext) {
          navigate("/pwa/configuracao", { replace: true, state: { from: (location.state as any)?.from, reason: "missing_stage" } });
        } else {
          navigate(from, { replace: true });
        }
      } else {
        navigate(target, { replace: true });
      }
    }

    setLoading(false);
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoverLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(recoverEmail, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });

    if (error) {
      toast.error("Erro ao enviar email de recuperação.");
      setRecoverLoading(false);
      return;
    }

    setRecoverSent(true);
    setRecoverLoading(false);
    toast.success("Email enviado! Verifique sua caixa de entrada.");
  };

  const closeRecover = () => {
    setRecoverOpen(false);
    setRecoverEmail("");
    setRecoverSent(false);
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-background selection:bg-primary/30 selection:text-foreground op-screen">
      <div className="relative z-10 flex min-h-[100dvh] flex-col px-6">
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-12 animate-fade-in">
          
          <header className="mb-10 text-center space-y-6">
            <div className="inline-flex items-center justify-center p-5 rounded-[2.5rem] bg-white/5 backdrop-blur-xl ring-1 ring-white/10 shadow-2xl transition-transform hover:scale-105 duration-500">
              <img
                src="/brand/logo.png"
                alt="JER Gestão"
                className="h-24 w-auto object-contain dark:hidden"
              />
              <img
                src="/brand/logo-dark.png"
                alt="JER Gestão"
                className="hidden h-24 w-auto object-contain dark:block"
              />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-black tracking-tighter text-foreground">
                Portal <span className="text-primary italic">Operacional</span>
              </h1>
              <p className="text-sm font-medium text-muted-foreground max-w-[300px] mx-auto leading-relaxed">
                Bem-vindo ao sistema oficial dos Jogos Escolares. Identifique-se para continuar.
              </p>
            </div>
          </header>

          <main className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 transition duration-1000"></div>
            
            <Card className="op-card-elevated relative border-0 shadow-2xl rounded-[2rem] overflow-hidden glass-panel-strong">
              <CardContent className="p-8 sm:p-10">
                <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-2.5">
                    <Label htmlFor="email" className="op-label ml-1">
                      Identificação (E-mail)
                    </Label>
                    <div className="relative group/input">
                      <Input
                        id="email"
                        type="email"
                        inputMode="email"
                        placeholder="exemplo@seed.rr.gov.br"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-14 rounded-2xl border-border/50 bg-background/50 px-5 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all text-base"
                      />
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between ml-1">
                      <Label htmlFor="password" className="op-label">
                        Senha de Acesso
                      </Label>
                    </div>
                    <div className="relative group/input">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-14 rounded-2xl border-border/50 bg-background/50 px-5 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all text-base"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-0 top-0 flex h-14 w-14 items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                        tabIndex={-1}
                        aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
                      >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  </div>

                  {error && (
                    <div className="animate-in fade-in slide-in-from-top-2 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                      <span className="font-semibold">{error}</span>
                    </div>
                  )}

                  <div className="space-y-4 pt-2">
                    <Button
                      type="submit"
                      disabled={loading}
                      className="op-btn-primary h-14 shadow-glow hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      {loading ? (
                        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                      ) : (
                        <span className="tracking-tight uppercase font-black text-sm">Entrar no Sistema</span>
                      )}
                    </Button>
                    
                    <button
                      type="button"
                      onClick={() => setRecoverOpen(true)}
                      className="group flex w-full items-center justify-center py-2 text-xs font-black uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary"
                    >
                      <span>Esqueceu sua senha?</span>
                      <div className="ml-2 h-px w-0 bg-primary transition-all group-hover:w-8" />
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </main>

          <footer className="mt-12 text-center space-y-8">
            <div className="space-y-2">
              <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] leading-relaxed max-w-[300px] mx-auto">
                Acesso restrito e monitorado • Sistema de Gestão Esportiva
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/30 border border-border/50 text-[9px] font-mono text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-success opacity-50" />
                BUILD v{APP_VERSION}
              </div>
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-tighter">Powered by</span>
              <div className="opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all cursor-help flex items-center gap-3">
                <span className="text-xs font-black text-foreground tracking-tighter">JER GESTÃO</span>
                <div className="w-px h-4 bg-border" />
                <span className="text-[10px] font-bold text-foreground">GOVERNO DE RORAIMA</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
        </div>
      </div>

      <Dialog open={recoverOpen} onOpenChange={(open) => { if (!open) closeRecover(); }}>
        <DialogContent className="max-w-[calc(100vw-1.5rem)] rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Recuperar senha</DialogTitle>
          </DialogHeader>

          {recoverSent ? (
            <div className="space-y-4 py-2 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Enviamos as instruções para o seu e-mail. Verifique também o spam.
              </p>
              <Button variant="outline" className="h-11 w-full rounded-xl" onClick={closeRecover}>
                Fechar
              </Button>
            </div>
          ) : (
            <form onSubmit={handleRecover} className="space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Você receberá um link para criar uma nova senha.
              </p>
              <div className="space-y-2">
                <Label htmlFor="recover-email" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  E-mail
                </Label>
                <Input
                  id="recover-email"
                  type="email"
                  value={recoverEmail}
                  onChange={(e) => setRecoverEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                  className="h-12 rounded-xl"
                />
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" type="button" className="h-11 w-full rounded-xl sm:w-auto" onClick={closeRecover}>
                  Cancelar
                </Button>
                <Button type="submit" className="h-11 w-full rounded-xl sm:w-auto" disabled={recoverLoading}>
                  {recoverLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Enviar link
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
