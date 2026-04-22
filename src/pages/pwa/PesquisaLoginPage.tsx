import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { saveSession, getDeviceId, getSession } from '@/lib/pesquisaSession';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ClipboardList } from 'lucide-react';
import { useEffect } from 'react';
import { PwaBrandLogo } from '@/components/pwa/PwaBrandLogo';

export default function PesquisaLoginPage() {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const session = getSession();
    if (session) navigate('/pwa/pesquisa/home', { replace: true });
  }, [navigate]);

  const handleLogin = async () => {
    if (pin.length !== 4) {
      setError('Digite um PIN de 4 dígitos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: rpcError } = await supabase.rpc('pesquisa_login_with_pin', {
        p_pin: pin,
        p_device_id: getDeviceId(),
      });

      if (rpcError) throw rpcError;

      const result = data as any;
      if (result?.error) {
        setError(result.error === 'PIN_INVALID' ? 'PIN inválido' : 'Evento inativo');
        return;
      }

      saveSession(result);
      navigate('/pwa/pesquisa/home', { replace: true });
    } catch (err: any) {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-35" />
      <div
        className="relative flex flex-col items-center justify-center px-6 pt-12 pb-8"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(212 84% 36%) 40%, hsl(174 87% 34%) 70%, hsl(133 55% 45%) 100%)",
        }}
      >
        <PwaBrandLogo size="lg" className="drop-shadow-lg brightness-0 invert" />
        <div className="flex items-center gap-2 mt-3">
          <ClipboardList className="h-5 w-5 text-primary-foreground/85" />
          <p className="text-primary-foreground/80 text-sm font-body">Pesquisa de Satisfação</p>
        </div>
      </div>

      <div className="relative flex flex-1 items-start justify-center p-4 pt-8">
        <Card className="w-full max-w-sm border-border/80 bg-card/95 shadow-app-xl backdrop-blur-sm">
          <CardHeader className="text-center pb-1">
            <p className="text-muted-foreground">Digite seu PIN para acessar</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              placeholder="• • • •"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="h-16 text-center font-mono text-3xl tracking-[0.5em]"
              autoFocus
            />

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              onClick={handleLogin}
              disabled={loading || pin.length !== 4}
              className="h-14 w-full text-lg"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
