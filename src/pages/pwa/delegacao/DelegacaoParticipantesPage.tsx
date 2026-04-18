import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ClipboardList, Search } from "lucide-react";

interface Participant {
  id: string;
  full_name: string;
  participant_type: string;
  status: string;
}

const TYPE_LABEL: Record<string, string> = {
  athlete: "Atleta",
  coach: "Técnico",
  head_of_delegation: "Chefe de Delegação",
  official: "Oficial",
  staff: "Staff",
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmado",
  pending: "Pendente",
  cancelled: "Cancelado",
  rejected: "Rejeitado",
};

export default function DelegacaoParticipantesPage() {
  const navigate = useNavigate();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/pwa/login", { replace: true }); return; }

      const { data: userDelegation } = await supabase
        .from("user_delegations")
        .select("delegation_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!userDelegation) { setLoading(false); return; }

      const { data } = await supabase
        .from("participants")
        .select("id, person:people(full_name), participant_type, status")
        .eq("delegation_id", userDelegation.delegation_id)
        .eq("is_active", true);

      const list: Participant[] = ((data as any) || []).map((p: any) => ({
        id: p.id,
        full_name: p.person?.full_name || "—",
        participant_type: p.participant_type,
        status: p.status,
      }));

      list.sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
      setParticipants(list);
      setLoading(false);
    })();
  }, [navigate]);

  const filtered = filter
    ? participants.filter(p => p.full_name.toLowerCase().includes(filter.toLowerCase()))
    : participants;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-2 border-b bg-card px-4 h-14">
        <button onClick={() => navigate("/pwa/delegacao")} className="text-muted-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <ClipboardList className="h-5 w-5 text-primary" />
        <span className="font-semibold text-foreground">Participantes</span>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={filter} onChange={(e) => setFilter(e.target.value)} className="pl-9" />
        </div>

        {loading && [1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}

        {!loading && participants.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma delegação vinculada ao seu perfil
          </div>
        )}

        {!loading && participants.length > 0 && filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">Nenhum participante encontrado</div>
        )}

        {filtered.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{p.full_name}</p>
                <p className="text-xs text-muted-foreground">{TYPE_LABEL[p.participant_type] || p.participant_type}</p>
              </div>
              <Badge variant={p.status === "confirmed" ? "default" : "secondary"}>
                {STATUS_LABEL[p.status] || p.status}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
