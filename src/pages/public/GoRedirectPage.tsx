import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default function GoRedirectPage() {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = useState<"loading" | "redirecting" | "notfound" | "unsafe">("loading");
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!slug) { setState("notfound"); return; }

    supabase
      .from("public_content")
      .select("destination_url, open_in_new_tab")
      .eq("slug", slug)
      .in("kind", ["external_link", "redirect"])
      .eq("active", true)
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.destination_url) { setState("notfound"); return; }
        if (!isSafeUrl(data.destination_url)) { setState("unsafe"); return; }

        setUrl(data.destination_url);

        if (!data.open_in_new_tab) {
          window.location.replace(data.destination_url);
          return;
        }

        setState("redirecting");
        const timer = setTimeout(() => {
          window.open(data.destination_url, "_blank", "noopener,noreferrer");
        }, 800);
        return () => clearTimeout(timer);
      });
  }, [slug]);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === "notfound") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
        <h1 className="text-2xl font-bold text-foreground">Link não encontrado</h1>
        <p className="text-muted-foreground">O link solicitado não existe ou foi desativado.</p>
        <Link to="/" className="text-primary underline">Voltar ao início</Link>
      </div>
    );
  }

  if (state === "unsafe") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
        <h1 className="text-2xl font-bold text-destructive">Link bloqueado</h1>
        <p className="text-muted-foreground">Este link utiliza um protocolo não permitido.</p>
        <Link to="/" className="text-primary underline">Voltar ao início</Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-6">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-muted-foreground">Redirecionando...</p>
      <Button asChild>
        <a href={url} target="_blank" rel="noopener noreferrer" className="gap-2">
          <ExternalLink className="h-4 w-4" /> Abrir link
        </a>
      </Button>
    </div>
  );
}
