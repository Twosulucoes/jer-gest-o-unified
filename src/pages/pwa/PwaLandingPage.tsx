import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, Bus, UtensilsCrossed, Trophy, Users, ClipboardCheck, Building } from "lucide-react";

interface UserProfile {
  full_name: string | null;
  active: boolean;
  roles: string[];
}

const MODULE_CARDS = [
  { role: "transporte", label: "Transporte", icon: Bus, to: "/pwa/transporte", color: "bg-blue-500/10 text-blue-600" },
  { role: "alimentacao", label: "Alimentação", icon: UtensilsCrossed, to: "/pwa/alimentacao", color: "bg-orange-500/10 text-orange-600" },
  { role: "alojamento", label: "Alojamento", icon: Building, to: "/pwa/alojamento", color: "bg-teal-500/10 text-teal-600" },
  { role: "coordenacao_tecnica", label: "Coord. Técnica", icon: Trophy, to: "/pwa/coordenacao-tecnica", color: "bg-green-500/10 text-green-600" },
  { role: "delegacao", label: "Delegação", icon: Users, to: "/pwa/delegacao", color: "bg-purple-500/10 text-purple-600" },
  { role: "pesquisa", label: "Pesquisa", icon: ClipboardCheck, to: "/pwa/pesquisa/login", color: "bg-pink-500/10 text-pink-600" },
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

      // Auto-redirect for single-role users
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
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">JER Gestão</h1>
            <p className="text-sm text-muted-foreground">
              Olá, {profile.full_name || "Usuário"}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Escolha um módulo
          </h2>
          <div className="grid gap-3">
            {visibleCards.map((card) => (
              <button
                key={card.role}
                onClick={() => navigate(card.to)}
                className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
              >
                <div className={`p-3 rounded-lg ${card.color}`}>
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
