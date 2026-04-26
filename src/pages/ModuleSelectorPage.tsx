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
    roles: ["super_admin"],
    label: "Super Admin",
    description: "Painel de controle mestre",
    icon: Shield,
    path: "/super",
    gradient: "from-[hsl(262,83%,58%)] to-[hsl(262,80%,40%)]",
  },
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
    roles: ["coordenacao_tecnica"],
    label: "Coord. Técnica",
    description: "Operação técnica PWA",
    icon: Clipboard,
    path: "/pwa/coordenacao",
    gradient: "from-[hsl(174,87%,34%)] to-[hsl(212,84%,36%)]",
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
    label: "Lançamento de Resultados",
    description: "PWA de Resultados",
    icon: ScanLine,
    path: "/pwa/resultados",
    gradient: "from-[hsl(214,78%,21%)] to-[hsl(212,84%,36%)]",
  },
  {
    roles: ["mesario", "arbitragem"],
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
  {
    roles: ["pesquisador", "coordenador_pesquisa"],
    label: "Pesquisa",
    description: "Coleta de dados em campo",
    icon: Search,
    path: "/pwa/pesquisa",
    gradient: "from-[hsl(25,95%,53%)] to-[hsl(15,90%,40%)]",
  },
  {
    roles: ["admin", "secretaria", "coordenacao_tecnica", "super_admin"],
    label: "Diagnóstico QR",
    description: "Verificar integridade de credenciais",
    icon: Search,
    path: "/pwa/diagnostico",
    gradient: "from-[hsl(174,87%,34%)] to-[hsl(212,84%,36%)]",
  },
];

export default function ModuleSelectorPage() {
  const navigate = useNavigate();
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

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

      // If super_admin or single role, redirect or allow selection
      const isSuperAdmin = roles.includes("super_admin");
      const available = isSuperAdmin ? MODULE_OPTIONS : MODULE_OPTIONS.filter(m => m.roles.some(r => roles.includes(r)));
      
      if (!isSuperAdmin && available.length <= 1) {
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

  const isSuperAdmin = userRoles.includes("super_admin");
  const availableModules = isSuperAdmin ? MODULE_OPTIONS : MODULE_OPTIONS.filter(m => m.roles.some(r => userRoles.includes(r)));
  const filteredModules = availableModules.filter(m => 
    m.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar função do sistema..."
            className="pl-9 h-11 bg-background/50 backdrop-blur-sm border-muted-foreground/20 focus-visible:ring-primary/30"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredModules.length > 0 ? (
            filteredModules.map((mod, idx) => (
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
            ))
          ) : (
            <div className="col-span-full py-8 text-center text-muted-foreground">
              Nenhuma função encontrada para "{searchTerm}"
            </div>
          )}
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
