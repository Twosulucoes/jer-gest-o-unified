
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Trophy, Medal } from "lucide-react";
import DailyBulletinsTab from "@/components/admin/boletins/DailyBulletinsTab";
import FinalBulletinTab from "@/components/admin/boletins/FinalBulletinTab";
import MedalTableTab from "@/components/admin/boletins/MedalTableTab";
import { useEvent } from "@/contexts/EventContext";

export default function CompeticaoBoletinsPage() {
  const { selectedEvent } = useEvent();
  const [activeTab, setActiveTab] = useState("daily");

  if (!selectedEvent) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold">Selecione um evento para gerenciar os boletins.</h2>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Boletins Oficiais</h1>
        <p className="text-muted-foreground">
          Gerenciamento e emissão de boletins diários e boletim final do evento {selectedEvent.name}.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="daily" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Boletins do Dia
          </TabsTrigger>
          <TabsTrigger value="final" className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Boletim Final
          </TabsTrigger>
          <TabsTrigger value="medals" className="flex items-center gap-2">
            <Medal className="h-4 w-4" />
            Quadro de Medalhas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          <DailyBulletinsTab eventId={selectedEvent.id} />
        </TabsContent>

        <TabsContent value="final">
          <FinalBulletinTab eventId={selectedEvent.id} />
        </TabsContent>

        <TabsContent value="medals">
          <MedalTableTab eventId={selectedEvent.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
