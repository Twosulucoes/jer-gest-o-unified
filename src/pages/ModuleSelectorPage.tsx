import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, UtensilsCrossed, Users, Clipboard, Shield, LogOut,
  LayoutDashboard, Bus, Bed, Trophy, ScanLine, IdCard, Search
} from "lucide-react";

interface ModuleOption {
  roles: string[];
  label: string;
  description: string;
  icon: React.ElementType;
  path: string;
  gradient: string;
}

const MODULE_OPTIONS: ModuleOption[] = [
  {
    roles: ["admin", "secretaria", "coordenacao_tecnica"],
    label: "Administração",
    description: "Gestão completa do evento",
    icon: LayoutDashboard,
    path: "/admin",
    gradient: "from-[hsl(214,78%,21%)] to-[hsl(212,84%,36%)]",
  },
  {
    roles: ["coordenador_modalidade"],
    label: "Coord. Modalidade",
    description: "Gestão da modalidade",
    icon: Trophy,
    path: "/admin/coordenador-modalidade",
    gradient: "from-[hsl(212,84%,36%)] to-[hsl(174,87%,34%)]",
  },
  {
    roles: ["transporte"],
    label: "Transporte",
    description: "Gerenciar embarques e viagens",
    icon: Bus,
    path: "/pwa/transporte",
    gradient: "from-[hsl(212,84%,36%)] to-[hsl(214,78%,21%)]",
  },
  {
    roles: ["alimentacao"],
    label: "Alimentação",
    description: "Registrar consumo de refeições",
    icon: UtensilsCrossed,
    path: "/pwa/alimentacao",
    gradient: "from-[hsl(174,87%,34%)] to-[hsl(212,84%,36%)]",
  },
  {
    roles: ["alojamento"],
    label: "Alojamento",
    description: "Gerenciar check-in e ocupação",
    icon: Bed,
    path: "/pwa/alojamento",
    gradient: "from-[hsl(133,55%,45%)] to-[hsl(174,87%,34%)]",
  },
  {
    roles: ["delegacao"],
    label: "Delegação",
    description: "Área da delegação",
    icon: Users,
    path: "/pwa/delegacao",
    gradient: "from-[hsl(174,87%,34%)] to-[hsl(133,55%,45%)]",
  },
  {
    roles: ["mesario"],
    label: "Ao Vivo",
    description: "Registro de partidas",
    icon: ScanLine,
    path: "/aovivo",
    gradient: "from-[hsl(214,78%,21%)] to-[hsl(212,84%,36%)]",
  },
  {
    roles: ["arbitragem"],
    label: "Arbitragem",
    description: "Painel de arbitragem",
    icon: Shield,
    path: "/aovivo",
    gradient: "from-[hsl(212,84%,36%)] to-[hsl(174,87%,34%)]",
  },
  {
    roles: ["cde"],
    label: "CDE",
    description: "Comissão disciplinar",
    icon: Clipboard,
    path: "/admin",
    gradient: "from-[hsl(0,72%,51%)] to-[hsl(214,78%,21%)]",
  },
  {
    roles: ["admin", "secretaria"],
    label: "Credenciamento",
    description: "Vincular credenciais via PWA",
    icon: IdCard,
    path: "/pwa/credenciamento",
    gradient: "from-[hsl(212,84%,36%)] to-[hsl(174,87%,34%)]",
  },
];

export default function ModuleSelectorPage() {
  const navigate = useNavigate();
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login", { replace: true });
        return;
      }

      const [rolesRes, profileRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", session.user.id),
        supabase.from("profiles").select("full_name").eq("id", session.user.id).single(),
      ]);

      const roles = (rolesRes.data || []).map(r => r.role as string);
      setUserRoles(roles);
      setUserName(profileRes.data?.full_name || session.user.email || "");

      // If single role, redirect directly
      const available = MODULE_OPTIONS.filter(m => m.roles.some(r => roles.includes(r)));
      if (available.length <= 1) {
        const target = available.length === 1 ? available[0].path : "/pwa";
        navigate(target, { replace: true });
        return;
      }

      setLoading(false);
    })();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const availableModules = MODULE_OPTIONS.filter(m => m.roles.some(r => userRoles.includes(r)));

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (availableModules.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-sm">
          <h2 className="text-xl font-bold text-destructive">Sem permissões</h2>
          <p className="text-muted-foreground">Seu usuário não tem permissões configuradas. Contate o administrador.</p>
          <Button variant="outline" onClick={handleSignOut} className="h-12">
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen px-4 py-8"
      style={{
        background:
          "linear-gradient(135deg, rgba(11,43,90,0.06) 0%, rgba(15,90,166,0.06) 35%, rgba(11,163,163,0.04) 65%, rgba(51,178,73,0.04) 100%), hsl(var(--background))",
      }}
    >
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <div className="text-center">
          <img src="/brand/logo.png" alt="JER Gestão" className="mx-auto mb-4 h-16 object-contain dark:hidden" />
          <img src="/brand/logo-dark.png" alt="JER Gestão" className="mx-auto mb-4 h-16 object-contain hidden dark:block" />
          <h1 className="font-heading text-xl font-bold text-foreground">Selecione o módulo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Olá, <span className="font-medium">{userName}</span>! Você tem acesso a múltiplos módulos. Escolha onde deseja trabalhar:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {availableModules.map((mod, idx) => (
            <Card
              key={`${mod.label}-${idx}`}
              className="cursor-pointer hover:shadow-app-md active:scale-[0.98] transition-all border-2 hover:border-primary/30"
              onClick={() => navigate(mod.path)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${mod.gradient} text-white shadow-app-sm shrink-0`}>
                  <mod.icon className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{mod.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{mod.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center pt-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-1" /> Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
