import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast({
        title: "Erro ao entrar",
        description: error.message,
        variant: "destructive",
      });
    } else if (data.user) {
      // Check if user is active
      const { data: profile } = await supabase
        .from("profiles")
        .select("active")
        .eq("id", data.user.id)
        .single();

      if (profile && profile.active === false) {
        await supabase.auth.signOut();
        toast({
          title: "Conta desativada",
          description: "Sua conta está desativada. Entre em contato com o administrador.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      navigate("/admin");
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, rgba(11,43,90,0.06) 0%, rgba(15,90,166,0.06) 35%, rgba(11,163,163,0.04) 65%, rgba(51,178,73,0.04) 100%), hsl(var(--background))' }}>
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 text-center">
          <img
            src="/brand/logo.png"
            alt="JER's Gestão"
            className="mx-auto mb-4 h-20 object-contain dark:hidden"
          />
          <img
            src="/brand/logo-dark.png"
            alt="JER's Gestão"
            className="mx-auto mb-4 h-20 object-contain hidden dark:block"
          />
          <p className="mt-1 text-sm text-muted-foreground">
            Jogos Escolares de Roraima
          </p>
        </div>

        <Card className="shadow-app-lg">
          <CardHeader className="pb-2">
            <h2 className="font-heading text-base font-semibold text-card-foreground">Entrar no sistema</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-medium">E-mail</Label>
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
                <Label htmlFor="password" className="text-xs font-medium">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Entrar
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground/60">
          Sistema restrito a usuários autorizados
        </p>
      </div>
    </div>
  );
}
