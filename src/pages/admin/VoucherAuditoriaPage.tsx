import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEventId } from "@/contexts/EventContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Download, History, ArrowLeft, Filter, FileSpreadsheet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function VoucherAuditoriaPage() {
  const eventId = useActiveEventId();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [outcomeFilter, setOutcomeFilter] = useState("all");

  const { data: operations = [], isLoading } = useQuery({
    queryKey: ["voucher-audit-ops", eventId, typeFilter, outcomeFilter],
    queryFn: async () => {
      // 1. Busca tentativas de validação (auditoria operacional)
      let qAttempts = supabase
        .from("service_voucher_attempts")
        .select(`
          *,
          voucher:service_vouchers(qr_code_value, is_nominal, eventual_person:service_eventual_people(full_name)),
          operator:profiles(display_name)
        `)
        .eq("event_id", eventId)
        .order("attempted_at", { ascending: false });
      
      if (outcomeFilter !== "all") qAttempts = qAttempts.eq("outcome", outcomeFilter);

      const { data: attempts, error: attErr } = await qAttempts;
      if (attErr) throw attErr;

      // 2. Mapeia para um formato unificado
      return (attempts || []).map(a => ({
        id: a.id,
        timestamp: a.attempted_at,
        type: a.outcome === 'success' ? 'CONSUMO' : 'TENTATIVA RECUSADA',
        service: a.service_kind,
        details: a.reason ? `Recusa: ${a.reason}` : 'Sucesso',
        identifier: (a as any).voucher?.eventual_person?.full_name || (a as any).voucher?.qr_code_value || a.qr_value,
        operator: (a as any).operator?.display_name || 'Sistema',
        is_offline: (a as any).is_offline,
        offline_at: (a as any).offline_at,
        tone: a.outcome === 'success' ? 'success' : 'destructive'
      }));
    },
    enabled: !!eventId
  });

  const filtered = operations.filter(op => 
    !search || 
    op.identifier?.toLowerCase().includes(search.toLowerCase()) ||
    op.operator?.toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = () => {
    toast.info("Exportação para CSV iniciada...");
    const headers = ["Data/Hora", "Tipo", "Serviço", "Identificador", "Detalhes", "Operador"];
    const rows = filtered.map(f => [
      format(new Date(f.timestamp), "dd/MM/yyyy HH:mm"),
      f.type,
      f.service,
      f.identifier,
      f.details,
      f.operator
    ]);
    
    const csv = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `auditoria-vouchers-${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV exportado com sucesso");
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/vouchers")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <History className="h-6 w-6 text-primary" /> Central de Auditoria de Vouchers
            </h1>
            <p className="text-sm text-muted-foreground">Rastreabilidade completa de emissões, consumos e recusas.</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
          <FileSpreadsheet className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px] space-y-1.5">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Voucher ou operador..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-48 space-y-1.5">
              <Label>Resultado</Label>
              <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="success">Sucessos</SelectItem>
                  <SelectItem value="refused">Recusas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">Nenhum registro encontrado.</div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Operação</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Identificador</TableHead>
                    <TableHead>Detalhes</TableHead>
                    <TableHead>Operador</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell className="text-xs font-mono">{format(new Date(op.timestamp), "dd/MM HH:mm")}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] uppercase ${op.tone === 'success' ? 'border-green-500 text-green-700 bg-green-50' : 'border-destructive text-destructive'}`}>
                          {op.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {op.is_offline ? (
                          <div className="flex flex-col gap-0.5">
                            <Badge variant="outline" className="text-[9px] border-amber-500 text-amber-700 bg-amber-50 w-fit">OFFLINE</Badge>
                            {op.offline_at && (
                              <span className="text-[9px] text-muted-foreground italic">
                                Lido: {format(new Date(op.offline_at), "dd/MM HH:mm")}
                              </span>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-[9px] border-blue-500 text-blue-700 bg-blue-50 w-fit">ONLINE</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] uppercase">{op.service}</Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{op.identifier}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{op.details}</TableCell>
                      <TableCell className="text-xs">{op.operator}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
