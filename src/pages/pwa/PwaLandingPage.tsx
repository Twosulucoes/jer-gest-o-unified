import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, Bus, UtensilsCrossed, Trophy, Users, ClipboardCheck, Building } from "lucide-react";
import { PwaBrandLogo } from "@/components/pwa/PwaBrandLogo";

interface UserProfile {
  full_name: string | null;
  active: boolean;
  roles: string[];
}

const MODULE_CARDS = [
  { role: "transporte", label: "Transporte", icon: Bus, to: "/pwa/transporte", gradient: "from-[hsl(212,84%,36%)] to-[hsl(214,78%,21%)]" },
  { role: "alimentacao", label: "Alimentação", icon: UtensilsCrossed, to: "/pwa/alimentacao", gradient: "from-[hsl(174,87%,34%)] to-[hsl(212,84%,36%)]" },
  { role: "alojamento", label: "Alojamento", icon: Building, to: "/pwa/alojamento", gradient: "from-[hsl(133,55%,45%)] to-[hsl(174,87%,34%)]" },
  { role: "coordenacao_tecnica", label: "Coord. Técnica", icon: Trophy, to: "/pwa/coordenacao-tecnica", gradient: "from-[hsl(214,78%,21%)] to-[hsl(212,84%,36%)]" },
  { role: "delegacao", label: "Delegação", icon: Users, to: "/pwa/delegacao", gradient: "from-[hsl(174,87%,34%)] to-[hsl(133,55%,45%)]" },
  { role: "pesquisa", label: "Pesquisa", icon: ClipboardCheck, to: "/pwa/pesquisa/login", gradient: "from-[hsl(212,84%,36%)] to-[hsl(174,87%,34%)]" },
];

export default function PwaLandingPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/pwa/login", { replace: true });
        return;
      }

      const userId = session.user.id;
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("full_name, active").eq("id", userId).single(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);

      const roles = (rolesRes.data || []).map((r) => r.role as string);
      const prof: UserProfile = {
        full_name: profileRes.data?.full_name || null,
        active: profileRes.data?.active ?? true,
        roles,
      };
      setProfile(prof);

      if (!prof.active) {
        setLoading(false);
        return;
      }

      const isAdminOrSec = roles.some((r) => r === "admin" || r === "secretaria");
      if (!isAdminOrSec && roles.length === 1) {
        const card = MODULE_CARDS.find((c) => c.role === roles[0]);
        if (card) {
          navigate(card.to, { replace: true });
          return;
        }
      }
      setLoading(false);
    })();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/pwa/login", { replace: true });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (profile && !profile.active) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-sm">
          <h2 className="text-xl font-bold text-destructive">Acesso desativado</h2>
          <p className="text-muted-foreground">Sua conta foi desativada. Entre em contato com a administração.</p>
          <Button variant="outline" onClick={handleSignOut} className="h-12">
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const isAdminOrSec = profile.roles.some((r) => r === "admin" || r === "secretaria");
  const visibleCards = isAdminOrSec
    ? MODULE_CARDS
    : MODULE_CARDS.filter((c) => profile.roles.includes(c.role));

  return (
    <div className="min-h-screen bg-background">
      {/* Brand banner */}
      <div
        className="px-5 pt-6 pb-5"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(212 84% 36%) 40%, hsl(174 87% 34%) 70%, hsl(133 55% 45%) 100%)",
        }}
      >
        <div className="flex items-center justify-between max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <img src="/brand/symbol.png" alt="" className="h-10 w-10 rounded-lg shadow-lg" />
            <div>
              <h1 className="text-lg font-heading font-bold text-primary-foreground">JER's Gestão</h1>
              <p className="text-sm text-primary-foreground/70">
                Olá, {profile.full_name || "Usuário"}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Modules */}
      <div className="p-4 max-w-md mx-auto space-y-4 -mt-3">
        <div className="bg-card rounded-xl border shadow-app-md p-4 space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Módulos disponíveis
          </h2>
          <div className="grid gap-3">
            {visibleCards.map((card) => (
              <button
                key={card.role}
                onClick={() => navigate(card.to)}
                className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:shadow-app-md transition-all text-left active:scale-[0.98]"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient} text-white shadow-app-sm`}>
                  <card.icon className="h-6 w-6" />
                </div>
                <span className="text-base font-medium text-foreground">{card.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
