import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Plus, Home } from 'lucide-react';
import { useEffect } from 'react';

export default function PesquisaConfirmacaoPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { submitted?: boolean; isKiosk?: boolean } | null;

  // Auto-redirect kiosk mode after 3s
  useEffect(() => {
    if (state?.isKiosk) {
      const timer = setTimeout(() => navigate('/pwa/pesquisa/home', { replace: true }), 3000);
      return () => clearTimeout(timer);
    }
  }, [state, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-sm">
        <div className="mx-auto w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            {state?.submitted ? 'Resposta registrada!' : 'Salva para enviar depois'}
          </h1>
          <p className="text-muted-foreground">
            {state?.submitted
              ? 'Obrigado pela participação.'
              : 'A resposta será enviada automaticamente quando houver conexão.'}
          </p>
        </div>

        {!state?.isKiosk && (
          <div className="space-y-3">
            <Button onClick={() => navigate('/pwa/pesquisa/nova', { replace: true })} className="w-full h-12 gap-2">
              <Plus className="h-4 w-4" /> Nova coleta
            </Button>
            <Button variant="outline" onClick={() => navigate('/pwa/pesquisa/home', { replace: true })} className="w-full h-12 gap-2">
              <Home className="h-4 w-4" /> Voltar para Home
            </Button>
          </div>
        )}

        {state?.isKiosk && (
          <p className="text-sm text-muted-foreground animate-pulse">Retornando em 3 segundos...</p>
        )}
      </div>
    </div>
  );
}
