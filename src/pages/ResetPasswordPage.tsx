import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, CheckCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    // The recovery link auto-logs the user in via the hash fragment
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setHasSession(!!session);
    };

    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setHasSession(true);
      }
    });

    checkSession();
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError("Erro ao redefinir senha. Tente novamente.");
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
    toast.success("Senha redefinida com sucesso!");
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm text-center space-y-4 animate-fade-in">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-heading font-bold">Senha redefinida!</h2>
          <p className="text-sm text-muted-foreground">Sua senha foi alterada com sucesso.</p>
          <Button onClick={() => navigate("/login", { replace: true })} className="w-full">
            Voltar ao login
          </Button>
        </div>
      </div>
    );
  }

  if (hasSession === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <p className="text-muted-foreground">Link inválido ou expirado.</p>
          <Button variant="outline" onClick={() => navigate("/login", { replace: true })}>
            Voltar ao login
          </Button>
        </div>
      </div>
    );
  }

  if (hasSession === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
          <img src="/brand/logo.png" alt="JER Gestão" className="mx-auto mb-4 h-16 object-contain dark:hidden" />
          <img src="/brand/logo-dark.png" alt="JER Gestão" className="mx-auto mb-4 h-16 object-contain hidden dark:block" />
        </div>

        <Card className="shadow-app-lg">
          <CardHeader className="pb-2">
            <h2 className="font-heading text-base font-semibold text-card-foreground">Redefinir senha</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-xs font-medium">Nova senha</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="Mínimo 6 caracteres"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-xs font-medium">Confirmar senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Repita a nova senha"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Redefinir senha
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
