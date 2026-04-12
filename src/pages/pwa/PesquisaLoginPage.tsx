import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { saveSession, getDeviceId, getSession } from '@/lib/pesquisaSession';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ClipboardList } from 'lucide-react';
import { useEffect } from 'react';

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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="space-y-2">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary flex items-center justify-center">
            <ClipboardList className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Pesquisa de Satisfação</h1>
          <p className="text-muted-foreground">Digite seu PIN para acessar</p>
        </div>

        <div className="space-y-4">
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            placeholder="• • • •"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="text-center text-3xl tracking-[0.5em] h-16 font-mono"
            autoFocus
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            onClick={handleLogin}
            disabled={loading || pin.length !== 4}
            className="w-full h-14 text-lg"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
