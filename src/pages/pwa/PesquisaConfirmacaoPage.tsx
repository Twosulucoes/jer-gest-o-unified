import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Plus, Home } from 'lucide-react';
import { useEffect } from 'react';

export default function PesquisaConfirmacaoPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { submitted?: boolean; isKiosk?: boolean } | null;

  useEffect(() => {
    if (state?.isKiosk) {
      const timer = setTimeout(() => navigate('/pwa/pesquisa/home', { replace: true }), 3000);
      return () => clearTimeout(timer);
    }
  }, [state, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-sm">
        <div className="mx-auto w-20 h-20 rounded-full bg-success/10 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-success" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-heading font-bold text-foreground">
            {state?.submitted ? 'Resposta registrada!' : 'Salva para enviar depois'}
          </h1>
          <p className="text-muted-foreground">
            {state?.submitted
              ? 'Obrigado pela participação.'
              : 'A resposta será enviada automaticamente quando houver conexão.'}
          </p>
        </div>

        <div className="space-y-3">
          <Button 
            onClick={() => navigate('/pwa/pesquisa/nova?scan=true', { replace: true })} 
            className="w-full h-14 text-lg gap-2 shadow-app-md"
          >
            <ScanLine className="h-5 w-5" /> Próxima coleta (Scan)
          </Button>
          
          <Button 
            variant="outline"
            onClick={() => navigate('/pwa/pesquisa/nova', { replace: true })} 
            className="w-full h-12 gap-2 text-muted-foreground"
          >
            <Plus className="h-4 w-4" /> Nova coleta manual
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => navigate('/pwa/pesquisa/home', { replace: true })} 
            className="w-full h-12 gap-2 text-muted-foreground"
          >
            <Home className="h-4 w-4" /> Painel inicial
          </Button>
        </div>

        {state?.isKiosk && (
          <p className="text-xs text-muted-foreground animate-pulse mt-4 italic">
            Retornando automaticamente em 3 segundos...
          </p>
        )}
      </div>
    </div>
  );
}
