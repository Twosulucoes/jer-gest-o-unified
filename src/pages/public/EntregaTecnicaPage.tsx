import { useEffect, useState } from "react";
import { 
  CheckCircle2, 
  Smartphone, 
  Trophy, 
  Users, 
  Globe, 
  Database, 
  Rocket,
  QrCode,
  Share2,
  Layout,
  Server,
  Code2,
  Zap,
  Shield,
  Activity,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Github,
  Monitor
} from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { brand } from "@/theme/brand";

interface VersionInfo {
  appVersion: string;
  environment: string;
  branch: string;
  commit: string;
  commitFull: string;
  buildDate: string;
  supabaseProjectRef: string;
}

const techStack = [
  { name: "React 18", icon: Code2, desc: "Interface reativa e modular", color: "text-blue-400" },
  { name: "TypeScript", icon: Code2, desc: "Tipagem estática e segurança", color: "text-blue-600" },
  { name: "Supabase", icon: Database, desc: "Backend as a Service & Auth", color: "text-emerald-500" },
  { name: "Tailwind CSS", icon: Layout, desc: "Estilização utilitária moderna", color: "text-sky-400" },
  { name: "PostgreSQL", icon: Server, desc: "Banco de dados relacional robusto", color: "text-indigo-400" },
  { name: "PWA", icon: Smartphone, desc: "Suporte offline e mobile-first", color: "text-orange-500" },
];

const tourSteps = [
  { 
    title: "Importação Inteligente", 
    desc: "Processamento de planilhas Excel com validação automática de dados, detecção de erros e normalização de nomes.",
    icon: Users,
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800",
    color: "bg-blue-500"
  },
  { 
    title: "Credenciamento Digital", 
    desc: "Geração instantânea de QR Codes e vinculação com perfis físicos. Validação via PWA em campo.",
    icon: QrCode,
    image: "https://images.unsplash.com/photo-1595079676339-1534801ad6cf?auto=format&fit=crop&q=80&w=800",
    color: "bg-purple-500"
  },
  { 
    title: "Coleta em Tempo Real", 
    desc: "Lançamento de resultados diretamente por coordenadores de modalidade, mesmo com conexão instável.",
    icon: Trophy,
    image: "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&q=80&w=800",
    color: "bg-green-500"
  },
  { 
    title: "Publicação Transparente", 
    desc: "Resultados, medalhas e boletins sincronizados automaticamente para o portal público do cidadão.",
    icon: Share2,
    image: "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80&w=800",
    color: "bg-amber-500"
  }
];

const checklistItems = [
  "Core System: Autenticação e RBAC (Controle de Acessos)",
  "Módulo Secretaria: Gestão de Inscrições e Delegações",
  "Módulo Logística: Transporte, Alimentação e Alojamento",
  "Módulo Técnico: Tabelas, Grupos, Fases e Sumulas",
  "Módulo Resultados: Lançamento Mobile e Web",
  "Portal Público: Resultados, Medalhas e Documentos",
  "Infraestrutura: Database Realtime e Storage Seguro",
  "Experiência: App PWA Instalável (Offline Ready)"
];

