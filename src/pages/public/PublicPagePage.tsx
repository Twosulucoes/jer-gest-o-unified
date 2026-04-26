import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { VisualIdentity } from "@/components/public/VisualIdentity";

// Simple markdown-to-HTML (headings, bold, italic, links, lists, paragraphs)
function renderMarkdown(md: string): string {
  let html = md
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-6 mb-2 text-foreground">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-8 mb-3 text-foreground">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-8 mb-4 text-foreground">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline hover:opacity-80">$1</a>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-muted-foreground">$1</li>');

  // Wrap consecutive <li> tags in <ul>
  html = html.replace(/((?:<li[^>]*>.*?<\/li>\s*)+)/g, '<ul class="my-3 space-y-1">$1</ul>');

  // Wrap remaining lines in paragraphs
  html = html
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("<h") || trimmed.startsWith("<ul") || trimmed.startsWith("<li")) return line;
      return `<p class="text-muted-foreground mb-3">${trimmed}</p>`;
    })
    .join("\n");

  return html;
}

export default function PublicPagePage() {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = useState<"loading" | "found" | "notfound" | "restricted">("loading");
  const [content, setContent] = useState<{ title: string; content_md: string } | null>(null);

  useEffect(() => {
    if (!slug) { setState("notfound"); return; }

    supabase
      .from("public_content")
      .select("title, content_md, visibility")
      .eq("slug", slug)
      .eq("kind", "public_page")
      .eq("active", true)
      .maybeSingle()
      .then(async ({ data, error }) => {
        if (!data) {
          // Could be unlisted - check if user is authenticated
          const { data: session } = await supabase.auth.getSession();
          if (session?.session) {
            // Try again as authenticated (RLS will allow unlisted)
            const { data: retryData } = await supabase
              .from("public_content")
              .select("title, content_md, visibility")
              .eq("slug", slug!)
              .eq("kind", "public_page")
              .eq("active", true)
              .maybeSingle();
            if (retryData) {
              setContent({ title: retryData.title, content_md: retryData.content_md || "" });
              setState("found");
              return;
            }
          }
          // Check if it exists but is unlisted
          if (!error) {
            setState("notfound");
          } else {
            setState("notfound");
          }
          return;
        }

        setContent({ title: data.title, content_md: data.content_md || "" });
        setState("found");
      });
  }, [slug]);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === "restricted") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
        <h1 className="text-2xl font-bold text-foreground">Página restrita</h1>
        <p className="text-muted-foreground">Esta página está disponível somente para usuários autenticados.</p>
        <Link to="/login" className="text-primary underline">Fazer login</Link>
      </div>
    );
  }

  if (state === "notfound" || !content) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
        <h1 className="text-2xl font-bold text-foreground">Página não encontrada</h1>
        <p className="text-muted-foreground">O conteúdo solicitado não existe ou foi desativado.</p>
        <Link to="/" className="text-primary underline">Voltar ao início</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content.content_md) }}
        />
        <div className="mt-12 pt-6 border-t border-border">
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary">
            ← JER Gestão
          </Link>
        </div>
      </div>
    </div>
  );
}
