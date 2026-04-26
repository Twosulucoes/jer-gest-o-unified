import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, Weight, History } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AthletesWeighingTabProps {
  sportEventId: string;
}

export function AthletesWeighingTab({ sportEventId }: AthletesWeighingTabProps) {
  const qc = useQueryClient();
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: athletes = [], isLoading } = useQuery({
    queryKey: ["athletes-weighing", sportEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_sport_events")
        .select(`
          id,
          official_weight,
          weighing_status,
          weighed_at,
          weighed_by,
          participants (
            id,
            persons (
              id,
              name,
              registration_number
            ),
            delegations (
              id,
              institutions (name)
            )
          )
        `)
        .eq("sport_event_id", sportEventId);
      
      if (error) throw error;
      return data;
    },
  });

  const updateWeight = async (id: string, weight: number | null, status: string) => {
    setSavingId(id);
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from("participant_sport_events")
      .update({
        official_weight: weight,
        weighing_status: status,
        weighed_at: new Date().toISOString(),
        weighed_by: user?.id
      })
      .eq("id", id);

    setSavingId(null);
    if (error) {
      toast.error("Erro ao salvar pesagem: " + error.message);
    } else {
      toast.success("Pesagem registrada com sucesso");
      qc.invalidateQueries({ queryKey: ["athletes-weighing", sportEventId] });
      qc.invalidateQueries({ queryKey: ["sport_categories"] });
    }
  };

  if (isLoading) return <div>Carregando atletas...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-semibold">Pesagem de Atletas</h4>
          <p className="text-sm text-muted-foreground">Registre o peso oficial e valide a participação.</p>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-background">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Atleta</TableHead>
              <TableHead>Escola</TableHead>
              <TableHead className="w-[150px]">Peso Oficial (kg)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Histórico</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {athletes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  Nenhum atleta inscrito nesta categoria.
                </TableCell>
              </TableRow>
            ) : (
              athletes.map((ath: any) => (
                <TableRow key={ath.id}>
                  <TableCell>
                    <div className="font-medium">{ath.participants?.persons?.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      REG: {ath.participants?.persons?.registration_number}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {ath.participants?.delegations?.institutions?.name}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="h-8"
                      defaultValue={ath.official_weight || ""}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val !== ath.official_weight) {
                          // Only update value if user clicks save
                        }
                      }}
                      id={`weight-${ath.id}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        ath.weighing_status === "confirmed" ? "success" : 
                        ath.weighing_status === "overweight" ? "destructive" : "outline"
                      }
                      className="capitalize"
                    >
                      {ath.weighing_status === "pending" ? "Pendente" : 
                       ath.weighing_status === "confirmed" ? "Conferido" : "Fora do Peso"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {ath.weighed_at ? (
                      <div className="text-[10px] text-muted-foreground flex flex-col">
                        <span className="flex items-center gap-1">
                          <History className="h-3 w-3" />
                          {format(new Date(ath.weighed_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0 border-green-200 hover:bg-green-50 text-green-600"
                        title="Confirmar Peso"
                        disabled={savingId === ath.id}
                        onClick={() => {
                          const input = document.getElementById(`weight-${ath.id}`) as HTMLInputElement;
                          const weight = parseFloat(input.value);
                          updateWeight(ath.id, isNaN(weight) ? null : weight, "confirmed");
                        }}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0 border-red-200 hover:bg-red-50 text-red-600"
                        title="Fora do Peso"
                        disabled={savingId === ath.id}
                        onClick={() => {
                          const input = document.getElementById(`weight-${ath.id}`) as HTMLInputElement;
                          const weight = parseFloat(input.value);
                          updateWeight(ath.id, isNaN(weight) ? null : weight, "overweight");
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
