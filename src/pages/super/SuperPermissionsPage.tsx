import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, Shield, Lock, Globe, Smartphone, UserCog, Database, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const ROLES = [
  "super_admin", "admin", "secretaria", "coordenacao_tecnica", "coordenador_modalidade", 
  "transporte", "alimentacao", "alojamento", "delegacao", "mesario", "arbitragem", "cde"
] as const;

const ROLE_INFO: Record<string, { label: string, description: string }> = {
  super_admin: { label: "Super Admin", description: "Acesso total e irrestrito a todas as funções, configurações e logs do sistema." },
  admin: { label: "Administrador", description: "Gestão completa do evento, participantes, delegações e usuários." },
  secretaria: { label: "Secretaria", description: "Operação de cadastros, inscrições, documentos e suporte aos usuários." },
  coordenacao_tecnica: { label: "Coord. Técnica", description: "Gestão técnica de competições, chaves, resultados e classificação." },
  coordenador_modalidade: { label: "Coord. Modalidade", description: "Gestão específica de uma modalidade e suas provas vinculadas." },
  transporte: { label: "Transporte", description: "Gestão operacional de frotas, rotas e horários via aplicativo." },
  alimentacao: { label: "Alimentação", description: "Controle de acesso a refeitórios e consumo de refeições via QR Code." },
  alojamento: { label: "Alojamento", description: "Gestão de ocupação, check-in e check-out em unidades de alojamento." },
  delegacao: { label: "Delegação", description: "Consulta de inscritos e documentos da delegação pelo aplicativo." },
  mesario: { label: "Mesário", description: "Controle de placar, tempo e estatísticas das partidas ao vivo." },
  arbitragem: { label: "Arbitragem", description: "Registro de ocorrências e súmulas simplificadas em tempo real." },
  cde: { label: "CDE", description: "Análise e parecer técnico sobre protestos e irregularidades." }
};

type Role = typeof ROLES[number];

interface PermissionRow {
  page: string;
  path: string;
  category: "admin" | "etapa" | "pwa" | "super" | "public";
  allowedRoles: Role[] | "all" | "super_admin_only";
}

const PERMISSIONS: PermissionRow[] = [
  // Admin Global
  { page: "Dashboard", path: "/admin", category: "admin", allowedRoles: "all" },
  { page: "Eventos", path: "/admin/eventos", category: "admin", allowedRoles: ["admin", "secretaria", "coordenacao_tecnica"] },
  { page: "Participantes", path: "/admin/participantes", category: "admin", allowedRoles: ["admin", "secretaria", "coordenacao_tecnica", "coordenador_modalidade"] },
  { page: "Delegações", path: "/admin/delegacoes", category: "admin", allowedRoles: ["admin", "secretaria", "coordenacao_tecnica"] },
  { page: "Importação", path: "/admin/importacao", category: "admin", allowedRoles: ["super_admin", "admin", "secretaria"] },
  { page: "Usuários", path: "/admin/acessos/usuarios", category: "admin", allowedRoles: ["super_admin", "admin", "secretaria"] },
  { page: "Vínculos", path: "/admin/acessos/delegacoes", category: "admin", allowedRoles: ["super_admin", "admin", "secretaria"] },
  
  // Contexto Etapa
  { page: "Hub da Etapa", path: "/admin/etapa/:id", category: "etapa", allowedRoles: ["admin", "secretaria", "coordenacao_tecnica", "transporte", "alimentacao", "alojamento", "coordenador_modalidade"] },
  { page: "Credenciamento", path: "/admin/etapa/:id/credenciamento", category: "etapa", allowedRoles: ["admin", "secretaria", "coordenacao_tecnica"] },
  { page: "Logística Consolidada", path: "/admin/etapa/:id/logistica/consolidada", category: "etapa", allowedRoles: ["admin", "secretaria", "coordenacao_tecnica", "transporte", "alimentacao", "alojamento"] },
  { page: "Competição (Painel)", path: "/admin/etapa/:id/competicao/painel", category: "etapa", allowedRoles: ["admin", "secretaria", "coordenacao_tecnica", "coordenador_modalidade"] },
  { page: "Protestos", path: "/admin/etapa/:id/protestos", category: "etapa", allowedRoles: ["admin", "secretaria", "cde"] },
  
  // PWA / Operacional
  { page: "PWA Landing", path: "/pwa", category: "pwa", allowedRoles: "all" },
  { page: "PWA Transporte", path: "/pwa/transporte", category: "pwa", allowedRoles: ["transporte"] },
  { page: "PWA Alimentação", path: "/pwa/alimentacao", category: "pwa", allowedRoles: ["alimentacao"] },
  { page: "PWA Alojamento", path: "/pwa/alojamento", category: "pwa", allowedRoles: ["alojamento"] },
  { page: "PWA Delegação", path: "/pwa/delegacao", category: "pwa", allowedRoles: ["delegacao"] },
  
  // Super Admin
  { page: "Super Dashboard", path: "/super", category: "super", allowedRoles: "super_admin_only" },
  { page: "Logs do Sistema", path: "/super/logs", category: "super", allowedRoles: "super_admin_only" },
  { page: "Central de Dados", path: "/admin/dados", category: "super", allowedRoles: "super_admin_only" },
  { page: "Diagnóstico", path: "/admin/sistema/diagnostico", category: "super", allowedRoles: "super_admin_only" },
];

