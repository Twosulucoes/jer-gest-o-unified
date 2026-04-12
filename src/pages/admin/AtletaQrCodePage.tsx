import { useState, useRef } from "react";
// @ts-ignore - queryClient unused removed
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEventContext } from "@/contexts/EventContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Search, QrCode, RotateCw, XCircle, Copy, Download, Printer } from "lucide-react";
import QRCode from "qrcode";
import AppPageHeader from "@/components/app/AppPageHeader";

const BASE_URL = window.location.origin;

interface TokenResult {
  id: string;
  token: string;
  athlete_id: string;
  expires_at: string | null;
  active: boolean;
}

export default function AtletaQrCodePage() {
  const { activeEvent } = useEventContext();
  const [search, setSearch] = useState("");
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [tokenData, setTokenData] = useState<TokenResult | null>(null);
  const qrRef = useRef<HTMLImageElement>(null);

  // Search participants
  const { data: participants, isLoading: searching } = useQuery({
    queryKey: ["admin-athlete-search", activeEvent?.id, search],
    queryFn: async () => {
      if (!activeEvent?.id || search.length < 2) return [];
      const { data, error } = await supabase
        .from("participants")
        .select("id, participant_type, status, person:people!participants_person_id_fkey(full_name, gender), delegation:delegations!participants_delegation_id_fkey(institution:institutions!delegations_institution_id_fkey(name))")
        .eq("event_id", activeEvent.id)
        .eq("participant_type", "athlete")
        .limit(20);
      if (error) throw error;

      // Filter by name client-side since ilike on joined table
      const filtered = (data as any[]).filter(p =>
        p.person?.full_name?.toLowerCase().includes(search.toLowerCase())
      );
      return filtered;
    },
    enabled: !!activeEvent?.id && search.length >= 2,
  });

  const generateQr = async (token: string) => {
    const url = `${BASE_URL}/a/${token}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2 });
    setQrDataUrl(dataUrl);
  };

  const upsertMutation = useMutation({
    mutationFn: async ({ athleteId, rotate }: { athleteId: string; rotate: boolean }) => {
      const { data, error } = await supabase.rpc("admin_upsert_athlete_public_token", {
        p_athlete_id: athleteId,
        p_rotate: rotate,
      });
      if (error) throw error;
      return data as unknown as TokenResult;
    },
    onSuccess: async (data) => {
      setTokenData(data);
      await generateQr(data.token);
      toast.success(data.active ? "Token gerado!" : "Token obtido!");
    },
    onError: () => toast.error("Erro ao gerar token"),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (athleteId: string) => {
      const { error } = await supabase.rpc("admin_deactivate_athlete_public_token", {
        p_athlete_id: athleteId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTokenData(null);
      setQrDataUrl(null);
      toast.success("Token desativado!");
    },
    onError: () => toast.error("Erro ao desativar"),
  });

  const selectParticipant = (id: string) => {
    setSelectedParticipantId(id);
    setTokenData(null);
    setQrDataUrl(null);
  };

  const publicUrl = tokenData ? `${BASE_URL}/a/${tokenData.token}` : null;

  const handleCopy = async () => {
    if (publicUrl) {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Link copiado!");
    }
  };

  const handleDownload = () => {
    if (qrDataUrl) {
      const a = document.createElement("a");
      a.href = qrDataUrl;
      a.download = "qrcode-atleta.png";
      a.click();
    }
  };

  const handlePrint = () => {
    if (!qrDataUrl || !tokenData) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const selected = participants?.find(p => p.id === selectedParticipantId);
    w.document.write(`
      <html><head><title>QR Code</title></head>
      <body style="text-align:center;font-family:sans-serif;padding:40px">
        <h2>${(selected as any)?.person?.full_name ?? "Atleta"}</h2>
        <img src="${qrDataUrl}" style="width:250px;height:250px" />
        <p style="font-size:12px;color:#666">${publicUrl}</p>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-6">
      <ModuleHeader title="QR Code do Atleta" description="Gere e gerencie QR Codes públicos dos atletas" />

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buscar Atleta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do atleta..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {searching && <Skeleton className="h-12 w-full" />}

          {participants && participants.length > 0 && (
            <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
              {participants.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => selectParticipant(p.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${
                    selectedParticipantId === p.id ? "bg-primary/5 border-l-2 border-l-primary" : ""
                  }`}
                >
                  <p className="font-medium text-foreground">{p.person?.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.delegation?.institution?.name}
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      {selectedParticipantId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ações do Token</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => upsertMutation.mutate({ athleteId: selectedParticipantId, rotate: false })}
                disabled={upsertMutation.isPending}
              >
                <QrCode className="h-4 w-4 mr-2" /> Gerar / Obter QR
              </Button>
              <Button
                variant="secondary"
                onClick={() => upsertMutation.mutate({ athleteId: selectedParticipantId, rotate: true })}
                disabled={upsertMutation.isPending}
              >
                <RotateCw className="h-4 w-4 mr-2" /> Rotacionar QR
              </Button>
              <Button
                variant="destructive"
                onClick={() => deactivateMutation.mutate(selectedParticipantId)}
                disabled={deactivateMutation.isPending}
              >
                <XCircle className="h-4 w-4 mr-2" /> Desativar QR
              </Button>
            </div>

            {/* QR Result */}
            {tokenData && qrDataUrl && (
              <div className="border rounded-lg p-6 text-center space-y-4 bg-muted/30">
                <img ref={qrRef} src={qrDataUrl} alt="QR Code" className="mx-auto w-[200px] h-[200px]" />
                <div>
                  <p className="text-sm text-muted-foreground break-all">{publicUrl}</p>
                  {tokenData.expires_at && (
                    <Badge variant="secondary" className="mt-2">
                      Expira: {new Date(tokenData.expires_at).toLocaleDateString("pt-BR")}
                    </Badge>
                  )}
                </div>
                <div className="flex justify-center gap-2">
                  <Button size="sm" variant="outline" onClick={handleCopy}>
                    <Copy className="h-4 w-4 mr-1" /> Copiar
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-1" /> Baixar
                  </Button>
                  <Button size="sm" variant="outline" onClick={handlePrint}>
                    <Printer className="h-4 w-4 mr-1" /> Imprimir
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
