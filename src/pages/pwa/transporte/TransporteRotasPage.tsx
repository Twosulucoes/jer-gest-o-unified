import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin } from "lucide-react";

interface RouteItem {
  id: string;
  name: string;
  origin: string | null;
  destination: string | null;
}

export default function TransporteRotasPage() {
  const navigate = useNavigate();
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("routes" as any).select("id, name, origin, destination").order("name");
      setRoutes((data as any) || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-2 border-b bg-card px-4 h-14">
        <button onClick={() => navigate("/pwa/transporte")} className="text-muted-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <MapPin className="h-5 w-5 text-primary" />
        <span className="font-semibold text-foreground">Rotas</span>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-3">
        {loading && [1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}

        {!loading && routes.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">Nenhuma rota cadastrada</div>
        )}

        {routes.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-3">
              <p className="font-medium text-sm">{r.name}</p>
              {(r.origin || r.destination) && (
                <p className="text-xs text-muted-foreground mt-1">
                  {r.origin || "—"} → {r.destination || "—"}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
