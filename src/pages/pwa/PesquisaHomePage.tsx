import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSession, clearSession } from '@/lib/pesquisaSession';
import { usePesquisaSync } from '@/hooks/usePesquisaSync';
import OfflineBadge from '@/components/pesquisa/OfflineBadge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, LogOut, User, ClipboardCheck } from 'lucide-react';
import { PwaHeader } from '@/components/pwa/PwaHeader';
import { PwaContainer } from '@/components/pwa/PwaScreen';
import { usePwaAudit } from '@/hooks/usePwaAudit';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HomeData {
  researcher_name: string;
  event: { id: string; name: string; location: string | null; event_date: string | null };
  today_count: number;
  recent: Array<{ respondent_type: string; collected_at: string }> | null;
}

const typeLabels: Record<string, string> = {
  atleta: 'Atleta',
  familiar: 'Familiar',
  professor: 'Professor',
  tecnico: 'Técnico',
  outro: 'Outro',
};

export default function PesquisaHomePage() {
  const navigate = useNavigate();
  const { isOnline, pendingCount } = usePesquisaSync();
  const [homeData, setHomeData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);

  const session = getSession();

  const loadHome = useCallback(async () => {
    if (!session) { navigate('/pwa/pesquisa/login', { replace: true }); return; }
    try {
      const { data, error } = await supabase.rpc('pesquisa_pwa_get_home', {
        p_session_id: session.session_id,
      });
      if (error) throw error;
      const result = data as any;
      if (result?.error === 'SESSION_INVALID') {
        clearSession();
        navigate('/pwa/pesquisa/login', { replace: true });
        return;
      }
      setHomeData(result);
    } catch {
      // Use cached session data if offline
      if (session) {
        setHomeData({
          researcher_name: session.researcher.name,
          event: session.event,
          today_count: 0,
          recent: null,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [session, navigate]);

  useEffect(() => { loadHome(); }, []);

  const handleLogout = async () => {
    if (session) {
      try { await supabase.rpc('pesquisa_revoke_session', { p_session_id: session.session_id }); } catch {}
    }
    clearSession();
    navigate('/pwa/pesquisa/login', { replace: true });
  };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-background p-4 max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Olá, {homeData?.researcher_name || session.researcher.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {homeData?.event?.name || session.event.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <OfflineBadge isOnline={isOnline} pendingCount={pendingCount} />
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <Card className="p-6 text-center">
        <p className="text-4xl font-bold text-primary">{loading ? '...' : homeData?.today_count ?? 0}</p>
        <p className="text-sm text-muted-foreground mt-1">Coletas hoje</p>
      </Card>

      {/* Action */}
      <Button
        onClick={() => navigate('/pwa/pesquisa/nova')}
        className="w-full h-14 text-lg gap-2"
      >
        <Plus className="h-5 w-5" /> Nova Coleta
      </Button>

      {/* Recent */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Últimas coletas</h2>
        {homeData?.recent && homeData.recent.length > 0 ? (
          <div className="space-y-2">
            {homeData.recent.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 bg-card rounded-lg border">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{typeLabels[item.respondent_type] || item.respondent_type}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(item.collected_at), "HH:mm", { locale: ptBR })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          !loading && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma coleta ainda</p>
        )}
      </div>
    </div>
  );
}
