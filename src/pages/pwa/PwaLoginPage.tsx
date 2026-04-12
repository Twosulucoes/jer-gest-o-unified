import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { PwaBrandLogo } from "@/components/pwa/PwaBrandLogo";

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

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError("Email ou senha inválidos.");
      setLoading(false);
      return;
    }
    navigate("/pwa");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Brand header */}
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

      {/* Form */}
      <div className="flex flex-1 items-start justify-center px-4 pt-8">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-5">
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
      </div>
    </div>
  );
}
