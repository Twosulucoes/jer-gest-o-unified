import { Wifi, WifiOff } from 'lucide-react';

interface OfflineBadgeProps {
  isOnline: boolean;
  pendingCount: number;
}

export default function OfflineBadge({ isOnline, pendingCount }: OfflineBadgeProps) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
      isOnline ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
    }`}>
      {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
      {isOnline ? 'Online' : 'Offline'}
      {pendingCount > 0 && (
        <span className="ml-1">· {pendingCount} pendente{pendingCount > 1 ? 's' : ''}</span>
      )}
    </div>
  );
}
