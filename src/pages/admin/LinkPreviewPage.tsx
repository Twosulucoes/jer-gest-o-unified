import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";


export default function LinkPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["public_content", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("public_content").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!data || data.kind !== "public_page") {
    return <div className="text-center py-12 text-muted-foreground">Preview disponível apenas para páginas públicas.</div>;
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/links")} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>
      <div className="mx-auto max-w-2xl rounded-lg border bg-card p-8">
        <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {data.content_md || ""}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
