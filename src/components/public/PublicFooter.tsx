export const PublicFooter = () => {
  return (
    <footer className="border-t py-12 text-center text-sm text-muted-foreground bg-slate-50 mt-auto">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex flex-col items-center gap-2 mb-6 opacity-60 grayscale hover:grayscale-0 transition-all">
          <p className="font-bold text-slate-900 tracking-tight">
            JER <span className="text-teal-600">Gestão</span>
          </p>
          <div className="h-1 w-8 bg-primary/20 rounded-full" />
        </div>
        
        <p className="text-xs max-w-md mx-auto leading-relaxed">
          Plataforma oficial de gestão e divulgação dos Jogos Escolares de Roraima.
          Dados processados em tempo real pela Coordenação Técnica.
        </p>
        
        <div className="mt-8 flex justify-center gap-6 text-[10px] uppercase tracking-widest font-semibold opacity-40">
          <span>Governo de Roraima</span>
          <span>SEED / IDRR</span>
        </div>
      </div>
    </footer>
  );
};
