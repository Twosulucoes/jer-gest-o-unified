import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin } from "lucide-react";
import { PwaHeader } from "@/components/pwa/PwaHeader";

interface Venue {
  id: string;
  name: string;
  address: string | null;
}

export default function DelegacaoLocaisPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("venues").select("id, name, address").order("name");
      setVenues((data as any) || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <PwaHeader title="Locais" icon={MapPin} backTo="/pwa/delegacao" />

      <main className="p-4 max-w-md mx-auto space-y-3">
        {loading && [1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}

        {!loading && venues.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">Nenhum local cadastrado</div>
        )}

        {venues.map((v) => (
          <Card key={v.id}>
            <CardContent className="p-3">
              <p className="font-medium text-sm">{v.name}</p>
              {v.address && <p className="text-xs text-muted-foreground mt-1">📍 {v.address}</p>}
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
