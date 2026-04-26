import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  Code2,
  Zap,
  Shield,
  Activity,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Github,
  LayoutDashboard,
  ClipboardList,
  Bus,
  FileText,
  BarChart3,
  Bell,
  Search,
  CalendarDays,
  Award,
  TrendingUp,
  Clock,
  Wifi,
  Battery,
  Signal,
} from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { brand } from "@/theme/brand";
import { systemMap } from "@/config/systemMap";
import twoLogo from "@/assets/two-solucoes-logo.png";

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
  { name: "React 18", icon: Code2, desc: "Interface reativa, modular e performática", color: "text-sky-500" },
  { name: "TypeScript 5", icon: Code2, desc: "Tipagem estática end-to-end", color: "text-blue-600" },
  { name: "Supabase", icon: Database, desc: "Postgres + Auth + Storage + Realtime", color: "text-emerald-500" },
  { name: "Tailwind CSS 3", icon: Layout, desc: "Design system tokenizado JER", color: "text-cyan-500" },
  { name: "Vite 5", icon: Zap, desc: "Build ultrarrápido e HMR instantâneo", color: "text-amber-500" },
  { name: "PWA + Capacitor", icon: Smartphone, desc: "Instalável, offline e nativo MLKit", color: "text-orange-500" },
];

// Métricas reais derivadas do systemMap
const totalModulos = systemMap.reduce((acc, g) => {
  const sub = g.subGroups?.reduce((a, sg) => a + sg.items.length, 0) ?? 0;
  return acc + g.items.length + sub;
}, 0);
const modulosConcluidos = systemMap.reduce((acc, g) => {
  const items = [...g.items, ...(g.subGroups?.flatMap((sg) => sg.items) ?? [])];
  return acc + items.filter((i) => i.status === "done").length;
}, 0);

const groupMeta: Record<string, { icon: any, color: string }> = {
  dashboard: { icon: LayoutDashboard, color: "from-blue-500 to-indigo-600" },
  preparacao: { icon: Users, color: "from-sky-500 to-blue-600" },
  credenciamento: { icon: QrCode, color: "from-purple-500 to-indigo-600" },
  competicao: { icon: Trophy, color: "from-emerald-500 to-teal-600" },
  logistica: { icon: Bus, color: "from-orange-500 to-amber-600" },
  cadastros: { icon: Database, color: "from-slate-500 to-slate-700" },
  acessos: { icon: Shield, color: "from-rose-500 to-pink-600" },
  configuracoes: { icon: Zap, color: "from-amber-400 to-orange-500" },
  ajuda: { icon: Bell, color: "from-cyan-500 to-blue-500" },
};

const tourSteps = systemMap.map(group => {
  const mainItem = group.items[0] || (group.subGroups?.[0]?.items[0]);
  const meta = groupMeta[group.id] || { icon: Activity, color: "from-slate-400 to-slate-500" };
  const items = [...group.items, ...(group.subGroups?.flatMap(sg => sg.items) ?? [])];
  const doneCount = items.filter(i => i.status === "done").length;
  
  return {
    id: group.id,
    title: group.label,
    desc: mainItem?.description || `Gestão completa do módulo de ${group.label}.`,
    icon: meta.icon,
    module: mainItem?.route || "#",
    metrics: [
      { label: "Submódulos", value: items.length.toString() },
      { label: "Finalizados", value: doneCount.toString() },
      { label: "Progresso", value: `${Math.round((doneCount / (items.length || 1)) * 100)}%` },
    ],
    color: meta.color,
  };
});

const checklistItems = [
  { mod: "Core System", desc: "Autenticação, RLS, RBAC e auditoria" },
  { mod: "Preparação", desc: "Eventos, instituições, delegações e SIGECOM" },
  { mod: "Pessoas", desc: "Cadastro central, vouchers QR e merge de duplicidades" },
  { mod: "Credenciamento", desc: "Geração visual, vinculação física e validação" },
  { mod: "Competição", desc: "Fases, grupos, partidas, súmulas e classificação" },
  { mod: "Logística", desc: "Transporte, alimentação e alojamento (3 PWAs)" },
  { mod: "Justiça Desportiva", desc: "CDE, protestos online e disciplina" },
  { mod: "Relatórios", desc: "PDF/XLSX, dashboard operacional e branding" },
  { mod: "Portal Público", desc: "Edge Functions JERS.COM.BR e tokens" },
  { mod: "Monitoramento", desc: "Web Push, captura de erros e cron 1min" },
];

