import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  RefreshCw, CheckCircle2, XCircle, AlertTriangle, Trash2, Download,
  Cloud, CloudOff, GitCommit, Calendar, Globe, Database, HardDrive, Wifi, WifiOff,
} from "lucide-react";
import { getOfflineQueue, syncOfflineQueue, clearOfflineQueue, isOnline, type OfflineQueueItem } from "@/lib/offlineQueue";
import { toast } from "sonner";
import { format } from "date-fns";

interface VersionData {
  appVersion?: string;
  environment?: string;
  branch?: string;
  commit?: string;
  commitFull?: string;
  buildDate?: string;
  supabaseProjectRef?: string;
}

interface SwState {
  supported: boolean;
  registered: boolean;
  scope?: string;
  scriptURL?: string;
  state?: string;
  updateAvailable: boolean;
  controllerActive: boolean;
}

export default function PwaStatusPage() {
  const [version, setVersion] = useState<VersionData | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [sw, setSw] = useState<SwState>({
    supported: "serviceWorker" in navigator,
    registered: false,
    updateAvailable: false,
    controllerActive: !!navigator.serviceWorker?.controller,
  });
  const [online, setOnline] = useState(isOnline());
  const [queue, setQueue] = useState<OfflineQueueItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [storageEstimate, setStorageEstimate] = useState<{ usage?: number; quota?: number } | null>(null);

  const loadVersion = () => {
    fetch("/version.json?t=" + Date.now())
      .then((r) => {
        if (!r.ok) throw new Error("Falha ao carregar version.json");
        return r.json();
      })
      .then((d) => { setVersion(d); setVersionError(null); })
      .catch((e) => setVersionError(e.message));
  };

  const refreshSwInfo = async () => {
    if (!("serviceWorker" in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        setSw((s) => ({ ...s, registered: false }));
        return;
      }
      const active = reg.active;
      setSw({
        supported: true,
        registered: true,
        scope: reg.scope,
        scriptURL: active?.scriptURL,
        state: active?.state,
        updateAvailable: !!reg.waiting,
        controllerActive: !!navigator.serviceWorker.controller,
      });
    } catch (e) {
      console.error("SW info error", e);
    }
  };

  const refreshStorage = async () => {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      setStorageEstimate({ usage: est.usage, quota: est.quota });
    }
  };

  const refreshAll = () => {
    loadVersion();
    refreshSwInfo();
    refreshStorage();
    setQueue(getOfflineQueue());
    setOnline(isOnline());
  };

  useEffect(() => {
    refreshAll();
    const onlineHandler = () => setOnline(true);
    const offlineHandler = () => setOnline(false);
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    const interval = setInterval(() => {
      setQueue(getOfflineQueue());
    }, 5000);
    return () => {
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
      clearInterval(interval);
    };
  }, []);

  const handleUpdateSw = async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return toast.error("Nenhum service worker registrado.");
    await reg.update();
    toast.success("Verificação de atualização disparada.");
    setTimeout(refreshSwInfo, 1500);
  };

  const handleUnregisterSw = async () => {
    if (!confirm("Remover o service worker? Será re-registrado na próxima carga.")) return;
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    toast.success("Service worker removido.");
    setTimeout(refreshSwInfo, 500);
  };

  const handleClearCaches = async () => {
    if (!confirm("Limpar todos os caches do navegador? Os arquivos serão re-baixados.")) return;
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    toast.success("Caches limpos.");
    refreshStorage();
  };

  const handleSync = async () => {
    if (!online) return toast.error("Você está offline.");
    setIsSyncing(true);
    try {
      const result = await syncOfflineQueue();
      setQueue(getOfflineQueue());
      if (result.count > 0) toast.success(`${result.count} item(s) sincronizado(s).`);
      if (result.errors) toast.error(`${result.errors} erro(s) ao sincronizar.`);
      if (result.count === 0 && !result.errors) toast.info("Fila vazia.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearQueue = () => {
    if (!confirm(`Descartar ${queue.length} item(s) da fila offline? Esta ação é irreversível.`)) return;
    clearOfflineQueue();
    setQueue([]);
    toast.success("Fila offline descartada.");
  };

  const exportLogs = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      version,
      serviceWorker: sw,
      online,
      storage: storageEstimate,
      queue,
      userAgent: navigator.userAgent,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pwa-status-${format(new Date(), "yyyyMMdd-HHmmss")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return "—";
    const units = ["B", "KB", "MB", "GB"];
    let v = bytes; let i = 0;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(1)} ${units[i]}`;
  };

  const usagePct = storageEstimate?.usage && storageEstimate?.quota
    ? Math.round((storageEstimate.usage / storageEstimate.quota) * 100)
    : 0;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Status do PWA</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Service worker, versão do build e logs de sincronização offline.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refreshAll}>
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportLogs}>
            <Download className="mr-2 h-4 w-4" /> Exportar JSON
          </Button>
        </div>
      </div>

      {/* Version */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GitCommit className="h-4 w-4" /> Versão do Build
          </CardTitle>
        </CardHeader>
        <CardContent>
          {versionError ? (
            <div className="p-3 bg-destructive/10 text-destructive rounded text-sm border border-destructive/20">
              {versionError}
            </div>
          ) : !version ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Database className="h-3 w-3" /> Versão</p>
                <p className="text-sm font-semibold">{version.appVersion || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Globe className="h-3 w-3" /> Ambiente</p>
                <p className="text-sm font-semibold uppercase">{version.environment || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5"><GitCommit className="h-3 w-3" /> Commit</p>
                <p className="text-sm font-mono">{version.commit || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Build</p>
                <p className="text-sm">{version.buildDate ? new Date(version.buildDate).toLocaleString("pt-BR") : "—"}</p>
              </div>
              <div className="col-span-2 md:col-span-4">
                <p className="text-xs text-muted-foreground">Branch</p>
                <p className="text-xs font-mono break-all">{version.branch || "—"}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Service Worker */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="h-4 w-4" /> Service Worker
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!sw.supported ? (
            <div className="flex items-center gap-2 p-3 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 text-sm">
              <AlertTriangle className="h-4 w-4" /> Service Worker não suportado neste navegador.
            </div>
          ) : !sw.registered ? (
            <div className="flex items-center gap-2 p-3 rounded bg-muted text-muted-foreground border text-sm">
              <CloudOff className="h-4 w-4" /> Nenhum service worker registrado.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <Badge variant={sw.state === "activated" ? "default" : "secondary"} className="gap-1">
                    {sw.state === "activated" ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                    {sw.state || "desconhecido"}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Controller</p>
                  <Badge variant={sw.controllerActive ? "default" : "outline"} className="gap-1">
                    {sw.controllerActive ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {sw.controllerActive ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Scope</p>
                  <p className="text-xs font-mono break-all">{sw.scope || "—"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Script</p>
                  <p className="text-xs font-mono break-all">{sw.scriptURL || "—"}</p>
                </div>
              </div>

              {sw.updateAvailable && (
                <div className="flex items-center gap-2 p-3 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20 text-sm">
                  <AlertTriangle className="h-4 w-4" /> Nova versão aguardando ativação. Recarregue a página.
                </div>
              )}
            </>
          )}

          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button size="sm" variant="outline" onClick={handleUpdateSw} disabled={!sw.registered}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Verificar atualização
            </Button>
            <Button size="sm" variant="outline" onClick={handleClearCaches}>
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Limpar caches
            </Button>
            <Button size="sm" variant="destructive" onClick={handleUnregisterSw} disabled={!sw.registered}>
              <XCircle className="mr-2 h-3.5 w-3.5" /> Remover service worker
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Connectivity & Storage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {online ? <Wifi className="h-4 w-4 text-green-600" /> : <WifiOff className="h-4 w-4 text-amber-600" />}
              Conectividade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={online ? "default" : "secondary"} className={online ? "" : "bg-amber-500/20 text-amber-700"}>
              {online ? "Online" : "Offline"}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2 break-all">{navigator.userAgent}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <HardDrive className="h-4 w-4" /> Armazenamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {storageEstimate ? (
              <>
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-semibold">{formatBytes(storageEstimate.usage)}</p>
                  <p className="text-xs text-muted-foreground">de {formatBytes(storageEstimate.quota)}</p>
                </div>
                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${usagePct}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{usagePct}% utilizado</p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">API de armazenamento indisponível.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Offline Sync Queue */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <CloudOff className="h-4 w-4" /> Fila de Sincronização Offline
            <Badge variant="secondary" className="ml-2">{queue.length}</Badge>
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleSync} disabled={!online || isSyncing || queue.length === 0}>
              <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              Sincronizar
            </Button>
            <Button size="sm" variant="destructive" onClick={handleClearQueue} disabled={queue.length === 0}>
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Descartar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-600/60" />
              <p className="text-sm">Nenhum item pendente de sincronização.</p>
            </div>
          ) : (
            <div className="rounded border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Módulo</TableHead>
                    <TableHead>Participante</TableHead>
                    <TableHead>Capturado em</TableHead>
                    <TableHead className="font-mono text-xs">ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queue.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{item.module}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{item.participantName || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(item.timestamp), "dd/MM/yyyy HH:mm:ss")}
                      </TableCell>
                      <TableCell className="font-mono text-[10px] text-muted-foreground truncate max-w-[120px]">
                        {item.id}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