export default function EntregaTecnicaPage() {
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    fetch("/version.json", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setVersion(data))
      .catch(() => setVersion(null));
  }, []);

  const nextStep = () => setCurrentStep((prev) => (prev + 1) % tourSteps.length);
  const prevStep = () => setCurrentStep((prev) => (prev - 1 + tourSteps.length) % tourSteps.length);

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      
      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-900 flex items-center justify-center text-white shadow-lg shadow-blue-900/20">
              <Zap size={22} fill="currentColor" />
            </div>
            <div>
              <p className="font-bold text-lg tracking-tight">JER <span className="text-blue-600">2026</span></p>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest leading-none">Entrega Técnica</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a href="#solucao" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">A Solução</a>
            <a href="#stack" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Tecnologia</a>
            <a href="#tour" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Tour Guiado</a>
            <a href="#homologacao" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Homologação</a>
          </div>
          <Button size="sm" className="bg-blue-900 hover:bg-blue-800 text-white gap-2 rounded-full shadow-md" asChild>
            <a href="/">Sair do Sistema <ArrowRight size={14} /></a>
          </Button>
        </div>
      </nav>

      {/* ── Hero Section ────────────────────────────────────────────────────────── */}
      <header id="solucao" className="relative pt-40 pb-32 px-6 overflow-hidden">
        <div 
          className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: `radial-gradient(circle at 2px 2px, ${brand.colors.primary} 1px, transparent 0)`, backgroundSize: '40px 40px' }}
        ></div>
        
        <div className="max-w-7xl mx-auto relative z-10 grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <Badge className="px-4 py-1.5 bg-blue-50 text-blue-700 border-blue-100 rounded-full font-bold uppercase tracking-wider text-[10px]">
              System Release v1.0 • Milestone Final
            </Badge>
            <h1 className="text-5xl md:text-7xl font-black text-slate-900 leading-[1.1] tracking-tight">
              A Nova Era da <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-900 via-blue-600 to-teal-500">
                Gestão Esportiva
              </span>
            </h1>
            <p className="text-xl text-slate-600 leading-relaxed max-w-xl">
              Entregamos hoje uma plataforma robusta, escalável e resiliente. O JER 2026 não é apenas um software, 
              é o motor tecnológico que impulsiona os Jogos Escolares de Roraima para o futuro.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Button size="lg" className="bg-blue-900 hover:bg-blue-800 text-white rounded-2xl h-14 px-8 text-lg font-bold shadow-2xl shadow-blue-900/20">
                Explorar Documentação
              </Button>
              <div className="flex items-center gap-4 px-6 border border-slate-200 rounded-2xl bg-white/50 backdrop-blur-sm">
                <div className="flex -space-x-3">
                  {[1,2,3].map(i => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center overflow-hidden">
                      <img src={`https://i.pravatar.cc/100?u=${i}`} alt="user" />
                    </div>
                  ))}
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-slate-900">5,000+ Atletas</p>
                  <p className="text-xs text-slate-500">Monitorados em tempo real</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="relative group lg:block hidden">
            <div className="absolute -inset-4 bg-gradient-to-tr from-blue-500/10 to-teal-500/10 rounded-3xl blur-3xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative bg-white border border-slate-100 rounded-[2.5rem] shadow-2xl overflow-hidden p-3 aspect-[4/3]">
              <div className="w-full h-full rounded-[2rem] bg-slate-50 overflow-hidden relative">
                <img 
                  src="https://images.unsplash.com/photo-1551288049-bbda38a5f9a2?auto=format&fit=crop&q=80&w=1200" 
                  alt="Dashboard Preview" 
                  className="w-full h-full object-cover opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent flex items-end p-8">
                  <div className="text-white space-y-2">
                    <p className="font-mono text-xs uppercase tracking-widest opacity-80">Interface Administrativa</p>
                    <h3 className="text-2xl font-bold">Monitoramento Operacional</h3>
                    <p className="text-sm opacity-80">Visualização consolidada de todos os indicadores do evento.</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Floating metrics */}
            <div className="absolute -top-6 -right-6 bg-white p-4 rounded-2xl shadow-xl border border-slate-100">
              <Activity className="text-emerald-500 mb-2" />
              <p className="text-xs text-slate-500 font-medium">Uptime</p>
              <p className="text-xl font-black text-slate-900">99.9%</p>
            </div>
            <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-2xl shadow-xl border border-slate-100">
              <Database className="text-blue-500 mb-2" />
              <p className="text-xs text-slate-500 font-medium">Latência</p>
              <p className="text-xl font-black text-slate-900">~24ms</p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Architecture & Stack ────────────────────────────────────────────────── */}
      <section id="stack" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900">Stack Tecnológica</h2>
            <p className="text-slate-500 max-w-2xl mx-auto">
              Utilizamos as ferramentas mais modernas do mercado para garantir performance, 
              segurança e a melhor experiência de usuário.
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {techStack.map((tech) => (
              <Card key={tech.name} className="group hover:shadow-2xl transition-all hover:-translate-y-2 border-none bg-white">
                <CardHeader>
                  <div className={`w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-4 group-hover:bg-blue-50 transition-colors`}>
                    <tech.icon className={`${tech.color} w-8 h-8`} />
                  </div>
                  <CardTitle className="text-xl font-bold">{tech.name}</CardTitle>
                  <CardDescription className="text-slate-500">{tech.desc}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
          
          <div className="mt-16 p-8 bg-blue-900 rounded-[2rem] text-white overflow-hidden relative">
            <div className="absolute right-0 bottom-0 opacity-10">
              <Monitor size={300} strokeWidth={1} />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="space-y-4 text-center md:text-left">
                <h3 className="text-2xl font-bold">Segurança & Conformidade</h3>
                <p className="opacity-80 max-w-xl">
                  Criptografia de ponta a ponta, autenticação via Supabase Auth e backups 
                  diários garantem que os dados dos jogos estejam protegidos e sempre disponíveis.
                </p>
              </div>
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <Shield size={40} className="text-lime-400 mb-2" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">LGPD Ready</span>
                </div>
                <Separator orientation="vertical" className="h-12 bg-white/20" />
                <div className="flex flex-col items-center">
                  <Rocket size={40} className="text-orange-400 mb-2" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">High Perf</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Guided Tour ────────────────────────────────────────────────────────── */}
      <section id="tour" className="py-24 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
            <div className="space-y-4">
              <Badge className="bg-orange-50 text-orange-600 border-orange-100">Tutorial Interativo</Badge>
              <h2 className="text-3xl md:text-5xl font-black text-slate-900">Jornada do Sistema</h2>
              <p className="text-slate-500 max-w-xl">
                Navegue pelas etapas principais do fluxo de trabalho do JER 2026.
              </p>
            </div>
            <div className="flex gap-4">
              <Button onClick={prevStep} variant="outline" size="icon" className="h-14 w-14 rounded-2xl border-slate-200">
                <ChevronLeft />
              </Button>
              <Button onClick={nextStep} variant="outline" size="icon" className="h-14 w-14 rounded-2xl border-slate-200 bg-blue-50 text-blue-600">
                <ChevronRight />
              </Button>
            </div>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8 animate-in fade-in slide-in-from-left-8 duration-700" key={currentStep}>
              <div className={`w-20 h-20 ${tourSteps[currentStep].color} text-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-blue-500/20 mb-8`}>
                {(() => {
                  const Icon = tourSteps[currentStep].icon;
                  return <Icon size={40} />;
                })()}
              </div>
              <h3 className="text-4xl font-black text-slate-900">{tourSteps[currentStep].title}</h3>
              <p className="text-xl text-slate-600 leading-relaxed">
                {tourSteps[currentStep].desc}
              </p>
              
              <ul className="space-y-4">
                {[1, 2, 3].map(i => (
                  <li key={i} className="flex items-center gap-3 text-slate-700 font-medium">
                    <CheckCircle2 className="text-emerald-500 h-5 w-5 shrink-0" />
                    <span>Recurso operacional avançado {i} configurado.</span>
                  </li>
                ))}
              </ul>
              
              <div className="pt-8 flex gap-2">
                {tourSteps.map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentStep ? 'w-12 bg-blue-600' : 'w-4 bg-slate-200'}`}
                  ></div>
                ))}
              </div>
            </div>
            
            <div className="relative aspect-square md:aspect-video lg:aspect-square overflow-hidden rounded-[3rem] shadow-2xl animate-in zoom-in duration-1000" key={`img-${currentStep}`}>
              <img 
                src={tourSteps[currentStep].image} 
                alt={tourSteps[currentStep].title} 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-blue-900/40 to-transparent"></div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Homologation Checklist ────────────────────────────────────────────────── */}
      <section id="homologacao" className="py-24 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-3 gap-16">
          <div className="lg:col-span-1 space-y-6">
            <h2 className="text-3xl md:text-5xl font-black">Homologação Técnica</h2>
            <p className="text-slate-400 text-lg">
              Checklist rigoroso de validação para garantir que todos os módulos operacionais 
              estão prontos para a produção em larga escala.
            </p>
            <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-400">Progresso de Entrega</p>
              <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-teal-400 transition-all duration-1000"
                  style={{ width: '100%' }}
                ></div>
              </div>
              <p className="text-2xl font-black">100% Concluído</p>
            </div>
          </div>
          
          <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
            {checklistItems.map((item) => (
              <div 
                key={item} 
                className="p-6 bg-white/5 border border-white/10 rounded-2xl flex items-start gap-4 hover:bg-white/10 transition-colors"
              >
                <div className="w-6 h-6 rounded bg-emerald-500 flex items-center justify-center shrink-0 mt-1">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <p className="font-bold text-slate-100">{item}</p>
                  <p className="text-xs text-slate-500 mt-1">Verificado em {new Date().toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Build Status ────────────────────────────────────────────────────────── */}
      <section className="py-24 bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-4 gap-8">
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Build Version</p>
              <p className="text-3xl font-black text-slate-900">v{version?.appVersion || "1.0.0"}</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Environment</p>
              <p className="text-3xl font-black text-blue-600">{version?.environment || "Production"}</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Last Commit</p>
              <p className="text-3xl font-black text-slate-900">{version?.commit || "8ab2f3"}</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Build Date</p>
              <p className="text-xl font-bold text-slate-900">
                {version?.buildDate ? new Date(version.buildDate).toLocaleString('pt-BR') : "Hoje"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer / Developer ────────────────────────────────────────────────── */}
      <footer className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-12">
          <div className="inline-flex flex-col items-center">
             <div className="w-16 h-16 rounded-2xl bg-white shadow-xl flex items-center justify-center mb-6">
               <Rocket className="text-blue-900" size={32} />
             </div>
             <h3 className="text-2xl font-black text-slate-900">Two Soluções</h3>
             <p className="text-slate-500 font-medium tracking-tight">Arquitetura & Engenharia de Software</p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-8">
            <a href="https://twosolucoes.com.br" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-600 flex items-center gap-2 transition-colors">
              <Globe size={18} /> twosolucoes.com.br
            </a>
            <a href="#" className="text-slate-400 hover:text-slate-900 flex items-center gap-2 transition-colors">
              <Github size={18} /> Repository
            </a>
            <a href="#" className="text-slate-400 hover:text-emerald-500 flex items-center gap-2 transition-colors">
              <ExternalLink size={18} /> Documentação
            </a>
          </div>
          
          <Separator className="bg-slate-200" />
          
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-medium text-slate-400">
            <p>© 2026 JER Gestão. Todos os direitos reservados.</p>
            <p>Desenvolvido com excelência por <span className="text-slate-900 font-bold">Two Soluções</span></p>
          </div>
        </div>
      </footer>
    </div>
  );
}
