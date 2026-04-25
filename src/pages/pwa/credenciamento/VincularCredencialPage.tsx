import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScanLine, CheckCircle, Search, Loader2, User, IdCard, Link as LinkIcon, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import QrCodeScanner from "@/components/pwa/QrCodeScanner";
import { resolveQrCredential, extractCandidates, type ResolvedCredential } from "@/lib/resolveQrCredential";
import { searchParticipantsByNameOrCpf, type ParticipantManualSearchRow } from "@/lib/participantManualSearch";
import { useAuth } from "@/hooks/useAuth";
import { useEventContext } from "@/contexts/EventContext";
import { usePwaAudit } from "@/hooks/usePwaAudit";

export default function VincularCredencialPage() {
  useAuth();
  const { activeEventId } = useEventContext();
  usePwaAudit("credenciamento/vincular");

  const [scannerOpen, setScannerOpen] = useState(false);
  const [participantScannerOpen, setParticipantScannerOpen] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ResolvedCredential | null>(null);
  const [currentOwner, setCurrentOwner] = useState<{ name: string; id: string } | null>(null);
  
  const [manualQuery, setManualQuery] = useState("");
  const [debouncedManual, setDebouncedManual] = useState("");
  const [manualHits, setManualHits] = useState<ParticipantManualSearchRow[]>([]);
  const [manualSearching, setManualSearching] = useState(false);
  
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedManual(manualQuery.trim()), 320);
    return () => clearTimeout(t);
  }, [manualQuery]);

  useEffect(() => {
    if (!activeEventId || debouncedManual.length < 2) {
      setManualHits([]);
      setManualSearching(false);
      return;
    }
    let cancelled = false;
    setManualSearching(true);
    void searchParticipantsByNameOrCpf(debouncedManual, activeEventId)
      .then((rows) => {
        if (!cancelled) setManualHits(rows);
      })
      .finally(() => {
        if (!cancelled) setManualSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedManual, activeEventId]);

  const handleScan = async (rawValue: string) => {
    setScannerOpen(false);
    if (!rawValue.trim()) return;

    const { values } = extractCandidates(rawValue);
    const code = values[0]; 
    
    if (!code) {
      toast.error("Código inválido");
      return;
    }

    setScannedCode(code);
    
    try {
      const res = await resolveQrCredential(rawValue, { eventId: activeEventId });
      setResolved(res);
      if (res) {
        setCurrentOwner({ name: res.full_name || "Sem nome", id: res.participant_id });
        if (res.source === "cpf") {
          toast.success(`CPF de ${res.full_name} identificado!`);
        } else {
          toast.info(`Este código já pertence a: ${res.full_name}`);
        }
      } else {
        setCurrentOwner(null);
        toast.success("Código disponível para vínculo!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao verificar código");
    }
  };

  const handleParticipantScan = async (rawValue: string) => {
    setParticipantScannerOpen(false);
    if (!rawValue.trim() || !activeEventId) return;

    try {
      setManualSearching(true);
      const res = await resolveQrCredential(rawValue, { eventId: activeEventId });
      
      if (res && res.participant_id) {
        // Encontrou o participante via QR (pode ser CPF ou Token do sistema)
        await handleLink({
          participant_id: res.participant_id,
          full_name: res.full_name || "Participante identificado",
          person_id: "",
          cpf: "",
          participant_type: ""
        });
      } else {
        // Tenta buscar por CPF se for apenas dígitos
        const { cpfDigits } = extractCandidates(rawValue);
        if (cpfDigits) {
          setManualQuery(cpfDigits);
          toast.info("Pesquisando pelo CPF extraído...");
        } else {
          toast.error("Não foi possível identificar o participante por este QR Code");
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao identificar participante");
    } finally {
      setManualSearching(false);
    }
  };

  const handleReset = () => {
    setScannedCode(null);
    setResolved(null);
    setCurrentOwner(null);
    setManualQuery("");
  };

  const handleLink = async (participant: ParticipantManualSearchRow) => {
    if (!scannedCode || !activeEventId) return;
    
    setLinking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { error } = await supabase
        .from("external_credentials")
        .upsert({
          credential_code: scannedCode,
          participant_id: participant.participant_id,
          event_id: activeEventId,
          status: "active",
          linked_by_user_id: session?.user.id || null,
          linked_at: new Date().toISOString()
        }, {
          onConflict: "credential_code"
        });

      if (error) throw error;

      toast.success("Credencial vinculada com sucesso!");
      handleReset();
    } catch (err: any) {
      toast.error(`Erro ao vincular: ${err.message}`);
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />
      <PwaHeader
        title="Vincular Credencial"
        icon={IdCard}
        backTo="/pwa"
      />

      <main className="relative mx-auto max-w-md space-y-6 p-4">
        {!scannedCode ? (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ScanLine className="h-8 w-8" />
              </div>
              <h2 className="text-lg font-bold">Passo 1: Escanear</h2>
              <p className="text-sm text-muted-foreground">Escaneie o QR Code da credencial física (ex: pulseira ou cartão)</p>
            </div>
            
            <Button 
              variant="module" 
              className="h-16 w-full rounded-2xl text-lg font-bold shadow-app-lg" 
              onClick={() => setScannerOpen(true)}
            >
              <ScanLine className="mr-3 h-6 w-6" />
              Escanear Credencial
            </Button>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <Card className="border-primary/20 bg-primary/5 shadow-app-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-primary text-primary-foreground p-2 rounded-lg">
                    <IdCard className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-primary/70 tracking-wider">Código Escaneado</p>
                    <p className="text-lg font-mono font-bold">{scannedCode}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={handleReset}>
                  <RefreshCcw className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            {resolved?.source === "cpf" ? (
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 space-y-3 text-center animate-in zoom-in-95 duration-300">
                <div className="flex flex-col items-center gap-1">
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Pessoa encontrada via CPF</p>
                  <p className="text-xl font-black text-blue-900 dark:text-blue-100">{resolved.full_name}</p>
                </div>
                
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl h-14 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                  onClick={() => void handleLink({ 
                    participant_id: resolved.participant_id, 
                    full_name: resolved.full_name || "", 
                    person_id: "", 
                    cpf: scannedCode,
                    participant_type: "" 
                  })}
                  disabled={linking}
                >
                  <LinkIcon className="mr-2 h-5 w-5" />
                  Confirmar Vínculo
                </Button>
                <p className="text-xs text-blue-700/70 dark:text-blue-400/70 italic">
                  O CPF será usado como o código da credencial para garantir o rastreio.
                </p>
              </div>
            ) : currentOwner ? (
              <div className="rounded-xl bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 p-4 space-y-2 text-center animate-in zoom-in-95 duration-300">
                <p className="text-sm font-medium text-orange-800 dark:text-orange-300 flex items-center justify-center gap-2">
                  <User className="h-4 w-4" /> Código já vinculado a:
                </p>
                <p className="font-bold text-orange-900 dark:text-orange-100">{currentOwner.name}</p>
                <p className="text-xs text-orange-700 dark:text-orange-400">Vincular a outra pessoa irá transferir este código.</p>
              </div>
            ) : (
              <div className="rounded-xl bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 p-4 flex items-center justify-center gap-2 text-green-700 dark:text-green-300 animate-in zoom-in-95 duration-300">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm font-medium text-green-800 dark:text-green-200">Código disponível para vínculo</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="text-center space-y-1">
                <h2 className="text-lg font-bold">Passo 2: Quem é o dono?</h2>
                <p className="text-sm text-muted-foreground">Busque o participante pelo nome ou CPF</p>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou CPF…"
                  value={manualQuery}
                  onChange={(e) => setManualQuery(e.target.value)}
                  className="h-12 border-border/80 bg-card/90 pl-10 shadow-app-sm rounded-xl"
                  autoFocus
                />
              </div>

              <div className="min-h-[200px]">
                {manualSearching ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground space-y-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-sm">Pesquisando participante...</span>
                  </div>
                ) : manualHits.length > 0 ? (
                  <div className="grid gap-3">
                    {manualHits.map((h) => (
                      <button
                        key={h.participant_id}
                        type="button"
                        onClick={() => void handleLink(h)}
                        disabled={linking}
                        className="group flex items-center gap-4 rounded-2xl border bg-card p-4 text-left shadow-app-sm transition-all hover:border-primary/30 hover:shadow-app-md active:scale-[0.98] disabled:opacity-50"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          <User className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-base font-bold text-foreground">{h.full_name}</p>
                          <p className="truncate text-xs text-muted-foreground">{h.participant_type}</p>
                        </div>
                        <div className="bg-primary/5 text-primary p-2 rounded-xl group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                          <LinkIcon className="h-5 w-5" />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : debouncedManual.length >= 2 ? (
                  <div className="text-center py-10 bg-muted/30 rounded-2xl border-2 border-dashed border-muted">
                    <p className="text-muted-foreground font-medium">Nenhum participante encontrado.</p>
                  </div>
                ) : (
                  <div className="text-center py-10 text-muted-foreground">
                    <p className="text-sm">Os resultados aparecerão aqui.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <QrCodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        title="Escanear Credencial Física"
      />
      
      {linking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-lg font-bold">Vinculando...</p>
          </div>
        </div>
      )}
    </div>
  );
}