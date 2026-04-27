import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
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
  // If only coordenador_modalidade, redirect to their dashboard
  if (roles.includes("coordenador_modalidade") && roles.length === 1) {
    return "/admin/coordenador-modalidade";
  }

  // If any other admin role → /admin
  if (roles.some(r => ADMIN_ROLES.includes(r))) return "/admin";

  // Single operational role → direct
  const opRoles = roles.filter(r => ROLE_REDIRECT_MAP[r]);
  if (opRoles.length === 1) return ROLE_REDIRECT_MAP[opRoles[0]];

  // Multiple operational roles → module selector
  if (opRoles.length > 1) return "/selecionar-modulo";

  return "/pwa";
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

  useEffect(() => {
    if (!authLoading && currentUser && currentRoles.length > 0) {
      const target = resolveRedirect(currentRoles);
      navigate(target, { replace: true });
    }
  }, [authLoading, currentUser, currentRoles, navigate]);

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
      navigate(target, { replace: true });
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
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#0B1220] selection:bg-primary/30 selection:text-white">
      {/* Dynamic Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-20"
          style={{ background: brand.colors.accentBlue }}
        />
        <div 
          className="absolute -bottom-[10%] -right-[10%] w-[45%] h-[45%] rounded-full blur-[120px] opacity-15"
          style={{ background: brand.colors.accentTeal }}
        />
        <div 
          className="absolute top-[20%] right-[5%] w-[30%] h-[30%] rounded-full blur-[100px] opacity-10"
          style={{ background: brand.colors.accentGreen }}
        />
        <div className="absolute inset-0 bg-grid opacity-[0.03]" />
      </div>

      <div className="relative z-10 flex min-h-[100dvh] flex-col px-6">
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12 animate-in fade-in zoom-in-95 duration-700">
          
          {/* Brand Header */}
          <header className="mb-10 text-center space-y-6">
            <div className="inline-flex items-center justify-center p-4 rounded-[2rem] bg-white/5 backdrop-blur-xl ring-1 ring-white/10 shadow-2xl">
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
              <p className="text-sm font-medium text-slate-400 max-w-[280px] mx-auto leading-relaxed">
                Entre com as credenciais da sua instituição para acessar a plataforma.
              </p>
            </div>
          </header>

          {/* Login Card */}
          <main className="relative group">
            {/* Card Glow Effect */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary via-accentTeal to-accentGreen rounded-3xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
            
            <Card className="relative glass-panel-strong border-0 shadow-2xl rounded-3xl overflow-hidden">
              <CardContent className="p-8 sm:p-10">
                <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-2.5">
                    <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 ml-1">
                      Identificação
                    </Label>
                    <div className="relative">
                      <Input
                        id="email"
                        type="email"
                        inputMode="email"
                        placeholder="nome@instituicao.gov.br"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-14 rounded-2xl border-white/10 bg-white/5 px-5 text-white placeholder:text-slate-500 focus:ring-primary/50 focus:border-primary/50 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between ml-1">
                      <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                        Senha de Acesso
                      </Label>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-14 rounded-2xl border-white/10 bg-white/5 px-5 text-white placeholder:text-slate-500 focus:ring-primary/50 focus:border-primary/50 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-0 top-0 flex h-14 w-14 items-center justify-center text-slate-400 hover:text-white transition-colors"
                        tabIndex={-1}
                      >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  <ul className="ml-1 mt-2 space-y-1 text-[11px] text-slate-500">
                    <li className="flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-slate-500" />
                      Mínimo de 8 caracteres
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-slate-500" />
                      Uma letra maiúscula e uma minúscula
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-slate-500" />
                      Um número e um caractere especial
                    </li>
                  </ul>
                  </div>

                  {error && (
                    <div className="animate-in fade-in slide-in-from-top-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                      {error}
                    </div>
                  )}

                  <div className="space-y-4 pt-2">
                    <Button
                      type="submit"
                      disabled={loading}
                      className="h-14 w-full rounded-2xl bg-primary text-white font-bold text-lg shadow-[0_8px_30px_rgb(var(--primary-rgb),0.3)] hover:shadow-[0_8px_30px_rgb(var(--primary-rgb),0.5)] transition-all active:scale-[0.98] btn-shine"
                      style={{ background: brand.gradients.brandGradient }}
                    >
                      {loading ? (
                        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                      ) : (
                        "Acessar Plataforma JER"
                      )}
                    </Button>
                    
                    <button
                      type="button"
                      onClick={() => setRecoverOpen(true)}
                      className="group flex w-full items-center justify-center py-2 text-sm font-semibold text-slate-400 transition-colors hover:text-white"
                    >
                      <span>Esqueceu sua senha?</span>
                      <div className="ml-2 h-px w-0 bg-white transition-all group-hover:w-8" />
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </main>

          {/* Footer Info */}
          <footer className="mt-12 text-center space-y-6">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest leading-relaxed max-w-[300px] mx-auto">
                Acesso restrito e monitorado • Sistema de Gestão Esportiva
              </p>
              <p className="text-[9px] text-slate-600/50 font-mono">
                v{APP_VERSION}
              </p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">Desenvolvido por</span>
              <a
                href={brand.developer.website}
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-50 hover:opacity-100 transition-opacity"
              >
                <img src="/brand/logo.png" alt="Two Soluções" className="h-6 grayscale invert" />
              </a>
            </div>
          </footer>
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
