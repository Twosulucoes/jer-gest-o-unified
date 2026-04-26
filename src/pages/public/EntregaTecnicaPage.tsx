import { useEffect, useState } from "react";
import { 
  CheckCircle2, 
  Smartphone, 
  Trophy, 
  Users, 
  Mail, 
  ExternalLink, 
  ShieldCheck, 
  LayoutDashboard, 
  FileJson, 
  Globe, 
  Database, 
  Github, 
  Rocket,
  CheckSquare,
  FileSearch,
  UserPlus,
  Link,
  QrCode,
  TrendingUp,
  Share2,
  Copy
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface VersionInfo {
  appVersion: string;
  environment: string;
  branch: string;
  commit: string;
  commitFull: string;
  buildDate: string;
  supabaseProjectRef: string;
}

const PRIMARY = "#0B2B5A";
const BLUE = "#0F5AA6";

const environments = [
  { name: "Teste (Staging)", url: "https://teste.jers.com.br", icon: ShieldCheck, status: "Ativo", color: "text-blue-500" },
  { name: "Produção", url: "https://gestao.jers.com.br", icon: Rocket, status: "Aguardando", color: "text-green-500" },
  { name: "GitHub Repo", url: "#", icon: Github, status: "Privado", color: "text-gray-700" },
  { name: "Vercel Hosting", url: "#", icon: Globe, status: "Ativo", color: "text-black" },
  { name: "Supabase DB", url: "#", icon: Database, status: "Ativo", color: "text-emerald-500" },
];

const modules = [
  { name: "Admin", desc: "Gestão central de eventos e etapas", icon: LayoutDashboard },
  { name: "Importação", desc: "Processamento de planilhas de inscritos", icon: FileJson },
  { name: "Credenciamento", desc: "Geração e validação de QR Codes", icon: QrCode },
  { name: "PWA Operacional", desc: "Uso em campo para logística e suporte", icon: Smartphone },
  { name: "Resultados", desc: "Lançamento em tempo real por coordenadores", icon: Trophy },
  { name: "Portal Público", desc: "Divulgação de boletins e classificações", icon: Globe },
];

const roles = [
  { id: "super_admin", name: "Super Admin", scope: "Acesso total ao sistema e infraestrutura" },
  { id: "admin", name: "Administrador", scope: "Gestão completa do evento e usuários" },
  { id: "secretaria", name: "Secretaria", scope: "Gestão de inscrições e credenciamento" },
  { id: "delegação", name: "Delegado", scope: "Gestão de sua própria delegação (PWA)" },
  { id: "coordenador_modalidade", name: "Coordenador", scope: "Lançamento de resultados de sua modalidade" },
  { id: "operacionais", name: "Operacionais", scope: "Transporte, Alimentação e Alojamento" },
];

const tutorials = [
  { title: "Importar inscrições", icon: FileJson, color: "bg-blue-500" },
  { title: "Corrigir pendências", icon: FileSearch, color: "bg-orange-500" },
  { title: "Cadastrar usuários", icon: UserPlus, color: "bg-teal-500" },
  { title: "Vincular perfis", icon: Link, color: "bg-purple-500" },
  { title: "Validar credencial", icon: QrCode, color: "bg-pink-500" },
  { title: "Lançar resultados", icon: TrendingUp, color: "bg-green-500" },
  { title: "Publicar resultados", icon: Share2, color: "bg-blue-600" },
];

const checklistItems = [
  "Acesso ao sistema com autenticação segura",
  "Importação de dados de teste (planilhas Excel)",
  "Tratamento de duplicidades e pendências",
  "Geração de QR Code para participantes",
  "Lançamento de resultados (coletivos e individuais)",
  "Publicação de boletins no portal público",
  "Visualização de relatórios consolidados",
  "Sincronização offline-first básica no PWA",
];

export default function EntregaTecnicaPage() {
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/version.json", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setVersion(data))
      .catch(() => setVersion(null));
  }, []);

  const toggleCheck = (item: string) => {
    setCheckedItems(prev => ({ ...prev, [item]: !prev[item] }));
  };

  const copyToClipboard = (text: string) => {
    if (text === "#") return;
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "Link copiado para a área de transferência.",
    });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-20">
      
      {/* ── Capa / Hero ────────────────────────────────────────────────────────── */}
