import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gavel, FileText, Paperclip } from "lucide-react";
import { PwaHeader } from "@/components/pwa/PwaHeader";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DelegacaoProtestoDetalhePage() {
  const { id } = useParams();
  const [protest, setProtest] = useState<any>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [p, a, au] = await Promise.all([
        supabase.from("protests").select("*").eq("id", id).maybeSingle(),
        supabase.from("protest_attachments").select("*").eq("protest_id", id),
        supabase.from("protest_audit_log").select("*").eq("protest_id", id).order("performed_at", { ascending: false }),
      ]);
      setProtest(p.data);
      setAttachments(a.data ?? []);
      setAudit(au.data ?? []);
    })();
  }, [id]);

  const downloadFile = async (path: string, name: string) => {
    const { data } = await supabase.storage.from("protestos").createSignedUrl(path, 60);
    if (data?.signedUrl) {
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = name;
      a.click();
    }
  };

  if (!protest) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="min-h-screen bg-background">
      <PwaHeader title={protest.protocol_number} icon={Gavel} backTo="/pwa/delegacao/protestos" />

      <main className="p-4 max-w-md mx-auto space-y-3">
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge>{protest.status}</Badge>
              </div>
              {protest.decision && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Decisão</p>
                  <Badge variant="outline" className="uppercase">{protest.decision}</Badge>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Protocolado em {format(new Date(protest.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">FUNDAMENTAÇÃO</p>
              <p className="text-sm whitespace-pre-wrap">{protest.fundamentation}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">PEDIDO</p>
              <p className="text-sm whitespace-pre-wrap">{protest.request}</p>
            </div>
            {protest.decision_reason && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground">FUNDAMENTAÇÃO DA DECISÃO</p>
                <p className="text-sm whitespace-pre-wrap">{protest.decision_reason}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {attachments.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Paperclip className="h-3 w-3" /> ANEXOS</p>
              {attachments.map((a) => (
                <button key={a.id} onClick={() => downloadFile(a.storage_path, a.file_name)} className="flex items-center gap-2 text-sm text-primary hover:underline w-full text-left">
                  <FileText className="h-4 w-4" /> {a.file_name}
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {audit.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">HISTÓRICO</p>
              {audit.map((a) => (
                <div key={a.id} className="text-xs border-l-2 border-muted pl-2">
                  <p className="font-medium">{a.action}</p>
                  <p className="text-muted-foreground">{format(new Date(a.performed_at), "dd/MM HH:mm", { locale: ptBR })}</p>
                  {a.notes && <p className="italic">{a.notes}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
