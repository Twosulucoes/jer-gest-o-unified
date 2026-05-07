import ParticipantSportHistory from "@/components/admin/ParticipantSportHistory";
import ParticipantSportEventsManager from "./ParticipantSportEventsManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListChecks } from "lucide-react";

interface Props {
  participantId: string;
  eventId: string;
}

export default function ParticipantHistoricoTab({ participantId, eventId }: Props) {
  return (
    <div className="mt-4 space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            Inscrições em Modalidades
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ParticipantSportEventsManager participantId={participantId} eventId={eventId} />
        </CardContent>
      </Card>
      <ParticipantSportHistory participantId={participantId} />
    </div>
  );
}
