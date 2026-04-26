import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { PwaSectionLabel } from "@/components/pwa/PwaDashboardPrimitives";
import { ClipboardList, Search } from "lucide-react";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import { cn } from "@/lib/utils";

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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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
    ? participants.filter((p) => p.full_name.toLowerCase().includes(filter.toLowerCase()))
    : participants;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />
      <PwaHeader title="Participantes" icon={ClipboardList} backTo="/pwa/delegacao" />

      <main className="relative max-w-md mx-auto space-y-4 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-11 border-border/80 bg-card/90 pl-10"
          />
        </div>

        <PwaSectionLabel>Atletas e comissão</PwaSectionLabel>

        {loading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-[72px] w-full rounded-2xl" />)}

        {!loading && participants.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">Nenhuma delegação vinculada ao seu perfil</div>
        )}

        {!loading && participants.length > 0 && filtered.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">Nenhum participante encontrado</div>
        )}

        <div className="space-y-2">
          {filtered.map((p) => {
            const ok = p.status === "confirmed";
            const pending = p.status === "pending";
            return (
              <Card key={p.id} className="border-border/80 bg-card/95 shadow-app-sm">
                <CardContent className="flex items-center gap-3 p-3">
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      ok && "bg-green-500/20 text-green-700 dark:text-green-400",
                      pending && "bg-amber-500/20 text-amber-800 dark:text-amber-400",
                      !ok && !pending && "bg-muted text-muted-foreground",
                    )}
                  >
                    {initials(p.full_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-sm text-foreground">{p.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{TYPE_LABEL[p.participant_type] || p.participant_type}</p>
                  </div>
                  <Badge
                    className={cn(
                      "shrink-0 rounded-full border-0 px-2.5 py-0.5 text-[11px] font-semibold",
                      ok && "bg-green-500/15 text-green-700 dark:text-green-400",
                      pending && "bg-red-500/15 text-red-600 dark:text-red-400",
                      !ok && !pending && "bg-muted text-muted-foreground",
                    )}
                  >
                    {ok ? "OK" : pending ? "Pendente" : p.status}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
