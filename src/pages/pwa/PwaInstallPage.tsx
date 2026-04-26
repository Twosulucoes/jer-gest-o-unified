
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Share, PlusSquare, ArrowLeft, Smartphone, Monitor, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePwaInstall } from "@/hooks/usePwaInstall";

export default function PwaInstallPage() {
  const navigate = useNavigate();
  const { isInstallable, install, isInstalled } = usePwaInstall();
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop" | "other">("other");

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setPlatform("ios");
    } else if (/android/.test(userAgent)) {
      setPlatform("android");
    } else if (!/mobile/.test(userAgent)) {
      setPlatform("desktop");
    }
  }, []);

  return (
    <div className="min-h-screen bg-background pb-10">
      {/* Header */}
      <div 
        className="px-5 pt-8 pb-12 text-white"
        style={{
          background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(212 84% 36%) 100%)",
        }}
      >
        <div className="max-w-md mx-auto">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(-1)} 
            className="text-white/80 hover:text-white hover:bg-white/10 mb-4 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Instalação do App</h1>
          <p className="text-white/80 text-sm">
            Adicione o JER's Gestão à sua tela inicial para acesso rápido e melhor desempenho.
          </p>
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto -mt-8 space-y-4">
        {isInstalled ? (
          <Card className="border-green-100 bg-green-50/50">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-green-600">
                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                  <PlusSquare className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">App Instalado!</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-green-700">
                O aplicativo já está instalado no seu dispositivo. Você pode acessá-lo diretamente pela sua tela de início.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Direct Install Button (Chrome/Android) */}
            {isInstallable && (
              <Card className="border-primary/20 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Download className="h-5 w-5 text-primary" />
                    Instalação Rápida
                  </CardTitle>
                  <CardDescription>
                    Seu navegador suporta instalação direta.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={install} 
                    className="w-full h-14 text-lg font-bold rounded-2xl shadow-md"
                  >
                    Adicionar à tela inicial
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Platform Specific Instructions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="h-5 w-5 text-muted-foreground" />
                  Instruções Passo a Passo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {platform === "ios" && (
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">1</div>
                      <p className="text-sm pt-1">Toque no ícone de <strong>Compartilhar</strong> <Share className="inline h-4 w-4 mx-1 text-blue-500" /> na barra inferior do Safari.</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">2</div>
                      <p className="text-sm pt-1">Role as opções para baixo e toque em <strong>"Adicionar à Tela de Início"</strong> <PlusSquare className="inline h-4 w-4 mx-1 text-blue-500" />.</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">3</div>
                      <p className="text-sm pt-1">Toque em <strong>"Adicionar"</strong> no canto superior direito para confirmar.</p>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
                        <Smartphone className="h-5 w-5 text-amber-600 shrink-0" />
                        <p className="text-[12px] text-amber-700 leading-tight">
                            <strong>Nota para iPhone:</strong> Certifique-se de estar usando o navegador <strong>Safari</strong> para ver estas opções.
                        </p>
                    </div>
                  </div>
                )}

                {(platform === "android" || (platform === "other" && !isInstallable)) && (
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">1</div>
                      <p className="text-sm pt-1">Toque no ícone de <strong>três pontos</strong> <Monitor className="inline h-4 w-4 mx-1" /> no canto superior direito do Chrome.</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">2</div>
                      <p className="text-sm pt-1">Selecione a opção <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">3</div>
                      <p className="text-sm pt-1">Confirme a instalação no pop-up que aparecerá.</p>
                    </div>
                  </div>
                )}

                {platform === "desktop" && !isInstallable && (
                  <div className="space-y-4 text-center py-4">
                    <Monitor className="h-12 w-12 mx-auto text-muted-foreground opacity-20" />
                    <p className="text-sm text-muted-foreground">
                      Para instalar no computador, clique no ícone de <strong>instalação</strong> na barra de endereços do seu navegador Chrome ou Edge.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-muted/30 border-dashed">
                <CardContent className="pt-6">
                    <h3 className="font-bold text-sm mb-2">Por que instalar?</h3>
                    <ul className="text-xs space-y-2 text-muted-foreground list-disc pl-4">
                        <li>Acesso offline a informações importantes</li>
                        <li>Notificações em tempo real (quando disponível)</li>
                        <li>Interface de tela cheia, sem barras do navegador</li>
                        <li>Carregamento muito mais rápido</li>
                    </ul>
                </CardContent>
            </Card>
          </>
        )}
      </div>
      
      <div className="text-center p-8">
        <img src="/brand/logo.png" alt="JER's Logo" className="h-10 mx-auto grayscale opacity-30" />
      </div>
    </div>
  );
}
