import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Map } from "lucide-react";
import { findSystemItemByRoute, getStatusMeta } from "@/lib/systemMapHelpers";
import { BackButton } from "@/components/navigation/BackButton";

interface ModuleHeaderProps {
  route: string;
  /** Override title (optional) */
  title?: string;
  /** Extra content on the right side */
  actions?: React.ReactNode;
  /** Hide the smart Back button (default: false) */
  hideBack?: boolean;
  /** Override the Back button fallback destination */
  backFallbackTo?: string;
}

export default function ModuleHeader({
  route,
  title,
  actions,
  hideBack = false,
  backFallbackTo,
}: ModuleHeaderProps) {
  const item = findSystemItemByRoute(route);
  if (!item) return null;

  const meta = getStatusMeta(item.status);

  return (
    <div className="flex flex-col gap-2 mb-6">
      {!hideBack && (
        <div className="flex items-center">
          <BackButton fallbackTo={backFallbackTo} />
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{title || item.label}</h1>
            <Badge variant="outline" className={`${meta.color} text-xs`}>
              {meta.emoji} {meta.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">{item.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {actions}
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link to={`/admin/mapa?route=${encodeURIComponent(route)}`}>
              <Map className="mr-1.5 h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ver no Mapa</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