...
            {/* Ambientes */}
            <section>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Globe className="text-blue-500" /> Ambientes
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {environments.map((env) => (
                  <Card key={env.name} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className={`p-2 rounded-lg bg-slate-100 ${env.color}`}>
                        <env.icon size={24} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-sm">{env.name}</p>
                          <Badge variant="outline" className="text-[10px] uppercase font-bold px-1.5 h-4">
                            {env.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 truncate">{env.url}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-slate-400 hover:text-blue-600 shrink-0"
                          onClick={() => copyToClipboard(env.url)}
                          disabled={env.url === "#"}
                        >
                          <Copy size={14} />
                        </Button>
                        {env.url !== "#" && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-slate-400 hover:text-blue-600 shrink-0"
                            asChild
                          >
                            <a href={env.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink size={14} />
                            </a>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Módulos Entregues */}
            <section>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <CheckCircle2 className="text-green-500" /> Módulos Entregues
              </h2>
              <div className="grid sm:grid-cols-2 gap-6">
                {modules.map((mod) => (
                  <div key={mod.name} className="flex gap-4 p-4 bg-white rounded-xl shadow-sm border border-slate-100">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <mod.icon size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">{mod.name}</h3>
                      <p className="text-sm text-slate-500 leading-tight">{mod.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Perfis de Acesso */}
            <section>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Users className="text-purple-500" /> Perfis de Acesso
              </h2>
              <Card>
                <div className="divide-y divide-slate-100">
                  {roles.map((role) => (
                    <div key={role.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 transition-colors">
                      <span className="font-mono text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        {role.id}
                      </span>
                      <span className="font-semibold text-slate-700">{role.name}</span>
                      <span className="text-xs text-slate-500 sm:w-1/2 sm:text-right">{role.scope}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </section>

            {/* Tutoriais Rápidos */}
            <section>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Smartphone className="text-orange-500" /> Tutoriais Rápidos
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {tutorials.map((tut) => (
                  <Card key={tut.title} className="group hover:border-blue-200 cursor-pointer transition-all hover:-translate-y-1">
                    <CardContent className="p-4 flex flex-col items-center text-center">
                      <div className={`w-10 h-10 ${tut.color} text-white rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                        <tut.icon size={20} />
                      </div>
                      <p className="text-xs font-bold text-slate-700">{tut.title}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

          </div>

          {/* ── Coluna Direita ─────────────────────────────────────────────────── */}
          <div className="space-y-12">
            
            {/* Checklist de Homologação */}
            <section>
              <Card className="sticky top-6 border-blue-100">
                <CardHeader className="bg-blue-50/50">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckSquare className="text-blue-600" />
                    Checklist de Homologação
                  </CardTitle>
                  <CardDescription>
                    Critérios aceitos para entrega oficial
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {checklistItems.map((item) => (
                    <div key={item} className="flex items-start space-x-3 group">
                      <Checkbox 
                        id={item} 
                        checked={checkedItems[item]} 
                        onCheckedChange={() => toggleCheck(item)}
                        className="mt-1 border-slate-300 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                      />
                      <label 
                        htmlFor={item} 
                        className={`text-sm leading-tight cursor-pointer transition-colors ${checkedItems[item] ? 'text-slate-400 line-through' : 'text-slate-700 group-hover:text-blue-600'}`}
                      >
                        {item}
                      </label>
                    </div>
                  ))}
                  
                  <Separator className="my-6" />
                  
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-2">Progresso</p>
                    <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full transition-all duration-500" 
                        style={{ width: `${(Object.values(checkedItems).filter(Boolean).length / checklistItems.length) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-xs font-bold text-slate-600">
                      {Object.values(checkedItems).filter(Boolean).length} de {checklistItems.length} itens validados
                    </p>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Bloco de Versão */}
            <section>
              <Card className="bg-slate-900 text-slate-300 border-none">
                <CardHeader>
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Database size={16} /> Status do Build
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs font-mono">
                  {version ? (
                    <>
                      <div className="flex justify-between border-b border-white/10 pb-2">
                        <span>Versão</span>
                        <span className="text-lime-400">v{version.appVersion}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/10 pb-2">
                        <span>Ambiente</span>
                        <span className="text-blue-400">{version.environment}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/10 pb-2">
                        <span>Commit</span>
                        <span className="text-white">{version.commit}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Build Data</span>
                        <span className="text-slate-400">{new Date(version.buildDate).toLocaleString('pt-BR')}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-slate-500 italic">Carregando informações do build...</p>
                  )}
                </CardContent>
              </Card>
            </section>

            {/* Suporte e Próximos Passos */}
            <section>
              <h3 className="text-lg font-bold mb-4">Próximos Passos</h3>
              <ul className="space-y-4">
                <li className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0">1</div>
                  <p className="text-sm text-slate-600">Treinamento intensivo com coordenadores de modalidade.</p>
                </li>
                <li className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0">2</div>
                  <p className="text-sm text-slate-600">Migração final dos dados de produção e limpeza de testes.</p>
                </li>
                <li className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0">3</div>
                  <p className="text-sm text-slate-600">Acompanhamento presencial durante a abertura dos jogos.</p>
                </li>
              </ul>
              
              <div className="mt-8 p-6 bg-blue-600 rounded-2xl text-white">
                <p className="font-bold mb-2">Suporte Técnico 24/7</p>
                <p className="text-sm opacity-80 mb-4">Estamos disponíveis para resolver qualquer intercorrência durante o evento.</p>
                <Button variant="secondary" className="w-full bg-white text-blue-600 hover:bg-slate-100" asChild>
                  <a href="mailto:suporte@twosolucoes.com.br">
                    <Mail className="mr-2" size={16} /> Falar com suporte
                  </a>
                </Button>
              </div>
            </section>

          </div>
        </div>
      </main>

      <footer className="mt-20 py-10 text-center text-slate-400 text-xs border-t border-slate-200">
        <p>© 2026 JER - Jogos Escolares de Roraima. Desenvolvido por Two Soluções.</p>
      </footer>

    </div>
  );
}
