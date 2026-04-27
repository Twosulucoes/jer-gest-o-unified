import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, Bus, UtensilsCrossed, Trophy, Users, ClipboardCheck, Building, Gavel, Shield, Layers, IdCard, Download, Calendar } from "lucide-react";
import { useEventContext } from "@/contexts/EventContext";
import { useStageContext } from "@/contexts/StageContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VersionBadge } from "@/components/VersionBadge";
import { PwaRefreshButton } from "@/components/pwa/PwaRefreshButton";

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
  { role: "secretaria", label: "Credenciamento", icon: IdCard, to: "/pwa/credenciamento", gradient: "from-[hsl(212,84%,36%)] to-[hsl(174,87%,34%)]" },
  { role: "mesario", label: "Mesário", icon: Gavel, to: "/aovivo", gradient: "from-[hsl(25,95%,45%)] to-[hsl(14,89%,36%)]" },
  { role: "arbitragem", label: "Arbitragem", icon: Shield, to: "/aovivo", gradient: "from-[hsl(14,89%,36%)] to-[hsl(25,95%,45%)]" },
  { role: "pesquisa", label: "Pesquisa", icon: ClipboardCheck, to: "/pwa/pesquisa/login", gradient: "from-[hsl(212,84%,36%)] to-[hsl(174,87%,34%)]" },
];

export default function PwaLandingPage() {
  const navigate = useNavigate();
  const { events, activeEventId, setActiveEventId } = useEventContext();
  const { stages, activeStageId, setActiveStageId } = useStageContext();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login", { replace: true });
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

      const opCards = MODULE_CARDS.filter((c) => roles.includes(c.role) || (c.role === "secretaria" && roles.includes("admin")));
      
      if (opCards.length === 1 && !roles.includes("admin") && !roles.includes("secretaria") && activeEventId && activeStageId) {
        navigate(opCards[0].to, { replace: true });
        return;
      }

      setLoading(false);
    })();
  }, [navigate, activeStageId]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
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

  const visibleCards = MODULE_CARDS.filter((c) => 
    profile.roles.includes(c.role) || (c.role === "secretaria" && profile.roles.includes("admin"))
  );

  return (
    <div className="tactical-cockpit min-h-screen bg-background">
      <div
        className="px-5 pt-10 pb-12"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(212 84% 36%) 40%, hsl(174 87% 34%) 70%, hsl(133 55% 45%) 100%)",
        }}
      >
        <div className="flex items-center justify-between max-w-md mx-auto">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg border border-white/30">
              <img src="/brand/monogram.png" alt="" className="h-10 w-10 object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-heading font-extrabold text-white tracking-tight">JER's Gestão</h1>
              <p className="text-sm text-white/80 font-medium">
                Olá, {profile.full_name?.split(' ')[0] || "Usuário"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PwaRefreshButton />
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="h-11 w-11 text-white/80 hover:text-white hover:bg-white/10 rounded-full">
              <LogOut className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto space-y-5 -mt-8">
        {/* Configuração de Contexto (Evento e Etapa) */}
        <div className="bg-card/95 backdrop-blur-sm rounded-3xl border border-white/20 shadow-xl p-5 space-y-4">
          <div className="space-y-4">
            {/* Seletor de Evento */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Calendar className="h-4 w-4" />
                </div>
                <h2 className="text-[10px] font-bold text-foreground uppercase tracking-widest">
                  Evento
                </h2>
              </div>
              <Select value={activeEventId || ""} onValueChange={setActiveEventId}>
                <SelectTrigger className="h-12 rounded-2xl border-muted-foreground/10 bg-background/50 focus:ring-primary/20">
                  <SelectValue placeholder="Selecione o evento..." />
                </SelectTrigger>
                <SelectContent>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Seletor de Etapa */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Layers className="h-4 w-4" />
                </div>
                <h2 className="text-[10px] font-bold text-foreground uppercase tracking-widest">
                  Etapa de Trabalho
                </h2>
              </div>
              <Select 
                value={activeStageId || ""} 
                onValueChange={setActiveStageId}
                disabled={!activeEventId || stages.length === 0}
              >
                <SelectTrigger className="h-12 rounded-2xl border-muted-foreground/10 bg-background/50 focus:ring-primary/20">
                  <SelectValue placeholder={!activeEventId ? "Selecione um evento" : "Selecione a etapa..."} />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!activeStageId && activeEventId && stages.length > 0 && (
                <div className="flex items-center gap-2 px-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-tight">
                    Selecione uma etapa para operar
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-card rounded-3xl border shadow-app-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">
              Seus módulos
            </h2>
            <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-bold text-muted-foreground">
              {visibleCards.length} DISPONÍVEIS
            </span>
          </div>
          
          {visibleCards.length === 0 ? (
            <div className="text-center py-10 space-y-3 bg-muted/30 rounded-2xl border border-dashed">
              <Shield className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                Nenhum módulo atribuído.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {visibleCards.map((card) => (
                <button
                  key={card.role}
                  onClick={() => navigate(card.to)}
                  className="group relative flex items-center gap-4 p-4 rounded-2xl border bg-card hover:bg-muted/5 hover:border-primary/30 transition-all text-left active:scale-[0.98] shadow-sm hover:shadow-md"
                >
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${card.gradient} text-white shadow-lg group-hover:scale-110 transition-transform`}>
                    <card.icon className="h-7 w-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-lg font-bold text-foreground block tracking-tight">{card.label}</span>
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-tighter opacity-70 group-hover:opacity-100 transition-opacity">Acessar painel operacional</span>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <Layers className="h-4 w-4" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="text-center pt-2 space-y-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate("/pwa/install")}
              className="rounded-full border-primary/20 text-primary hover:bg-primary/5"
            >
              <Download className="h-4 w-4 mr-2" /> Instruções de Instalação
            </Button>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest opacity-40">
                JER Gestão Operacional • PWA v2.0
            </p>
        </div>
      </div>
      <VersionBadge />
    </div>
  );
}
