import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { getSelectedFacility } from "@/hooks/useAlojamento";
import { ArrowLeft, Building } from "lucide-react";

interface BlockInfo {
  id: string;
  name: string;
  gender_policy: string;
  rooms: RoomInfo[];
}

interface RoomInfo {
  id: string;
  code: string;
  capacity: number;
  occupied: number;
}

export default function AlojamentoOcupacaoPage() {
  const navigate = useNavigate();
  const [blocks, setBlocks] = useState<BlockInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const facilityId = getSelectedFacility();

  useEffect(() => {
    if (!facilityId) return;
    (async () => {
      const { data: blocksData } = await supabase.schema("alojamento" as any)
        .from("blocks").select("id, name, gender_policy").eq("active", true)
        .order("name");

      if (!blocksData || blocksData.length === 0) {
        setLoading(false);
        return;
      }

      const blockIds = blocksData.map((b: any) => b.id);
      const { data: roomsData } = await supabase.schema("alojamento" as any)
        .from("rooms").select("id, code, capacity, block_id").eq("active", true)
        .in("block_id", blockIds).order("code");

      const roomIds = (roomsData || []).map((r: any) => r.id);
      const { data: bedsData } = await supabase.schema("alojamento" as any)
        .from("beds").select("id, room_id").eq("active", true)
        .in("room_id", roomIds);

      const { data: assignData } = await supabase.schema("alojamento" as any)
        .from("assignments").select("bed_id").eq("active", true);

      const assignedBedIds = new Set((assignData || []).map((a: any) => a.bed_id));
      const bedsByRoom = new Map<string, { total: number; occupied: number }>();
      for (const bed of (bedsData || [])) {
        const b = bed as any;
        const entry = bedsByRoom.get(b.room_id) || { total: 0, occupied: 0 };
        entry.total++;
        if (assignedBedIds.has(b.id)) entry.occupied++;
        bedsByRoom.set(b.room_id, entry);
      }

      const result: BlockInfo[] = (blocksData as any[]).map((block) => ({
        id: block.id,
        name: block.name,
        gender_policy: block.gender_policy,
        rooms: (roomsData as any[] || [])
          .filter((r) => r.block_id === block.id)
          .map((r) => ({
            id: r.id,
            code: r.code,
            capacity: r.capacity,
            occupied: bedsByRoom.get(r.id)?.occupied || 0,
          })),
      }));

      setBlocks(result);
      setLoading(false);
    })();
  }, [facilityId]);

  const genderLabel: Record<string, string> = { misto: "Misto", masculino: "Masculino", feminino: "Feminino" };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-2 border-b bg-card px-4 h-14">
        <button onClick={() => navigate("/pwa/alojamento")} className="text-muted-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Building className="h-5 w-5 text-primary" />
        <span className="font-semibold text-foreground">Ocupação</span>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4">
        {loading ? (
          <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
        ) : blocks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Nenhum bloco cadastrado</div>
        ) : (
          blocks.map((block) => (
            <Card key={block.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  {block.name}
                  <Badge variant="outline">{genderLabel[block.gender_policy] || block.gender_policy}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {block.rooms.map((room) => {
                  const pct = room.capacity > 0 ? Math.round((room.occupied / room.capacity) * 100) : 0;
                  return (
                    <div key={room.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/30">
                      <span className="text-sm font-medium w-16">{room.code}</span>
                      <Progress value={pct} className="flex-1 h-2" />
                      <span className="text-xs text-muted-foreground w-16 text-right">
                        {room.occupied}/{room.capacity}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}
