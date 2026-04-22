import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, CheckCircle } from "lucide-react";
import { brand } from "@/theme/brand";

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
    <div
      className="relative flex min-h-[100dvh] flex-col overflow-hidden"
      style={{
        background:
          "linear-gradient(165deg, rgba(11,43,90,0.07) 0%, rgba(15,90,166,0.05) 40%, rgba(11,163,163,0.04) 72%, rgba(51,178,73,0.03) 100%), hsl(var(--background))",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.05] dark:opacity-[0.08]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,hsla(222,72%,36%,0.14),transparent_50%)] dark:bg-[radial-gradient(ellipse_120%_80%_at_50%_-15%,hsla(41,100%,47%,0.12),transparent_52%)]" />

      <div className="relative z-10 flex min-h-[100dvh] flex-1 flex-col px-5 sm:px-6">
        <div
          className="mx-auto flex w-full max-w-[380px] flex-1 flex-col pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] animate-fade-in"
        >
          {/* Topo: só a marca — sem caixa nem repetir o nome */}
          <header className="shrink-0 pb-5 text-center sm:pb-6">
            <h1 className="sr-only">JER Gestão</h1>
            <div className="mx-auto flex max-w-[320px] justify-center sm:max-w-[400px]">
              <img
                src="/brand/logo.png"
                alt="JER Gestão"
                className="h-32 w-auto max-w-full object-contain object-center dark:hidden sm:h-40"
              />
              <img
                src="/brand/logo-dark.png"
                alt="JER Gestão"
                className="hidden h-32 w-auto max-w-full object-contain object-center dark:block sm:h-40"
              />
            </div>
            <p className="mx-auto mt-4 max-w-[320px] text-base leading-snug text-muted-foreground/90 font-medium">
              Entre com o e-mail e a senha da sua instituição.
            </p>
          </header>

          {/* Formulário: corpo principal */}
          <main className="flex min-h-0 flex-1 flex-col justify-center py-2">
            <Card className="border-0 bg-card/95 shadow-app-xl ring-1 ring-border/50 backdrop-blur-md dark:bg-card/90 dark:ring-border/40 sm:rounded-2xl sm:border sm:border-border/70">
              <CardHeader className="px-5 pb-0 pt-5 sm:px-6 sm:pt-6">
                <h2 className="font-heading text-lg font-semibold tracking-tight text-card-foreground">
                  Entrar
                </h2>
              </CardHeader>
              <CardContent className="px-5 pb-6 pt-5 sm:px-6 sm:pb-7 sm:pt-6">
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      E-mail
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      inputMode="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      placeholder="nome@instituicao.gov.br"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      className="h-12 rounded-xl border-border/80 bg-background/80 text-base shadow-none dark:bg-background/40 sm:h-11 sm:text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Senha
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Sua senha"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        className="h-12 rounded-xl border-border/80 bg-background/80 pr-11 text-base shadow-none dark:bg-background/40 sm:h-11 sm:text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-0 top-0 flex h-12 w-11 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground active:bg-muted/50 sm:h-11"
                        tabIndex={-1}
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  {error ? (
                    <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                      {error}
                    </div>
                  ) : null}

                  <div className="space-y-3 pt-1">
                    <Button
                      type="submit"
                      size="lg"
                      className="h-14 w-full rounded-2xl text-lg font-bold shadow-app-md sm:h-12 sm:text-base transition-all active:scale-[0.98]"
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : null}
                      Entrar
                    </Button>
                    <button
                      type="button"
                      onClick={() => setRecoverOpen(true)}
                      className="flex w-full min-h-[44px] items-center justify-center rounded-xl text-sm font-medium text-primary transition-colors hover:bg-primary/5 hover:text-primary/90 active:bg-primary/10"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </main>

          {/* Rodapé: fixo no fim da viewport em telas curtas */}
          <footer className="mt-auto shrink-0 space-y-4 border-t border-border/40 pt-6 text-center dark:border-border/30">
            <p className="mx-auto max-w-[320px] text-[13px] leading-relaxed text-muted-foreground/85 font-medium">
              Acesso restrito a usuários autorizados pela secretaria ou coordenação do evento.
            </p>
            <p className="text-xs text-muted-foreground/60 font-medium pb-2">
              Desenvolvido por{" "}
              <a
                href={brand.developer.website}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-border/60 underline-offset-2 transition-colors hover:text-muted-foreground"
              >
                {brand.developer.name}
              </a>
            </p>
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
