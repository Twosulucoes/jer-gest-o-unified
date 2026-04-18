import { AlertTriangle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DelegationCount {
  name: string;
  count: number;
}

interface Props {
  delegationCounts: DelegationCount[];
}

export function DelegationAlertBanner({ delegationCounts }: Props) {
  if (delegationCounts.length < 2) return null;

  const names = delegationCounts.map(d => d.name);

  return (
    <div className="rounded-lg border border-yellow-500/40 bg-yellow-50 dark:bg-yellow-950/30 px-3 py-2.5 flex items-start gap-2">
      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
      <div className="text-xs text-yellow-800 dark:text-yellow-200">
        <span className="font-semibold">⚠️ Esta viagem transporta {delegationCounts.length} delegações:</span>{" "}
        <Popover>
          <PopoverTrigger asChild>
            <button className="underline underline-offset-2 hover:text-yellow-900 dark:hover:text-yellow-100">
              {names.join(", ")}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <ul className="space-y-1">
              {delegationCounts.map(d => (
                <li key={d.name} className="flex justify-between text-xs">
                  <span className="truncate mr-2">{d.name}</span>
                  <span className="font-semibold text-muted-foreground">{d.count}</span>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
