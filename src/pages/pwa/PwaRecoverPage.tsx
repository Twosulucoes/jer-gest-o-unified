import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, CheckCircle } from "lucide-react";

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
          <CheckCircle className="h-12 w-12 text-primary mx-auto" />
          <h2 className="text-xl font-bold">Email enviado!</h2>
          <p className="text-muted-foreground">Verifique sua caixa de entrada para redefinir sua senha.</p>
          <Button variant="outline" onClick={() => navigate("/pwa/login")} className="h-12">
            Voltar ao login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <button onClick={() => navigate("/pwa/login")} className="flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recuperar senha</h1>
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
  );
}
