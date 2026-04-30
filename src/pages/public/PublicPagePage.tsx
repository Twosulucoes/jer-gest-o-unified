import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { VisualIdentity } from "@/components/public/VisualIdentity";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface PublicContent {
  title: string;
  content_md: string;
}


export default function PublicPagePage() {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = useState<"loading" | "found" | "notfound" | "restricted">("loading");
  const [content, setContent] = useState<PublicContent | null>(null);

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
      <header className="border-b bg-white px-4 py-3 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto">
          <VisualIdentity size="sm" subtitle={content.title} />
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content.content_md}
          </ReactMarkdown>
        </div>
        <div className="mt-12 pt-6 border-t border-border">
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary">
            ← JER Gestão
          </Link>
        </div>
      </div>
    </div>
  );
}
