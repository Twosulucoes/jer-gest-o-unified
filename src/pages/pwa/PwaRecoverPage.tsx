import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { PwaBrandLogo } from "@/components/pwa/PwaBrandLogo";

export default function PwaRecoverPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/pwa/set-password`,
    });
    if (resetError) {
      setError("Erro ao enviar email de recuperação.");
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-success" />
          </div>
          <h2 className="text-xl font-heading font-bold">Email enviado!</h2>
          <p className="text-muted-foreground">Verifique sua caixa de entrada para redefinir sua senha.</p>
          <Button variant="outline" onClick={() => navigate("/pwa/login")} className="h-12">
            Voltar ao login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div
        className="flex flex-col items-center justify-center px-6 pt-10 pb-6"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(212 84% 36%) 40%, hsl(174 87% 34%) 70%, hsl(133 55% 45%) 100%)",
        }}
      >
        <PwaBrandLogo size="md" className="drop-shadow-lg brightness-0 invert" />
      </div>

      <div className="flex flex-1 items-start justify-center px-4 pt-6">
        <div className="w-full max-w-sm space-y-6">
          <button onClick={() => navigate("/pwa/login")} className="flex items-center gap-1 text-sm text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Recuperar senha</h1>
            <p className="text-sm text-muted-foreground mt-1">Informe seu email para receber o link de redefinição.</p>
          </div>
          <form onSubmit={handleRecover} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12 text-base" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Enviar link"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
