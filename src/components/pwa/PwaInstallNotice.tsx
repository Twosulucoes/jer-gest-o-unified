
import { Button } from '@/components/ui/button';
import { PlusSquare, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Global component to nudge users to install the PWA.
 * Appears only when the app is installable and not yet installed.
 */
export function PwaInstallNotice() {
  const { isInstallable, isInstalled } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show on the install page itself
  const isInstallPage = location.pathname === '/pwa/install';

  useEffect(() => {
    const isDismissed = localStorage.getItem('pwa-install-dismissed');
    if (isDismissed) {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (!isInstallable || isInstalled || dismissed || isInstallPage) return null;

  return (
    <div className="fixed bottom-6 left-4 right-4 z-[90] md:left-auto md:right-4 md:w-80 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary text-primary-foreground p-4 shadow-2xl shadow-primary/20">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <PlusSquare className="h-6 w-6 text-white" />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="font-heading text-sm font-bold">Instalar JER's Gestão</p>
              <p className="text-xs text-white/80 leading-relaxed">
                Adicione à sua tela inicial para uma experiência completa.
              </p>
            </div>
          </div>
          <button 
            onClick={handleDismiss}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="secondary"
            size="sm" 
            className="flex-1 h-9 text-xs font-bold"
            onClick={() => navigate('/pwa/install')}
          >
            Ver Instruções
          </Button>
        </div>
      </div>
    </div>
  );
}
