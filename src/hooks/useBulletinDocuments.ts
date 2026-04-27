
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BulletinDocument {
  id: string;
  event_id: string;
  stage_id: string | null;
  bulletin_type: 'daily' | 'final';
  reference_date: string | null;
  file_url: string;
  file_name: string;
  generated_by: string | null;
  generated_at: string;
  generation_trigger: 'automatic_after_publish' | 'manual';
  version: number;
  is_current: boolean;
  summary: any | null;
  created_at: string;
  updated_at: string;
}

export function useBulletinDocuments(eventId: string) {
  const queryClient = useQueryClient();

  const { data: bulletins = [], isLoading } = useQuery({
    queryKey: ["bulletin-documents", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bulletin_documents")
        .select("*")
        .eq("event_id", eventId)
        .order("generated_at", { ascending: false });
      if (error) throw error;
      return data as BulletinDocument[];
    },
    enabled: !!eventId,
  });

  const generateBulletin = useMutation({
    mutationFn: async (params: { 
      stageId?: string; 
      referenceDate?: string; 
      bulletinType: 'daily' | 'final' 
    }) => {
      // For now, we simulate the generation or call an edge function
      // In a real scenario, this would call supabase.functions.invoke('generate-bulletin', ...)
      const { data, error } = await supabase.functions.invoke('generate-bulletin', {
        body: { 
          eventId, 
          stageId: params.stageId, 
          referenceDate: params.referenceDate, 
          bulletinType: params.bulletinType,
          trigger: 'manual'
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bulletin-documents", eventId] });
      toast.success("Solicitação de geração de boletim enviada com sucesso.");
    },
    onError: (error: any) => {
      toast.error(`Erro ao gerar boletim: ${error.message}`);
    }
  });

  return {
    bulletins,
    isLoading,
    generateBulletin
  };
}
