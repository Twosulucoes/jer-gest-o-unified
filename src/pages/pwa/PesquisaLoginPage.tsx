import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { saveSession, getDeviceId, getSession } from '@/lib/pesquisaSession';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ClipboardList, Loader2, Delete } from 'lucide-react';
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

  const handleLogin = async (currentPin: string) => {
    if (currentPin.length !== 4) return;

    setLoading(true);
    setError('');

    try {
      const { data, error: rpcError } = await supabase.rpc('pesquisa_login_with_pin', {
        p_pin: currentPin,
        p_device_id: getDeviceId(),
      });

      if (rpcError) throw rpcError;

      const result = data as any;
      if (result?.error) {
        setError(result.error === 'PIN_INVALID' ? 'PIN inválido' : 'Evento inativo');
        setPin(''); // Clear PIN on error
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

  const handleKeyPress = (num: string) => {
    if (loading) return;
    const nextPin = pin + num;
    if (nextPin.length <= 4) {
      setPin(nextPin);
      if (nextPin.length === 4) {
        handleLogin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    if (loading) return;
    setPin(pin.slice(0, -1));
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
          <CardContent className="space-y-6">
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-14 w-12 rounded-lg border-2 flex items-center justify-center text-2xl font-mono transition-all ${
                    pin.length > i 
                      ? "border-primary bg-primary/5 text-primary" 
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {pin[i] ? "•" : ""}
                </div>
              ))}
            </div>

            {error && <p className="text-sm text-destructive text-center">{error}</p>}

            <div className="grid grid-cols-3 gap-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <Button
                  key={num}
                  variant="outline"
                  className="h-16 text-xl font-medium active:bg-primary/10 transition-colors"
                  onClick={() => handleKeyPress(num)}
                  disabled={loading}
                >
                  {num}
                </Button>
              ))}
              <div />
              <Button
                variant="outline"
                className="h-16 text-xl font-medium active:bg-primary/10 transition-colors"
                onClick={() => handleKeyPress("0")}
                disabled={loading}
              >
                0
              </Button>
              <Button
                variant="ghost"
                className="h-16 text-xl text-muted-foreground active:bg-destructive/5"
                onClick={handleBackspace}
                disabled={loading || pin.length === 0}
              >
                <Delete className="h-6 w-6" />
              </Button>
            </div>

            <Button
              onClick={() => handleLogin(pin)}
              disabled={loading || pin.length !== 4}
              className="h-14 w-full text-lg hidden"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
              {loading ? 'Acessando...' : 'Acessar'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
