import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Truck, UtensilsCrossed, Building, Users, Clipboard, Shield, LogOut } from "lucide-react";

interface ModuleOption {
  role: string;
  label: string;
  description: string;
  icon: React.ElementType;
  path: string;
}

const MODULE_OPTIONS: ModuleOption[] = [
  { role: "admin", label: "Administração", description: "Painel administrativo completo", icon: Shield, path: "/admin" },
  { role: "secretaria", label: "Secretaria", description: "Gestão administrativa", icon: Shield, path: "/admin" },
  { role: "coordenacao_tecnica", label: "Coord. Técnica", description: "Coordenação de modalidades", icon: Clipboard, path: "/admin" },
  { role: "coordenador_modalidade", label: "Coord. Modalidade", description: "Gestão da modalidade", icon: Clipboard, path: "/admin" },
  { role: "cde", label: "CDE", description: "Comissão disciplinar", icon: Shield, path: "/admin" },
  { role: "transporte", label: "Transporte", description: "Embarque e viagens", icon: Truck, path: "/pwa/transporte" },
  { role: "alimentacao", label: "Alimentação", description: "Registro de refeições", icon: UtensilsCrossed, path: "/pwa/alimentacao" },
  { role: "alojamento", label: "Alojamento", description: "Check-in e hospedagem", icon: Building, path: "/pwa/alojamento" },
  { role: "delegacao", label: "Delegação", description: "Gestão da delegação", icon: Users, path: "/pwa/delegacao" },
  { role: "mesario", label: "Ao Vivo", description: "Registro de partidas", icon: Clipboard, path: "/aovivo" },
  { role: "arbitragem", label: "Arbitragem", description: "Painel de arbitragem", icon: Clipboard, path: "/aovivo" },
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
      if (roles.length <= 1) {
        const target = roles.length === 1
          ? (MODULE_OPTIONS.find(m => m.role === roles[0])?.path || "/pwa")
          : "/pwa";
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

  const availableModules = MODULE_OPTIONS.filter(m => userRoles.includes(m.role));

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
      <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
        <div className="text-center">
          <img src="/brand/logo.png" alt="JER's Gestão" className="mx-auto mb-4 h-16 object-contain dark:hidden" />
          <img src="/brand/logo-dark.png" alt="JER's Gestão" className="mx-auto mb-4 h-16 object-contain hidden dark:block" />
          <h1 className="font-heading text-xl font-bold text-foreground">Selecionar módulo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Olá, <span className="font-medium">{userName}</span>! Escolha o módulo que deseja acessar.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {availableModules.map((mod) => (
            <Card
              key={mod.role}
              className="cursor-pointer hover:shadow-app-md active:scale-[0.98] transition-all border-2 hover:border-primary/30"
              onClick={() => navigate(mod.path)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                  <mod.icon className="h-5 w-5" />
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