const CATEGORIES = [
  { id: "admin", label: "Admin Global", icon: Shield },
  { id: "etapa", label: "Contexto Etapa", icon: Lock },
  { id: "pwa", label: "Módulos PWA", icon: Smartphone },
  { id: "super", label: "Super Admin", icon: Database },
];

function PermissionIcon({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <div className="flex justify-center"><Check className="h-4 w-4 text-green-500" /></div>
  ) : (
    <div className="flex justify-center"><X className="h-4 w-4 text-zinc-300" /></div>
  );
}

export default function SuperPermissionsPage() {
  const checkAccess = (row: PermissionRow, role: Role) => {
    if (row.allowedRoles === "super_admin_only") return false;
    if (row.allowedRoles === "all") return true;
    // Admin/Secretaria bypass most guards
    if (role === "admin" || role === "secretaria") return true;
    return row.allowedRoles.includes(role);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserCog className="h-6 w-6 text-primary" /> Matriz de Permissões
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visualização técnica de rotas e perfis de acesso (Super Admin Bypass não listado por ser implícito).
        </p>
      </header>

      <Tabs defaultValue="admin" className="space-y-4">
        <TabsList className="bg-muted/50 p-1">
          {CATEGORIES.map(cat => (
            <TabsTrigger key={cat.id} value={cat.id} className="gap-2">
              <cat.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{cat.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIES.map(cat => (
          <TabsContent key={cat.id} value={cat.id}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{cat.label}</CardTitle>
                <CardDescription>Páginas acessíveis via {cat.id === 'pwa' ? 'dispositivos móveis' : 'painel administrativo'}.</CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="min-w-[150px]">Página / Rota</TableHead>
                        <TooltipProvider>
                          {ROLES.map(role => (
                            <Tooltip key={role}>
                              <TooltipTrigger asChild>
                                <TableHead className="text-center text-[10px] uppercase font-bold px-1 py-3 whitespace-nowrap min-w-[70px] cursor-help">
                                  {role.replace('_', ' ')}
                                </TableHead>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1">
                                  <p className="font-bold text-xs">{ROLE_INFO[role].label}</p>
                                  <p className="text-[10px] max-w-[150px] leading-tight">{ROLE_INFO[role].description}</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </TooltipProvider>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {PERMISSIONS.filter(p => p.category === cat.id).map(row => (
                        <TableRow key={row.path} className="hover:bg-muted/20">
                          <TableCell className="py-3">
                            <p className="text-sm font-semibold">{row.page}</p>
                            <code className="text-[10px] text-muted-foreground block mt-0.5">{row.path}</code>
                          </TableCell>
                          {ROLES.map(role => (
                            <TableCell key={role} className="p-1">
                              <PermissionIcon allowed={checkAccess(row, role)} />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <Card className="border-amber/20 bg-amber/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
            <Globe className="h-4 w-4" /> Observações Técnicas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-xs text-amber-800 space-y-1.5 list-disc pl-4">
            <li><strong>Super Admin:</strong> Possui acesso irrestrito a todas as rotas listadas acima (Bypass habilitado no <code>ProtectedRoute</code>).</li>
            <li><strong>Redirecionamento Operacional:</strong> Usuários com perfis apenas de PWA (Transporte, Alimentação, etc) são redirecionados automaticamente ao tentar acessar <code>/admin</code>.</li>
            <li><strong>Permissões de PWA:</strong> No mobile, perfis <code>admin</code> e <code>secretaria</code> possuem permissão "Master" para visualizar todos os módulos operacionais.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

