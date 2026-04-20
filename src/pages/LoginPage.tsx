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
  coordenador_modalidade: "/admin",
  cde: "/admin",
  transporte: "/pwa/transporte",
  alimentacao: "/pwa/alimentacao",
  alojamento: "/pwa/alojamento",
  delegacao: "/pwa/delegacao",
  mesario: "/aovivo",
  arbitragem: "/aovivo",
  pesquisa: "/pwa/pesquisa/login",
};

const ADMIN_ROLES = ["admin", "super_admin", "secretaria", "coordenacao_tecnica", "coordenador_modalidade", "cde"];

function resolveRedirect(roles: string[]): string {
  // If any admin role → /admin
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
      className="flex min-h-screen items-center justify-center px-4"
      style={{
        background:
          "linear-gradient(135deg, rgba(11,43,90,0.06) 0%, rgba(15,90,166,0.06) 35%, rgba(11,163,163,0.04) 65%, rgba(51,178,73,0.04) 100%), hsl(var(--background))",
      }}
    >
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 text-center">
          <img
            src="/brand/logo.png"
            alt="JER Gestão"
            className="mx-auto mb-4 h-20 object-contain dark:hidden"
          />
          <img
            src="/brand/logo-dark.png"
            alt="JER Gestão"
            className="mx-auto mb-4 h-20 object-contain hidden dark:block"
          />
          <p className="mt-1 text-sm text-muted-foreground">
            Plataforma de Gestão do JERs
          </p>
        </div>

        <Card className="shadow-app-lg">
          <CardHeader className="pb-2">
            <h2 className="font-heading text-base font-semibold text-card-foreground">
              Acesse sua conta
            </h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-medium">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-medium">
                  Senha
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Entrar
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setRecoverOpen(true)}
                  className="text-sm text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  Esqueci minha senha
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground/60">
          Sistema restrito a usuários autorizados
        </p>
      </div>

      {/* Recovery Modal */}
      <Dialog open={recoverOpen} onOpenChange={closeRecover}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Recuperar senha</DialogTitle>
          </DialogHeader>

          {recoverSent ? (
            <div className="text-center space-y-3 py-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-7 w-7 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Email enviado! Verifique sua caixa de entrada para redefinir sua senha.
              </p>
              <Button variant="outline" onClick={closeRecover}>
                Fechar
              </Button>
            </div>
          ) : (
            <form onSubmit={handleRecover} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Você receberá um email com instruções para redefinir sua senha.
              </p>
              <div className="space-y-2">
                <Label htmlFor="recover-email">E-mail</Label>
                <Input
                  id="recover-email"
                  type="email"
                  value={recoverEmail}
                  onChange={(e) => setRecoverEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={closeRecover}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={recoverLoading}>
                  {recoverLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Enviar link de recuperação
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <p className="mt-6 text-center text-[11px] text-muted-foreground/50">
        Desenvolvido por{" "}
        <a
          href={brand.developer.website}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-muted-foreground transition-colors"
        >
          {brand.developer.name}
        </a>
      </p>
    </div>
  );
}
