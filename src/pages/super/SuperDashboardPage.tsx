import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppKPI } from "@/components/app/AppKPI";
import { Calendar, Users, UserCheck, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function SuperDashboardPage() {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["super-dashboard-stats"],
    queryFn: async () => {
      const [eventsRes, participantsRes, usersRes, auditRes] = await Promise.all([
        supabase.from("events").select("id, status", { count: "exact" }),
        supabase.from("participants").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("audit_events").select("created_at").order("created_at", { ascending: false }).limit(1),
      ]);

      const activeEvents = eventsRes.data?.filter((e) => e.status === "active").length ?? 0;
      const totalEvents = eventsRes.count ?? 0;

      return {
        activeEvents,
        totalEvents,
        totalParticipants: participantsRes.count ?? 0,
        totalUsers: usersRes.count ?? 0,
        lastActivity: auditRes.data?.[0]?.created_at ?? null,
      };
    },
  });

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Super Admin</h1>
        <p className="text-sm text-zinc-400 mt-1">Visão global de todos os eventos e clientes.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div onClick={() => navigate("/super/eventos")} className="cursor-pointer">
          <AppKPI
            label="Eventos Ativos"
            value={stats?.activeEvents ?? 0}
            icon={Calendar}
            sub={`${stats?.totalEvents ?? 0} total`}
            loading={isLoading}
            className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-100 [&_p]:text-zinc-400 [&_.text-primary]:text-amber-400 [&_.bg-primary\\/10]:bg-amber-500/10"
          />
        </div>
        <AppKPI
          label="Participantes"
          value={stats?.totalParticipants ?? 0}
          icon={Users}
          loading={isLoading}
          className="bg-zinc-900 border-zinc-800 text-zinc-100 [&_p]:text-zinc-400 [&_.text-primary]:text-amber-400 [&_.bg-primary\\/10]:bg-amber-500/10"
        />
        <AppKPI
          label="Usuários"
          value={stats?.totalUsers ?? 0}
          icon={UserCheck}
          loading={isLoading}
          className="bg-zinc-900 border-zinc-800 text-zinc-100 [&_p]:text-zinc-400 [&_.text-primary]:text-amber-400 [&_.bg-primary\\/10]:bg-amber-500/10"
        />
        <AppKPI
          label="Última Atividade"
          value={formatDate(stats?.lastActivity ?? null)}
          icon={Activity}
          loading={isLoading}
          className="bg-zinc-900 border-zinc-800 text-zinc-100 [&_p]:text-zinc-400 [&_.text-primary]:text-amber-400 [&_.bg-primary\\/10]:bg-amber-500/10"
        />
      </div>
    </div>
  );
}