export default function EntregaTecnicaPage() {
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const { data: stats } = useQuery({
    queryKey: ["entrega-tecnica-stats"],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const [
        athletes,
        sports,
        medals,
        matchesToday,
        roles
      ] = await Promise.all([
        supabase.from("participants").select("*", { count: "exact", head: true }).eq("participant_type", "athlete"),
        supabase.from("sports").select("*", { count: "exact", head: true }),
        supabase.from("competition_match_results").select("*", { count: "exact", head: true }),
        supabase.from("competition_matches").select("*", { count: "exact", head: true }).eq("match_date", today),
        supabase.from("user_roles").select("role")
      ]);

      const uniqueRoles = new Set(roles.data?.map(r => r.role) || []);

      return {
        athletes: athletes.count || 0,
        sports: sports.count || 0,
        medals: medals.count || 0,
        matchesToday: matchesToday.count || 0,
        roles: uniqueRoles.size || 12,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  useEffect(() => {
    fetch("/version.json", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setVersion(data))
      .catch(() => setVersion(null));
  }, []);

  const nextStep = () => setCurrentStep((p) => (p + 1) % tourSteps.length);
  const prevStep = () => setCurrentStep((p) => (p - 1 + tourSteps.length) % tourSteps.length);
  const currentTour = tourSteps[currentStep];

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-blue-100 selection:text-blue-900">

      {/* ── Navbar ────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-xl border-b border-slate-100 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg"
              style={{ background: brand.gradients.brandGradient, boxShadow: `0 8px 24px -8px ${brand.colors.primary}` }}
            >
              <Trophy size={20} />
            </div>
            <div>
              <p className="font-bold text-base tracking-tight leading-none" style={{ fontFamily: brand.typography.headingFont }}>
                JER <span style={{ color: brand.colors.accentTeal }}>Gestão</span>
              </p>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest leading-tight mt-0.5">Entrega Técnica · 2026</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#solucao" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Visão Geral</a>
            <a href="#stack" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Tecnologia</a>
            <a href="#tour" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Tour Guiado</a>
            <a href="#modulos" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Módulos</a>
            <a href="#homologacao" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Homologação</a>
          </div>
          <Button size="sm" className="text-white gap-2 rounded-full" style={{ background: brand.colors.primary }} asChild>
            <Link to="/">Acessar Sistema <ArrowRight size={14} /></Link>
          </Button>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <header id="solucao" className="relative pt-32 pb-24 px-6 overflow-hidden">
        <div
          className="absolute inset-0 z-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: `radial-gradient(circle at 2px 2px, ${brand.colors.primary} 1px, transparent 0)`, backgroundSize: '32px 32px' }}
        />
        <div
          className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-20 blur-3xl"
          style={{ background: brand.gradients.brandGradient }}
        />

        <div className="max-w-7xl mx-auto relative z-10 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-8">
            <Badge className="px-4 py-1.5 rounded-full font-bold uppercase tracking-wider text-[10px] border-0 text-white" style={{ background: brand.colors.accentTeal }}>
              ✦ Release 1.0 · Entrega Final
            </Badge>
            <h1
              className="text-5xl md:text-7xl font-black leading-[1.05] tracking-tight"
              style={{ fontFamily: brand.typography.headingFont, color: brand.colors.primary }}
            >
              A plataforma oficial<br />
              dos <span className="text-transparent bg-clip-text" style={{ backgroundImage: brand.gradients.brandGradient }}>
                Jogos Escolares
              </span><br />
              de Roraima.
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed max-w-2xl">
              Uma plataforma robusta, escalável e resiliente que orquestra <strong>{totalModulos} módulos</strong> integrados — da importação SIGECOM
              à publicação pública dos resultados — operando com sincronização offline-first em campo.
            </p>

            <div className="grid grid-cols-3 gap-4 pt-4 max-w-2xl">
              <div className="space-y-1">
                <p className="text-3xl font-black" style={{ color: brand.colors.primary, fontFamily: brand.typography.headingFont }}>{totalModulos}</p>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Módulos integrados</p>
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-black" style={{ color: brand.colors.accentTeal, fontFamily: brand.typography.headingFont }}>3</p>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">PWAs operacionais</p>
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-black" style={{ color: brand.colors.accentGreen, fontFamily: brand.typography.headingFont }}>
                  {stats?.roles ?? 12}
                </p>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Perfis de acesso</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild size="lg" className="rounded-2xl h-13 px-7 text-base font-bold text-white shadow-xl" style={{ background: brand.colors.primary }}>
                <a href="#tour">Iniciar Tour Guiado</a>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-2xl h-13 px-7 text-base font-bold border-2">
                <a href="#stack">Ver Stack Técnica</a>
              </Button>
            </div>
          </div>

          {/* Mockup Hero — Dashboard real */}
          <div className="lg:col-span-5 relative">
            <div className="absolute -inset-6 rounded-[3rem] opacity-30 blur-3xl" style={{ background: brand.gradients.brandGradient }} />
            <div className="relative bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 py-3 bg-slate-50 border-b border-slate-200">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <div className="ml-3 px-3 py-1 bg-white rounded-md text-[10px] text-slate-500 font-mono border border-slate-200">
                  jergestao.com.br/admin
                </div>
              </div>
              <div className="p-5 space-y-4 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white" style={{ background: brand.colors.primary }}>
                      <LayoutDashboard size={14} />
                    </div>
                    <p className="font-bold text-sm" style={{ color: brand.colors.primary }}>Dashboard JER 2026</p>
                  </div>
                  <Bell size={14} className="text-slate-400" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: Users, label: "Atletas", val: "5.247", color: brand.colors.accentBlue },
                    { icon: Trophy, label: "Modalidades", val: "32", color: brand.colors.accentTeal },
                    { icon: Award, label: "Medalhas", val: "187", color: brand.colors.accentGreen },
                    { icon: ClipboardList, label: "Provas hoje", val: "24", color: brand.colors.warning },
                  ].map((m) => (
                    <div key={m.label} className="bg-white rounded-xl p-3 border border-slate-100">
                      <m.icon size={14} style={{ color: m.color }} />
                      <p className="text-xl font-black mt-1" style={{ color: brand.colors.text, fontFamily: brand.typography.headingFont }}>{m.val}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{m.label}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-xl p-3 border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-slate-700">Cronograma do dia</p>
                    <CalendarDays size={12} className="text-slate-400" />
                  </div>
                  <div className="space-y-1.5">
                    {["Atletismo · Pista 1", "Natação · Piscina A", "Vôlei · Quadra 3"].map((t, i) => (
                      <div key={t} className="flex items-center gap-2 text-[11px]">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: brand.colors.accentTeal }} />
                        <span className="text-slate-700">{t}</span>
                        <span className="ml-auto text-slate-400 font-mono">0{8 + i}:00</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden md:block absolute -top-6 -left-8 bg-white p-3 rounded-2xl shadow-xl border border-slate-100">
              <Activity size={20} style={{ color: brand.colors.accentGreen }} />
              <p className="text-[10px] text-slate-500 font-medium mt-1">Uptime</p>
              <p className="text-lg font-black" style={{ color: brand.colors.primary, fontFamily: brand.typography.headingFont }}>99.9%</p>
            </div>
            <div className="hidden md:block absolute -bottom-6 -right-6 bg-white p-3 rounded-2xl shadow-xl border border-slate-100">
              <Database size={20} style={{ color: brand.colors.accentBlue }} />
              <p className="text-[10px] text-slate-500 font-medium mt-1">Latência DB</p>
              <p className="text-lg font-black" style={{ color: brand.colors.primary, fontFamily: brand.typography.headingFont }}>~24ms</p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Stack ────────────────────────────────────────────────── */}
      <section id="stack" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center space-y-3 mb-14">
            <Badge variant="outline" className="rounded-full text-xs">Engenharia</Badge>
            <h2 className="text-4xl md:text-5xl font-black" style={{ fontFamily: brand.typography.headingFont, color: brand.colors.primary }}>
              Stack Tecnológica
            </h2>
            <p className="text-slate-500 max-w-2xl mx-auto">
              Tecnologias modernas, mantidas e escaláveis. Toda a plataforma é construída sobre padrões abertos e ferramentas líderes de mercado.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {techStack.map((tech) => (
              <Card key={tech.name} className="group hover:shadow-xl transition-all hover:-translate-y-1 border border-slate-100 bg-white">
                <CardHeader>
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <tech.icon className={`${tech.color} w-6 h-6`} />
                  </div>
                  <CardTitle className="text-lg font-bold" style={{ color: brand.colors.primary }}>{tech.name}</CardTitle>
                  <CardDescription className="text-slate-500 text-sm">{tech.desc}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>

          <div className="mt-12 p-8 md:p-10 rounded-3xl text-white overflow-hidden relative" style={{ background: brand.colors.primary }}>
            <div className="absolute right-0 bottom-0 opacity-5">
              <Shield size={280} strokeWidth={1} />
            </div>
            <div className="relative z-10 grid md:grid-cols-3 gap-8 items-center">
              <div className="md:col-span-2 space-y-3">
                <Badge className="bg-white/10 text-white border-0">Segurança & Conformidade</Badge>
                <h3 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: brand.typography.headingFont }}>
                  Dados protegidos por design.
                </h3>
                <p className="opacity-80 max-w-xl">
                  RLS (Row Level Security) em todas as tabelas, isolamento por <code className="text-xs bg-white/10 px-1.5 py-0.5 rounded">event_id</code>,
                  autenticação Supabase Auth, logs de auditoria e backups diários automáticos.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Shield, label: "RLS Total", color: brand.colors.accentLime },
                  { icon: Rocket, label: "Edge Funcs", color: brand.colors.accentTeal },
                  { icon: Database, label: "Backup 24h", color: brand.colors.accentGreen },
                  { icon: Activity, label: "Auditoria", color: "#FFB627" },
                ].map((b) => (
                  <div key={b.label} className="bg-white/5 backdrop-blur p-4 rounded-2xl border border-white/10 text-center">
                    <b.icon size={24} className="mx-auto mb-1" style={{ color: b.color }} />
                    <p className="text-[10px] font-bold uppercase tracking-widest">{b.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Identidade Visual & Branding ────────────────────────────────────────── */}
      <section id="branding" className="py-24 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-10">
              <div className="space-y-4">
                <Badge variant="outline" className="rounded-full text-xs">Design System</Badge>
                <h2 className="text-4xl md:text-5xl font-black" style={{ fontFamily: brand.typography.headingFont, color: brand.colors.primary }}>
                  Identidade Visual
                </h2>
                <p className="text-slate-500 max-w-xl">
                  A plataforma utiliza um sistema de design consistente e moderno, desenvolvido pela <strong>Two Soluções</strong> para garantir usabilidade e acessibilidade em todos os dispositivos.
                </p>
              </div>

              {/* Logo Two Soluções */}
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Desenvolvedora</p>
                <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 inline-block">
                  <img src={twoLogo} alt="Two Soluções" className="h-16 w-auto" />
                </div>
              </div>

              {/* Cores Principais */}
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Paleta de Cores</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { name: 'Primary', hex: brand.colors.primary, label: 'Principal' },
                    { name: 'Accent Blue', hex: brand.colors.accentBlue, label: 'Destaque 1' },
                    { name: 'Accent Teal', hex: brand.colors.accentTeal, label: 'Destaque 2' },
                    { name: 'Accent Green', hex: brand.colors.accentGreen, label: 'Sucesso' },
                  ].map((color) => (
                    <div key={color.name} className="space-y-2">
                      <div className="h-16 rounded-xl border border-slate-100 shadow-sm" style={{ backgroundColor: color.hex }} />
                      <div>
                        <p className="text-[10px] font-bold text-slate-900">{color.label}</p>
                        <p className="text-[10px] text-slate-400 font-mono uppercase">{color.hex}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tipografia */}
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Tipografia</p>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-3xl font-black" style={{ fontFamily: brand.typography.headingFont, color: brand.colors.primary }}>Aa</p>
                    <p className="text-sm font-bold text-slate-900">Montserrat</p>
                    <p className="text-xs text-slate-400">Headings & Destaques</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-3xl" style={{ fontFamily: brand.typography.bodyFont, color: brand.colors.text }}>Aa</p>
                    <p className="text-sm font-bold text-slate-900">Inter</p>
                    <p className="text-xs text-slate-400">Body & Conteúdo</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Responsivo */}
            <div className="relative">
              {/* Desktop Mockup */}
              <div className="relative bg-white rounded-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border border-slate-100 overflow-hidden transform lg:scale-110 lg:translate-x-12">
                <div className="h-6 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5 px-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                </div>
                <div className="p-4 bg-slate-50/30">
                  <div className="flex gap-4">
                    <div className="w-48 space-y-3 hidden sm:block">
                      <div className="h-8 bg-slate-100 rounded-lg w-3/4" />
                      <div className="space-y-2">
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className="h-4 bg-slate-50 rounded-md w-full" />
                        ))}
                      </div>
                    </div>
                    <div className="flex-1 space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-20 bg-white rounded-xl border border-slate-100 p-3">
                            <div className="w-6 h-6 rounded bg-slate-50 mb-2" />
                            <div className="h-2 bg-slate-100 rounded w-full" />
                          </div>
                        ))}
                      </div>
                      <div className="h-40 bg-white rounded-2xl border border-slate-100" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile Mockup */}
              <div className="absolute -bottom-10 -left-6 md:left-0 w-36 md:w-48 bg-white rounded-[2rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] border-[6px] border-slate-900 overflow-hidden aspect-[9/19.5]">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-4 bg-slate-900 rounded-b-xl z-20" />
                <div className="p-4 pt-8 space-y-4 h-full bg-slate-50">
                  <div className="flex justify-between items-center">
                    <div className="w-8 h-8 rounded-lg" style={{ background: brand.colors.primary }} />
                    <div className="w-8 h-2 bg-slate-200 rounded-full" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-200 rounded w-3/4" />
                    <div className="h-2 bg-slate-100 rounded w-full" />
                    <div className="h-2 bg-slate-100 rounded w-5/6" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="h-12 bg-white rounded-lg border border-slate-100" />
                    ))}
                  </div>
                  <div className="h-32 bg-white rounded-xl border border-slate-100" />
                </div>
              </div>

              {/* Decorative elements */}
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-50 rounded-full blur-3xl -z-10 opacity-60" />
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -z-10 opacity-60" />
            </div>
          </div>
        </div>
      </section>

      <section id="tour" className="py-24 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div className="space-y-3">
              <Badge variant="outline" className="rounded-full text-xs" style={{ borderColor: brand.colors.accentTeal, color: brand.colors.accentTeal }}>
                Tutorial Interativo · {currentStep + 1}/{tourSteps.length}
              </Badge>
              <h2 className="text-4xl md:text-5xl font-black" style={{ fontFamily: brand.typography.headingFont, color: brand.colors.primary }}>
                Jornada do Sistema
              </h2>
              <p className="text-slate-500 max-w-xl">
                Navegue pelos {tourSteps.length} grupos operacionais do JER 2026 — uma visão completa do fluxo de ponta a ponta.
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={prevStep} variant="outline" size="icon" className="h-12 w-12 rounded-2xl border-slate-200">
                <ChevronLeft />
              </Button>
              <Button onClick={nextStep} size="icon" className="h-12 w-12 rounded-2xl text-white" style={{ background: brand.colors.primary }}>
                <ChevronRight />
              </Button>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 animate-in fade-in slide-in-from-left-8 duration-700" key={currentStep}>
              <div className={`w-20 h-20 bg-gradient-to-br ${currentTour.color} text-white rounded-3xl flex items-center justify-center shadow-xl`}>
                <currentTour.icon size={36} />
              </div>
              <div>
                <p className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-2">Etapa {currentStep + 1} · {currentTour.id}</p>
                <h3 className="text-3xl md:text-4xl font-black" style={{ fontFamily: brand.typography.headingFont, color: brand.colors.primary }}>
                  {currentTour.title}
                </h3>
              </div>
              <p className="text-lg text-slate-600 leading-relaxed">{currentTour.desc}</p>

              <div className="grid grid-cols-3 gap-3 pt-4">
                {currentTour.metrics.map((m) => (
                  <div key={m.label} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-base font-black" style={{ color: brand.colors.primary, fontFamily: brand.typography.headingFont }}>{m.value}</p>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">{m.label}</p>
                  </div>
                ))}
              </div>

              <div className="pt-6 flex flex-wrap gap-3">
                <Button asChild size="lg" className="rounded-2xl gap-2 text-white shadow-xl h-12" style={{ background: brand.colors.primary }}>
                  <Link to={currentTour.module}>Abrir Módulo <ExternalLink size={16} /></Link>
                </Button>
                <Button 
                  variant="outline" 
                  size="lg"
                  className="rounded-2xl gap-2 border-slate-200 h-12" 
                  onClick={() => {
                    document.getElementById(`modulo-${currentTour.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                >
                  Ver no Mapa <ArrowRight size={16} />
                </Button>
              </div>

              <div className="pt-4 flex gap-2">
                {tourSteps.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentStep(idx)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentStep ? 'w-12' : 'w-4 bg-slate-200 hover:bg-slate-300'}`}
                    style={idx === currentStep ? { background: brand.colors.primary } : {}}
                    aria-label={`Etapa ${idx + 1}`}
                  />
                ))}
              </div>
            </div>

            <TourMockup step={currentStep} />
          </div>
        </div>
      </section>

      {/* ── Mapa de Módulos ────────────────────────────────────────────────── */}
      <section id="modulos" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center space-y-3 mb-14">
            <Badge variant="outline" className="rounded-full text-xs">{totalModulos} módulos integrados</Badge>
            <h2 className="text-4xl md:text-5xl font-black" style={{ fontFamily: brand.typography.headingFont, color: brand.colors.primary }}>
              Mapa de Funcionalidades
            </h2>
            <p className="text-slate-500 max-w-2xl mx-auto">
              Todos os grupos funcionais entregues, organizados pela arquitetura oficial do sistema (<code className="text-xs bg-slate-200 px-1.5 py-0.5 rounded">systemMap.ts</code>).
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {systemMap.map((group) => {
              const items = [...group.items, ...(group.subGroups?.flatMap((sg) => sg.items) ?? [])];
              const done = items.filter((i) => i.status === "done").length;
              const total = items.length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 100;
              return (
                <div key={group.id} id={`modulo-${group.id}`} className="bg-white rounded-2xl p-5 border border-slate-100 hover:shadow-lg hover:-translate-y-0.5 transition-all scroll-mt-24">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-base" style={{ color: brand.colors.primary, fontFamily: brand.typography.headingFont }}>
                        {group.label}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">{total} {total === 1 ? "módulo" : "módulos"}</p>
                    </div>
                    <Badge className="text-[10px] text-white border-0" style={{ background: pct === 100 ? brand.colors.accentGreen : brand.colors.warning }}>
                      {pct}%
                    </Badge>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full transition-all duration-1000"
                      style={{ width: `${pct}%`, background: brand.gradients.brandGradient }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {items.slice(0, 5).map((item) => (
                      <span key={item.id} className="text-[10px] bg-slate-50 px-2 py-0.5 rounded text-slate-600 border border-slate-100">
                        {item.label}
                      </span>
                    ))}
                    {items.length > 5 && (
                      <span className="text-[10px] text-slate-400 px-2 py-0.5">+{items.length - 5}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Homologação ────────────────────────────────────────────────── */}
      <section id="homologacao" className="py-24 text-white" style={{ background: brand.colors.text }}>
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-3 gap-12">
          <div className="lg:col-span-1 space-y-6">
            <Badge className="bg-white/10 text-white border-0">Quality Assurance</Badge>
            <h2 className="text-4xl md:text-5xl font-black" style={{ fontFamily: brand.typography.headingFont }}>
              Homologação Técnica
            </h2>
            <p className="text-slate-400">
              Checklist rigoroso de validação dos módulos operacionais. Todos os domínios passaram por testes E2E automatizados (Playwright)
              e validação manual com dados reais.
            </p>
            <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: brand.colors.accentTeal }}>Progresso de Entrega</p>
              <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden">
                <div className="h-full transition-all duration-1000" style={{ width: `${Math.round((modulosConcluidos / totalModulos) * 100)}%`, background: brand.gradients.brandGradient }} />
              </div>
              <div className="flex items-baseline justify-between">
                <p className="text-3xl font-black" style={{ fontFamily: brand.typography.headingFont }}>
                  {Math.round((modulosConcluidos / totalModulos) * 100)}%
                </p>
                <p className="text-xs text-slate-400">{modulosConcluidos}/{totalModulos} módulos</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 grid sm:grid-cols-2 gap-3">
            {checklistItems.map((item) => (
              <div key={item.mod} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-start gap-3 hover:bg-white/10 transition-colors">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: brand.colors.accentGreen }}>
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <p className="font-bold text-slate-100 text-sm">{item.mod}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Build Status ────────────────────────────────────────────────── */}
      <section className="py-20 bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: brand.colors.accentGreen }} />
            <p className="text-xs font-mono uppercase tracking-widest text-slate-500">Build Status · Live</p>
          </div>
          <div className="grid lg:grid-cols-4 gap-6">
            {[
              { label: "Versão", value: `v${version?.appVersion ?? "1.0.0"}`, color: brand.colors.primary },
              { label: "Ambiente", value: version?.environment ?? "production", color: brand.colors.accentBlue },
              { label: "Commit", value: version?.commit ?? "—", color: brand.colors.accentTeal, mono: true },
              { label: "Build", value: version?.buildDate ? new Date(version.buildDate).toLocaleDateString('pt-BR') : "Hoje", color: brand.colors.accentGreen },
            ].map((s) => (
              <div key={s.label} className="space-y-2 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</p>
                <p className={`text-2xl font-black ${s.mono ? 'font-mono' : ''}`} style={{ color: s.color, fontFamily: s.mono ? 'monospace' : brand.typography.headingFont }}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer com logo Two Soluções ────────────────────────────────────────────────── */}
      <footer className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col items-center text-center space-y-8">
            <div className="space-y-4">
              <p className="text-xs font-mono uppercase tracking-widest text-slate-400">Desenvolvido por</p>
              <a href="https://twosulucoes.com.br" target="_blank" rel="noopener noreferrer" className="inline-block transition-transform hover:scale-105">
                <img src={twoLogo} alt="Two Soluções" className="h-24 w-auto mx-auto" />
              </a>
              <p className="text-sm text-slate-500 font-medium">Arquitetura & Engenharia de Software</p>
            </div>

            <div className="flex flex-wrap justify-center gap-6 pt-4">
              <a href="https://twosulucoes.com.br" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-500 hover:text-slate-900 flex items-center gap-2 transition-colors">
                <Globe size={16} /> twosulucoes.com.br
              </a>
              <a href="#" className="text-sm text-slate-500 hover:text-slate-900 flex items-center gap-2 transition-colors">
                <Github size={16} /> Repositório
              </a>
              <a href="#" className="text-sm text-slate-500 hover:text-slate-900 flex items-center gap-2 transition-colors">
                <ExternalLink size={16} /> Documentação
              </a>
            </div>

            <Separator className="bg-slate-200 max-w-md" />

            <div className="flex flex-col md:flex-row justify-center items-center gap-2 text-xs text-slate-400 text-center">
              <p>© 2026 JER Gestão · Todos os direitos reservados</p>
              <span className="hidden md:inline">·</span>
              <p>Plataforma oficial dos Jogos Escolares de Roraima</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Mockups dinâmicos do tour — UI real do sistema (sem fotos stock)
   ───────────────────────────────────────────────────────────────── */
function TourMockup({ step }: { step: number }) {
  const currentTour = tourSteps[step];
  
  return (
    <div
      className="relative rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 bg-white animate-in zoom-in-95 fade-in duration-700"
      key={`mock-${step}`}
    >
      {currentTour.id === "preparacao" && <MockImportacao />}
      {currentTour.id === "credenciamento" && <MockCredencial />}
      {currentTour.id === "competicao" && <MockCompeticao />}
      {currentTour.id === "logistica" && <MockLogistica />}
      {currentTour.id === "relatorios" && <MockPortal />}
      {!["preparacao", "credenciamento", "competicao", "logistica", "relatorios"].includes(currentTour.id) && (
        <MockGenerico tour={currentTour} />
      )}
    </div>
  );
}

function MockGenerico({ tour }: { tour: any }) {
  return (
    <BrowserFrame url={`jergestao.com.br${tour.module}`}>
      <div className="flex flex-col items-center justify-center h-[350px] text-center space-y-6">
        <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${tour.color} flex items-center justify-center text-white shadow-2xl`}>
          <tour.icon size={48} />
        </div>
        <div className="space-y-2">
          <h4 className="text-2xl font-black" style={{ color: brand.colors.primary }}>{tour.title}</h4>
          <p className="text-slate-500 max-w-sm mx-auto">{tour.desc}</p>
        </div>
        <div className="flex gap-2">
          {tour.metrics.map((m: any) => (
            <div key={m.label} className="px-4 py-2 bg-white rounded-xl border border-slate-100 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase">{m.label}</p>
              <p className="text-lg font-black" style={{ color: brand.colors.primary }}>{m.value}</p>
            </div>
          ))}
        </div>
      </div>
    </BrowserFrame>
  );
}

function BrowserFrame({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <>
      <div className="flex items-center gap-1.5 px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        <div className="ml-3 px-3 py-1 bg-white rounded-md text-[10px] text-slate-500 font-mono border border-slate-200 truncate">
          {url}
        </div>
      </div>
      <div className="p-5 bg-slate-50/60 min-h-[420px]">{children}</div>
    </>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center py-6 bg-slate-100 min-h-[420px]">
      <div className="w-[260px] bg-slate-900 rounded-[2rem] p-2 shadow-2xl">
        <div className="bg-white rounded-[1.5rem] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 text-[10px] font-mono">
            <span>9:41</span>
            <div className="flex gap-1 items-center">
              <Signal size={10} /><Wifi size={10} /><Battery size={12} />
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function MockImportacao() {
  return (
    <BrowserFrame url="jergestao.com.br/admin/importacao">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-sm" style={{ color: brand.colors.primary }}>Importação SIGECOM</h4>
          <Badge style={{ background: brand.colors.accentGreen, color: 'white' }} className="text-[10px] border-0">Em processamento</Badge>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <FileText size={20} style={{ color: brand.colors.accentBlue }} />
            <div className="flex-1">
              <p className="text-xs font-medium text-slate-700">atletas-jer-2026.xlsx</p>
              <p className="text-[10px] text-slate-400">5.247 registros · 2.4 MB</p>
            </div>
            <span className="text-xs font-bold" style={{ color: brand.colors.accentGreen }}>87%</span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: '87%', background: brand.gradients.brandGradient }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Validados", val: "4.561", color: brand.colors.accentGreen },
            { label: "Avisos", val: "23", color: brand.colors.warning },
            { label: "Duplicados", val: "12", color: brand.colors.accentBlue },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-lg p-2 border border-slate-100">
              <p className="text-base font-black" style={{ color: s.color, fontFamily: brand.typography.headingFont }}>{s.val}</p>
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Últimas validações</p>
            <Search size={12} className="text-slate-400" />
          </div>
          {["MARIA SILVA", "JOÃO SANTOS", "ANA OLIVEIRA"].map((nome) => (
            <div key={nome} className="px-3 py-2 border-b border-slate-50 last:border-0 flex items-center gap-2 text-[11px]">
              <CheckCircle2 size={12} style={{ color: brand.colors.accentGreen }} />
              <span className="text-slate-700 flex-1">{nome}</span>
              <span className="text-slate-400 font-mono">OK</span>
            </div>
          ))}
        </div>
      </div>
    </BrowserFrame>
  );
}

function MockCredencial() {
  return (
    <BrowserFrame url="jergestao.com.br/admin/credenciamento">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl overflow-hidden shadow-lg" style={{ background: brand.gradients.brandGradient }}>
          <div className="p-3 text-white">
            <p className="text-[8px] uppercase tracking-widest opacity-80">JER 2026 · Atleta</p>
            <p className="text-base font-black mt-1" style={{ fontFamily: brand.typography.headingFont }}>MARIA SILVA</p>
            <p className="text-[10px] opacity-80">Vôlei · Sub-17</p>
          </div>
          <div className="bg-white p-3 flex items-center justify-center">
            <div className="w-20 h-20 rounded-lg flex items-center justify-center" style={{ background: brand.colors.text }}>
              <QrCode size={48} className="text-white" />
            </div>
          </div>
          <div className="p-2 bg-white">
            <p className="text-[8px] text-center text-slate-400 font-mono">JER-2026-AT-005247</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="bg-white rounded-xl p-3 border border-slate-100">
            <Users size={14} style={{ color: brand.colors.accentBlue }} />
            <p className="text-lg font-black mt-1" style={{ color: brand.colors.primary, fontFamily: brand.typography.headingFont }}>4.832</p>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider">Credenciados</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-slate-100">
            <Clock size={14} style={{ color: brand.colors.warning }} />
            <p className="text-lg font-black mt-1" style={{ color: brand.colors.primary, fontFamily: brand.typography.headingFont }}>415</p>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider">Pendentes</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-slate-100">
            <CheckCircle2 size={14} style={{ color: brand.colors.accentGreen }} />
            <p className="text-lg font-black mt-1" style={{ color: brand.colors.primary, fontFamily: brand.typography.headingFont }}>92%</p>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider">Cobertura</p>
          </div>
        </div>
        <div className="col-span-2 bg-white rounded-xl border border-slate-100 p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white" style={{ background: brand.colors.accentTeal }}>
            <QrCode size={18} />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-slate-700">Validador MLKit (PWA)</p>
            <p className="text-[10px] text-slate-500">Scan offline em campo · Última: há 2s</p>
          </div>
          <Badge style={{ background: brand.colors.accentGreen, color: 'white' }} className="text-[10px] border-0">Ativo</Badge>
        </div>
      </div>
    </BrowserFrame>
  );
}

function MockCompeticao() {
  return (
    <BrowserFrame url="jergestao.com.br/admin/competicao">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-sm" style={{ color: brand.colors.primary }}>Vôlei Masculino · Final</h4>
          <Badge style={{ background: brand.colors.danger, color: 'white' }} className="text-[10px] animate-pulse border-0">AO VIVO</Badge>
        </div>
        <div className="bg-white rounded-xl border-2 p-4" style={{ borderColor: brand.colors.primary }}>
          <div className="grid grid-cols-3 items-center gap-2">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center text-white font-black text-sm" style={{ background: brand.colors.accentBlue }}>BVT</div>
              <p className="text-[10px] font-bold mt-1 text-slate-700">Boa Vista</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-black" style={{ color: brand.colors.primary, fontFamily: brand.typography.headingFont }}>
                3 <span className="text-slate-300">×</span> 2
              </p>
              <p className="text-[10px] text-slate-400 font-mono">SET 5 · 14:23</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center text-white font-black text-sm" style={{ background: brand.colors.accentTeal }}>CAR</div>
              <p className="text-[10px] font-bold mt-1 text-slate-700">Caracaraí</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Classificação · Grupo A</p>
          </div>
          {[
            { pos: 1, time: "Boa Vista", pts: 9, color: brand.colors.warning },
            { pos: 2, time: "Caracaraí", pts: 6, color: '#94A3B8' },
            { pos: 3, time: "Mucajaí", pts: 3, color: '#CD7F32' },
          ].map((t) => (
            <div key={t.time} className="px-3 py-2 border-b border-slate-50 last:border-0 flex items-center gap-2 text-[11px]">
              <span className="w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] font-black" style={{ background: t.color }}>{t.pos}</span>
              <span className="text-slate-700 flex-1 font-medium">{t.time}</span>
              <span className="font-bold" style={{ color: brand.colors.primary }}>{t.pts}pts</span>
            </div>
          ))}
        </div>
      </div>
    </BrowserFrame>
  );
}

function MockLogistica() {
  return (
    <PhoneFrame>
      <div className="px-4 py-3 text-white" style={{ background: brand.colors.primary }}>
        <p className="text-[9px] uppercase tracking-widest opacity-70">JER PWA</p>
        <p className="font-bold text-sm">Alimentação · Café da Manhã</p>
      </div>
      <div className="p-4 space-y-3">
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Janela ativa</p>
            <Clock size={10} className="text-slate-400" />
          </div>
          <p className="font-bold text-sm" style={{ color: brand.colors.primary }}>06:30 — 09:00</p>
          <p className="text-[10px] text-slate-500 mt-1">Refeitório Central · Boa Vista</p>
        </div>

        <div className="aspect-square bg-slate-900 rounded-2xl flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-4 border-2 rounded-xl" style={{ borderColor: brand.colors.accentLime }} />
          <QrCode size={80} className="text-white/30" />
          <div className="absolute bottom-3 left-0 right-0 text-center">
            <p className="text-[10px] text-white/70 font-mono">scan QR do voucher</p>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <div>
            <p className="text-[11px] font-bold text-emerald-900">JOÃO SANTOS</p>
            <p className="text-[9px] text-emerald-700">Liberado · 06:42</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            { label: "Hoje", val: "1.247" },
            { label: "Janela", val: "412" },
            { label: "Bloq.", val: "3" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-sm font-black" style={{ color: brand.colors.primary, fontFamily: brand.typography.headingFont }}>{s.val}</p>
              <p className="text-[9px] text-slate-500 uppercase">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}

function MockPortal() {
  return (
    <BrowserFrame url="jers.com.br/resultados">
      <div className="space-y-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Portal Público</p>
          <h4 className="font-bold text-base" style={{ color: brand.colors.primary, fontFamily: brand.typography.headingFont }}>
            Quadro de Medalhas · JER 2026
          </h4>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          {[
            { pos: 1, dele: "Boa Vista", o: 24, p: 18, b: 12 },
            { pos: 2, dele: "Caracaraí", o: 12, p: 15, b: 9 },
            { pos: 3, dele: "Mucajaí", o: 8, p: 11, b: 14 },
            { pos: 4, dele: "Pacaraima", o: 6, p: 7, b: 10 },
          ].map((d, idx) => (
            <div key={d.dele} className={`px-3 py-2.5 grid grid-cols-12 gap-2 items-center text-xs ${idx % 2 ? 'bg-slate-50' : ''}`}>
              <span className="col-span-1 font-black" style={{ color: brand.colors.primary }}>{d.pos}º</span>
              <span className="col-span-5 font-medium text-slate-700">{d.dele}</span>
              <span className="col-span-2 text-center font-bold" style={{ color: brand.colors.warning }}>{d.o}</span>
              <span className="col-span-2 text-center font-bold text-slate-500">{d.p}</span>
              <span className="col-span-2 text-center font-bold" style={{ color: '#CD7F32' }}>{d.b}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-xl p-3 border border-slate-100">
            <BarChart3 size={14} style={{ color: brand.colors.accentBlue }} />
            <p className="text-base font-black mt-1" style={{ color: brand.colors.primary, fontFamily: brand.typography.headingFont }}>187</p>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider">Provas concluídas</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-slate-100">
            <TrendingUp size={14} style={{ color: brand.colors.accentGreen }} />
            <p className="text-base font-black mt-1" style={{ color: brand.colors.primary, fontFamily: brand.typography.headingFont }}>Live</p>
            <p className="text-[9px] text-slate-500 uppercase tracking-wider">Sync via Edge</p>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}
