import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useAoVivoManifest } from "./useAoVivoManifest";

export default function AoVivoLoginPage() {
  useAoVivoManifest();
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
    navigate("/aovivo");
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-950 text-white">
      <div className="flex flex-col items-center justify-center px-6 pt-16 pb-8">
        <div className="flex items-center gap-3 mb-2">
          <img src="/pwa/icon-192.png" alt="JER" className="h-14 w-14 rounded-xl" />
          <h1 className="text-2xl font-bold tracking-tight">JER Ao Vivo</h1>
        </div>
        <p className="text-slate-400 text-sm">Registro de partidas em tempo real</p>
      </div>

      <div className="flex flex-1 items-start justify-center px-6 pt-6">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-800 bg-slate-900/95 p-5 shadow-[0_16px_30px_-18px_rgba(0,0,0,0.75)]">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-slate-300">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full h-12 rounded-lg bg-slate-800 border border-slate-700 px-4 text-base text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-slate-300">Senha</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full h-12 rounded-lg bg-slate-800 border border-slate-700 px-4 text-base text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base transition-colors disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
