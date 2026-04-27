import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Trash2, Clock, MapPin, User, AlertTriangle } from "lucide-react";
import { getVoucherQueue, resolveVoucherConflict, VoucherOfflineItem } from "@/lib/voucherOffline";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { voucherErrorMessage } from "@/lib/voucherMessages";
import { toast } from "sonner";

export function VoucherConflictCentral() {
  const [conflicts, setConflicts] = useState<VoucherOfflineItem[]>([]);

  const loadConflicts = () => {
    const queue = getVoucherQueue();
    setConflicts(queue.filter(i => i.status === "conflict"));
  };

  useEffect(() => {
    loadConflicts();
    const interval = setInterval(loadConflicts, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = (id: string, action: "resolved" | "discard") => {
    resolveVoucherConflict(id, action);
    loadConflicts();
    toast.success(action === "resolved" ? "Conflito marcado como resolvido" : "Registro descartado");
  };

  if (conflicts.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <h2 className="text-lg font-bold">Conflitos de Voucher</h2>
        <Badge variant="destructive" className="ml-auto">{conflicts.length}</Badge>
      </div>

      <div className="space-y-3">
        {conflicts.map((item) => (
          <Card key={item.id} className="border-destructive/30 overflow-hidden shadow-app-sm">
            <CardHeader className="p-3 bg-destructive/5 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-xs font-bold uppercase tracking-wider text-destructive">
                  {voucherErrorMessage(item.conflict_reason, undefined, item.conflict_context).text}
                </span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground bg-background px-1.5 py-0.5 rounded border">
                {item.qr_value.replace("voucher:", "")}
              </span>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span className="truncate">{item.person_name || "Voucher Anônimo"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{format(new Date(item.attempted_at), "HH:mm:ss", { locale: ptBR })}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">ID Instância: {item.context_id}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1 h-8 text-[11px] font-bold border-green-500/30 text-green-600 hover:bg-green-50 hover:text-green-700"
                  onClick={() => handleAction(item.id, "resolved")}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Resolver
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                  onClick={() => handleAction(item.id, "discard")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}