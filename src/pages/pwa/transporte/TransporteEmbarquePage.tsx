import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle, ScanLine, Users } from "lucide-react";

interface Passenger {
  id: string;
  full_name: string;
  boarded: boolean;
  boarded_at: string | null;
}

export default function TransporteEmbarquePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tripId = searchParams.get("tripId");
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("trip_passengers" as any)
        .select("id, participant:participants(full_name), boarded, boarded_at")
        .eq("trip_id", tripId)
        .order("created_at");

      const list = (data || []).map((p: any) => ({
        id: p.id,
        full_name: p.participant?.full_name || "—",
        boarded: p.boarded || false,
        boarded_at: p.boarded_at,
      }));
      setPassengers(list);
      setLoading(false);
    })();
  }, [tripId]);

  const boardedCount = passengers.filter(p => p.boarded).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b bg-card px-4 h-14">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/pwa/transporte/viagens")} className="text-muted-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <CheckCircle className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">Embarque</span>
        </div>
        <Button size="sm" onClick={() => navigate(`/pwa/transporte/scan?tripId=${tripId}`)}>
          <ScanLine className="h-4 w-4 mr-1" /> Scan
        </Button>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4">
        {!tripId && (
          <div className="text-center py-8 text-muted-foreground">
            Selecione uma viagem na lista de viagens
          </div>
        )}

        {tripId && (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{boardedCount}/{passengers.length} embarcados</span>
            </div>

            {loading && [1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}

            {!loading && passengers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">Nenhum passageiro nesta viagem</div>
            )}

            <div className="space-y-2">
              {passengers.map((p) => (
                <Card key={p.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <span className="text-sm font-medium">{p.full_name}</span>
                    <Badge variant={p.boarded ? "default" : "outline"}>
                      {p.boarded ? "Embarcado" : "Pendente"}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
