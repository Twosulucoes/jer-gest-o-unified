import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import { Building, Users, Calendar, AlertTriangle } from "lucide-react";
import type { MissingPerson } from "@/types/alojamento";

export default function AlojamentoUnidadeFaltososPage() {
  const navigate = useNavigate();
  const { unitId } = useParams();
  const [unitName, setUnitName] = useState("");
  const [missing, setMissing] = useState<MissingPerson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!unitId) return;
    async function loadData() {
      // Load unit name
      const { data: unit } = await supabase
        .from("lodging_units")
        .select("name")
        .eq("id", unitId)
        .single();
      if (unit) setUnitName(unit.name);

      // Load missing: allocated but no check-in
      const { data, error } = await supabase
        .from("lodging_occupancies")
        .select(`
          participant_id,
          participants(
            people(full_name),
            delegations(institutions(name))
          )
        `)
        .eq("unit_id", unitId)
        .eq("status", "allocated");

      if (data) {
        const formatted = data.map((d: any) => ({
          id: d.participant_id,
          full_name: d.participants?.people?.full_name || "N/A",
          delegation_name: d.participants?.delegations?.institutions?.name || "N/A"
        }));
        setMissing(formatted);
      }
      setLoading(false);
    }
    loadData();
  }, [unitId]);

  return (
    <div className="min-h-screen bg-background">
      <PwaHeader 
        title={unitName || "Unidade"} 
        icon={Building}
        backTo="/pwa/alojamento/ocupacao" 
      />

      <main className="p-4 max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-bold">Faltosos (Sem Check-in)</h2>
        </div>
        
        <p className="text-xs text-muted-foreground leading-tight px-1">
          Pessoas alocadas para esta unidade pela coordenação que ainda não realizaram o check-in no sistema.
        </p>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ) : missing.length === 0 ? (
          <Card className="bg-green-50/50 dark:bg-green-950/10 border-green-200/50">
            <CardContent className="p-8 text-center space-y-2">
              <Users className="h-8 w-8 mx-auto text-green-500/50" />
              <p className="text-sm font-medium text-green-600">Todos chegaram!</p>
              <p className="text-xs text-green-600/70">Não há pendências de check-in para esta unidade.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {missing.map((p) => (
              <Card key={p.id} className="rounded-2xl border-amber-100 dark:border-amber-900/30">
                <CardContent className="p-4 flex justify-between items-center">
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{p.full_name}</p>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase truncate">
                      {p.delegation_name}
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none text-[10px] font-bold">
                    PENDENTE
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
