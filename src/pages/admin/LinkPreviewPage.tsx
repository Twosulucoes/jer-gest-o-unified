import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

function renderMarkdown(md: string): string {
  let html = md
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-6 mb-2 text-foreground">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-8 mb-3 text-foreground">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-8 mb-4 text-foreground">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline hover:opacity-80">$1</a>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-muted-foreground">$1</li>');
  html = html.replace(/((?:<li[^>]*>.*?<\/li>\s*)+)/g, '<ul class="my-3 space-y-1">$1</ul>');
  html = html.split("\n").map((line) => {
    const t = line.trim();
    if (!t || t.startsWith("<h") || t.startsWith("<ul") || t.startsWith("<li")) return line;
    return `<p class="text-muted-foreground mb-3">${t}</p>`;
  }).join("\n");
  return html;
}

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
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(data.content_md || "") }}
        />
      </div>
    </div>
  );
}
