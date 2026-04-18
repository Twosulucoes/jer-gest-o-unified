import ParticipantSportHistory from "@/components/admin/ParticipantSportHistory";

interface Props {
  participantId: string;
}

export default function ParticipantHistoricoTab({ participantId }: Props) {
  return (
    <div className="mt-4">
      <ParticipantSportHistory participantId={participantId} />
    </div>
  );
}
