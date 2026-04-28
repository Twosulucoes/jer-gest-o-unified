
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
    onError: async (error: any) => {
      console.error("Bulletin generation error:", error);
      
      let errorMessage = "Ocorreu um erro inesperado.";
      let description = error.message;

      // Se for um erro da Edge Function com corpo JSON
      if (error.context && typeof error.context.json === 'function') {
        try {
          const body = await error.context.json();
          if (body.error) errorMessage = body.error;
          if (body.details) description = body.details;
        } catch (e) {
          console.error("Failed to parse error body", e);
        }
      } else if (error.message?.includes("non-2xx")) {
        errorMessage = "Falha na validação do boletim";
        description = "A função retornou um erro. Geralmente isso ocorre quando não há resultados publicados para o período/etapa selecionada.";
      }

      toast.error(errorMessage, {
        description: description,
        duration: 5000,
      });
    }
  });

  return {
    bulletins,
    isLoading,
    generateBulletin
  };
}
