import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAlerts, type AppNotification } from "@/hooks/useAlerts";
import { cn } from "@/lib/utils";

const TYPE_COLORS: Record<string, string> = {
  janela_abrindo:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  janela_encerrada: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  operador_inativo: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  sync_errors:      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  sistema_offline:  "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  duplicidade:      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

function NotificationItem({
  n,
  onRead,
}: {
  n: AppNotification;
  onRead: (id: string) => void;
}) {
  const colorClass =
    TYPE_COLORS[n.type] ?? "bg-muted text-muted-foreground";
  const timeAgo = formatDistanceToNow(new Date(n.created_at), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <button
      onClick={() => !n.read && onRead(n.id)}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-border/50 last:border-0 transition-colors",
        n.read
          ? "opacity-60 hover:bg-muted/30"
          : "bg-muted/20 hover:bg-muted/40",
      )}
    >
      <div className="flex items-start gap-2">
        {!n.read && (
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
        )}
        {n.read && <span className="mt-1.5 h-2 w-2 shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-foreground">
            {n.title}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
            {n.body}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", colorClass)}>
              {n.type.replace(/_/g, " ")}
            </span>
            <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

export function AlertBell() {
  const { notifications, unreadCount, loading, markAsRead, markAllRead } =
    useAlerts();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          aria-label={`Notificações${unreadCount > 0 ? ` (${unreadCount} não lidas)` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] font-bold"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 p-0 shadow-xl"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold">Notificações</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllRead}
              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas como lidas
            </Button>
          )}
        </div>

        {/* Lista */}
        <ScrollArea className="max-h-[380px]">
          {loading && (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              Carregando…
            </div>
          )}
          {!loading && notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Bell className="h-8 w-8 opacity-30" />
              <span>Nenhuma notificação</span>
            </div>
          )}
          {!loading &&
            notifications.map((n) => (
              <NotificationItem key={n.id} n={n} onRead={markAsRead} />
            ))}
        </ScrollArea>

        {notifications.length > 0 && (
          <div className="border-t border-border px-4 py-2 text-center text-xs text-muted-foreground">
            Últimas {notifications.length} notificações
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
