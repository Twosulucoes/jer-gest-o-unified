import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Paperclip, Upload, Trash2, Download, AlertCircle, FileText, Image as ImageIcon, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { MatchConfig } from "./MatchConfigEditor";

interface MatchAttachmentsCardProps {
  matchId: string;
  eventId: string;
  matchConfig: MatchConfig;
  canWrite: boolean;
}

const FILE_TYPE_ICON: Record<string, typeof FileText> = {
  pdf: FileText,
  image: ImageIcon,
};

const getFileCategory = (fileName: string): string => {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "other";
};

export default function MatchAttachmentsCard({
  matchId,
  eventId,
  matchConfig,
  canWrite,
}: MatchAttachmentsCardProps) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  const requiresAttachments = !!matchConfig.requires_attachments;

  const { data: attachments = [] } = useQuery({
    queryKey: ["match_attachments", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_attachments" as any)
        .select("*")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const handleUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const storagePath = `${eventId}/${matchId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("match-attachments")
        .upload(storagePath, file, { upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("match-attachments")
        .getPublicUrl(storagePath);

      const { error: insertError } = await supabase
        .from("match_attachments" as any)
        .insert({
          match_id: matchId,
          file_url: urlData.publicUrl,
          file_type: getFileCategory(file.name),
          file_name: file.name,
          notes: notes.trim() || null,
          uploaded_by: user.id,
        });
      if (insertError) throw insertError;

      qc.invalidateQueries({ queryKey: ["match_attachments", matchId] });
      toast.success("Anexo enviado com sucesso");
      setNotes("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      toast.error("Erro ao enviar anexo: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const deleteMut = useMutation({
    mutationFn: async (attachment: any) => {
      // Extract storage path from URL
      const url = attachment.file_url as string;
      const bucketBase = "/match-attachments/";
      const pathIdx = url.indexOf(bucketBase);
      if (pathIdx >= 0) {
        const storagePath = url.substring(pathIdx + bucketBase.length);
        await supabase.storage.from("match-attachments").remove([storagePath]);
      }
      const { error } = await supabase
        .from("match_attachments" as any)
        .delete()
        .eq("id", attachment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["match_attachments", matchId] });
      toast.success("Anexo removido");
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const IconForType = (type: string) => FILE_TYPE_ICON[type] ?? File;

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Paperclip className="h-4 w-4" />Anexos e evidências
          {requiresAttachments && attachments.length === 0 && (
            <Badge variant="destructive" className="text-[10px] ml-1">Obrigatório</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {requiresAttachments && attachments.length === 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Esta modalidade exige anexos obrigatórios. Faça upload de pelo menos um arquivo.
            </AlertDescription>
          </Alert>
        )}

        {/* Upload area */}
        {canWrite && (
          <div className="space-y-2 rounded-lg border border-dashed p-4 bg-muted/20">
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">Arquivo</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx"
                  disabled={uploading}
                  className="text-xs"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                  }}
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">Observação (opcional)</Label>
                <Input
                  placeholder="Ex: Súmula oficial"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={uploading}
                  className="text-xs"
                />
              </div>
            </div>
            {uploading && (
              <p className="text-xs text-muted-foreground animate-pulse">Enviando arquivo...</p>
            )}
          </div>
        )}

        {/* List */}
        {attachments.length === 0 && !canWrite ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum anexo registrado.</p>
        ) : attachments.length > 0 && (
          <div className="space-y-2">
            {attachments.map((att: any) => {
              const TypeIcon = IconForType(att.file_type);
              return (
                <div key={att.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{att.file_name}</p>
                      {att.notes && <p className="text-xs text-muted-foreground truncate">{att.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                      <a href={att.file_url} target="_blank" rel="noopener noreferrer">
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    {canWrite && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => deleteMut.mutate(att)}
                        disabled={deleteMut.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
