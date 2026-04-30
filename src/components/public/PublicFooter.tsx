import { Shield, ExternalLink } from "lucide-react";

export const PublicFooter = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="border-t py-12 px-6 text-sm text-muted-foreground bg-card/30 backdrop-blur-sm mt-auto">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8 items-start">
          {/* Logo and About */}
          <div className="space-y-4">
            <div className="flex flex-col gap-1 transition-all">
              <p className="font-black text-2xl text-foreground tracking-tighter">
                JER <span className="text-primary italic">Gestão</span>
              </p>
              <div className="h-1 w-12 bg-primary rounded-full" />
            </div>
            <p className="text-xs leading-relaxed max-w-xs">
              Plataforma oficial de gestão e divulgação dos Jogos Escolares de Roraima. 
              Tecnologia aplicada ao esporte escolar.
            </p>
          </div>

          {/* Links / Info */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/50">Institucional</h4>
            <div className="flex flex-col gap-2">
              <a href="#" className="text-xs hover:text-primary transition-colors flex items-center gap-1.5 group">
                Secretaria de Educação (SEED) <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
              <a href="#" className="text-xs hover:text-primary transition-colors flex items-center gap-1.5 group">
                Instituto de Desporto (IDRR) <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
              <a href="#" className="text-xs hover:text-primary transition-colors flex items-center gap-1.5 group">
                Governo de Roraima <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            </div>
          </div>

          {/* Security / Status */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/50">Integridade</h4>
            <div className="bg-success/5 border border-success/10 rounded-xl p-3 flex items-start gap-3">
              <Shield className="h-4 w-4 text-success shrink-0" />
              <p className="text-[10px] leading-tight text-success-foreground/70 font-medium">
                Dados processados e validados em tempo real pela Coordenação Técnica.
              </p>
            </div>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-border/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">
            © {currentYear} Jogos Escolares de Roraima
          </p>
          <div className="flex gap-6 text-[10px] uppercase tracking-widest font-black opacity-30">
            <span>Boa Vista / RR</span>
            <span>Brasil</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
