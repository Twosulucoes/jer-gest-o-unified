import type { BulletinDataset } from "./useBulletinData";
import BulletinScore from "./BulletinScore";
import BulletinSets from "./BulletinSets";
import BulletinCombat from "./BulletinCombat";
import BulletinTimeMark from "./BulletinTimeMark";
import { AlertCircle } from "lucide-react";

export default function BulletinRouter({ data }: { data: BulletinDataset }) {
  if (!data.matches.length && !data.results.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">Nenhum resultado encontrado para os filtros selecionados.</p>
      </div>
    );
  }

  switch (data.family) {
    case "score": return <BulletinScore data={data} />;
    case "sets": return <BulletinSets data={data} />;
    case "combat": return <BulletinCombat data={data} />;
    case "time":
    case "mark": return <BulletinTimeMark data={data} />;
    default:
      return (
        <div className="text-sm text-muted-foreground p-6 text-center">
          Família de modalidade não identificada — exibindo lista bruta de partidas.
          <BulletinScore data={data} />
        </div>
      );
  }
}
