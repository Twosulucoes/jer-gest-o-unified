import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Database, Activity, ShieldAlert, Table as TableIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function DatabaseMonitoringPage() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['db-monitoring-stats'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('db_operation_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000) as any);
      
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) return (
    <div className="p-8 space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-96" />
    </div>
  );

  if (error) return (
    <div className="p-8">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Erro</AlertTitle>
        <AlertDescription>
          Não foi possível carregar os dados de monitoramento. Certifique-se de que a tabela db_operation_logs existe.
          <pre className="mt-2 text-xs">{JSON.stringify(error, null, 2)}</pre>
        </AlertDescription>
      </Alert>
    </div>
  );

  // Process data for charts
  const moduleData = (stats || []).reduce((acc: any[], curr: any) => {
    const existing = acc.find(i => i.name === curr.module_name);
    if (existing) {
      existing.value++;
    } else {
      acc.push({ name: curr.module_name, value: 1 });
    }
    return acc;
  }, []);

  const tableData = (stats || []).reduce((acc: any[], curr: any) => {
    const existing = acc.find(i => i.name === curr.table_name);
    if (existing) {
      existing.value++;
    } else {
      acc.push({ name: curr.table_name, value: 1 });
    }
    return acc;
  }, []);

  const successRate = (stats || []).reduce((acc: any, curr: any) => {
    if (curr.is_success) acc.success++;
    else acc.failed++;
    return acc;
  }, { success: 0, failed: 0 });

  const rlsFailures = (stats || []).filter((s: any) => !s.is_success);

  return (
    <div className="p-8 space-y-6 bg-zinc-950 text-zinc-100 min-h-screen">
      <div className="flex items-center gap-2">
        <Database className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Monitoramento de Banco de Dados</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total de Operações</CardTitle>
            <Activity className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.length || 0}</div>
            <p className="text-xs text-zinc-400 mt-1">Últimas 1000 operações</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Sucesso</CardTitle>
            <ShieldAlert className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{successRate.success}</div>
            <p className="text-xs text-zinc-400 mt-1">{((successRate.success / (stats?.length || 1)) * 100).toFixed(1)}% de aproveitamento</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Falhas / RLS</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{successRate.failed}</div>
            <p className="text-xs text-zinc-400 mt-1">Potenciais bloqueios de RLS</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Tabelas Ativas</CardTitle>
            <TableIcon className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tableData.length}</div>
            <p className="text-xs text-zinc-400 mt-1">Em uso no PWA</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>Operações por Módulo</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={moduleData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
                  itemStyle={{ color: '#f4f4f5' }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>Operações por Tabela</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={tableData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {tableData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
                   itemStyle={{ color: '#f4f4f5' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle>Últimas Falhas / Erros de RLS</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
                <TableHead className="text-zinc-400">Data</TableHead>
                <TableHead className="text-zinc-400">Módulo</TableHead>
                <TableHead className="text-zinc-400">Tabela</TableHead>
                <TableHead className="text-zinc-400">Op</TableHead>
                <TableHead className="text-zinc-400">Erro</TableHead>
                <TableHead className="text-zinc-400">Perfil</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rlsFailures.length === 0 ? (
                <TableRow className="border-zinc-800">
                  <TableCell colSpan={6} className="text-center py-8 text-zinc-500 italic">
                    Nenhuma falha detectada recentemente.
                  </TableCell>
                </TableRow>
              ) : (
                rlsFailures.map((item: any) => (
                  <TableRow key={item.id} className="border-zinc-800 hover:bg-zinc-800/50">
                    <TableCell className="text-xs text-zinc-400">
                      {format(new Date(item.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-medium">{item.module_name}</TableCell>
                    <TableCell>{item.table_name}</TableCell>
                    <TableCell>{item.operation}</TableCell>
                    <TableCell className="text-red-400 font-mono text-xs">{item.error_code || 'N/A'}</TableCell>
                    <TableCell className="text-xs">{item.user_role}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
