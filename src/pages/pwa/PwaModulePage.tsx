import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Bus, UtensilsCrossed, Trophy, Users, Building, IdCard } from "lucide-react";
import { PwaHeader } from "@/components/pwa/PwaHeader";

const MODULE_CONFIG: Record<string, { label: string; icon: React.ElementType; allowedRoles: string[]; features: string[] }> = {
  transporte: {
    label: "Transporte",
    icon: Bus,
    allowedRoles: ["admin", "secretaria", "transporte"],
    features: ["Embarque de passageiros", "Validação de credencial", "Controle de viagens"],
  },
  alimentacao: {
    label: "Alimentação",
    icon: UtensilsCrossed,
    allowedRoles: ["admin", "secretaria", "alimentacao"],
    features: ["Registro de consumo", "Validação de credencial", "Controle de janelas"],
  },
  alojamento: {
    label: "Alojamento",
    icon: Building,
    allowedRoles: ["admin", "secretaria", "alojamento"],
    features: ["Check-in/out", "Controle de leitos", "Ocorrências", "QR Code"],
  },
  "coordenacao-tecnica": {
    label: "Coordenação Técnica",
    icon: Trophy,
    allowedRoles: ["admin", "secretaria", "coordenacao_tecnica"],
    features: ["Lançamento de resultados", "Súmulas e relatórios", "Controle de partidas"],
  },
  delegacao: {
    label: "Delegação",
    icon: Users,
    allowedRoles: ["admin", "secretaria", "delegacao"],
    features: ["Meus participantes", "Agenda de competição", "Informações logísticas"],
  },
  credenciamento: {
    label: "Credenciamento",
    icon: IdCard,
    allowedRoles: ["admin", "secretaria"],
    features: ["Vincular credencial física", "Busca de participantes", "Status de ativação"],
  },
};

export default function PwaModulePage() {
  const navigate = useNavigate();
  const { module } = useParams<{ module: string }>();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const config = module ? MODULE_CONFIG[module] : null;

  useEffect(() => {
    (async () => {
      if (!config) {
        navigate("/pwa", { replace: true });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/pwa/login", { replace: true });
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("active")
        .eq("id", session.user.id)
        .single();

      if (!profileData?.active) {
        navigate("/pwa", { replace: true });
        return;
      }

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      const userRoles = (rolesData || []).map((r) => r.role as string);
      const hasAccess = config.allowedRoles.some((r) => userRoles.includes(r));

      if (!hasAccess) {
        navigate("/pwa", { replace: true });
        return;
      }

      setAuthorized(true);
      setLoading(false);
    })();
  }, [config, navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/pwa/login", { replace: true });
  };

  if (loading || !config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authorized) return null;

  const Icon = config.icon;

  return (
    <div className="tactical-cockpit min-h-screen bg-background">
      <PwaHeader title={config.label} icon={Icon} backTo="/pwa" onSignOut={handleSignOut} />

      <main className="p-4 max-w-md mx-auto space-y-6">
        <div className="rounded-xl border bg-card p-6 text-center space-y-3 shadow-app-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {Icon && <Icon className="h-8 w-8" />}
          </div>
          <h2 className="text-lg font-heading font-bold">Em breve</h2>
          <p className="text-sm text-muted-foreground">
            O módulo de {config.label} está sendo desenvolvido. Em breve estará disponível aqui.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Funcionalidades previstas
          </h3>
          <ul className="space-y-2">
            {config.features.map((feat) => (
              <li key={feat} className="flex items-center gap-2 p-3 rounded-xl border bg-card shadow-app-sm">
                <span className="text-sm text-foreground">{feat}</span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}