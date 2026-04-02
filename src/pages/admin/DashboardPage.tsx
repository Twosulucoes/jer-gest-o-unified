import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Calendar, Dumbbell, ListTree, MapPin } from "lucide-react";

export default function DashboardPage() {
  const { profile, roles } = useAuth();

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: "Administrador",
      secretaria: "Secretaria",
      transporte: "Transporte",
      alimentacao: "Alimentação",
      coordenacao_tecnica: "Coordenação Técnica",
      delegacao: "Delegação",
    };
    return labels[role] || role;
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Bem-vindo, {profile?.full_name || "Usuário"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Perfil: {roles.map(getRoleLabel).join(", ") || "Sem perfil atribuído"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Eventos", icon: Calendar, color: "text-primary" },
          { label: "Modalidades", icon: Dumbbell, color: "text-info" },
          { label: "Categorias", icon: ListTree, color: "text-accent" },
          { label: "Locais", icon: MapPin, color: "text-destructive" },
        ].map(({ label, icon: Icon, color }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">{label}</span>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-card-foreground">—</p>
              <p className="text-xs text-muted-foreground mt-1">Disponível em breve</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
