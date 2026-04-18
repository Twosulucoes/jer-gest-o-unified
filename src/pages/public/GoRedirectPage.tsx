import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Loader2, LinkIcon, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    // Could be a relative path like /pwa/transporte
    return url.startsWith("/");
  }
}

export default function GoRedirectPage() {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = useState<"loading" | "redirecting" | "notfound" | "inactive" | "unsafe">("loading");
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!slug) { setState("notfound"); return; }

    supabase
      .from("public_content")
      .select("destination_url, open_in_new_tab, active")
      .eq("slug", slug)
      .in("kind", ["external_link", "redirect"])
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.destination_url) { setState("notfound"); return; }
        if (!data.active) { setState("inactive"); return; }
        if (!isSafeUrl(data.destination_url)) { setState("unsafe"); return; }

        const dest = data.destination_url;
        setUrl(dest);

        // For relative URLs (PWA module links), navigate directly
        if (dest.startsWith("/")) {
          window.location.replace(dest);
          return;
        }

        // For same-origin absolute URLs, also navigate directly
        try {
          const parsed = new URL(dest);
          if (parsed.origin === window.location.origin) {
            window.location.replace(parsed.pathname + parsed.search + parsed.hash);
            return;
          }
        } catch { /* ignore */ }

        if (!data.open_in_new_tab) {
          window.location.replace(dest);
          return;
        }

        setState("redirecting");
        const timer = setTimeout(() => {
          window.open(dest, "_blank", "noopener,noreferrer");
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4 p-6 text-center">
        <LinkIcon className="h-16 w-16 text-muted-foreground/40" />
        <h1 className="text-2xl font-bold text-foreground">Link não encontrado</h1>
        <p className="text-muted-foreground max-w-sm">O link solicitado não existe ou foi removido. Verifique o endereço ou entre em contato com a organização do evento.</p>
        <Link to="/" className="text-primary underline text-sm">Voltar ao início</Link>
      </div>
    );
  }

  if (state === "inactive") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4 p-6 text-center">
        <ShieldX className="h-16 w-16 text-muted-foreground/40" />
        <h1 className="text-2xl font-bold text-foreground">Link desativado</h1>
        <p className="text-muted-foreground max-w-sm">Este link foi desativado pela organização. Entre em contato com a coordenação do evento para obter o acesso correto.</p>
        <Link to="/" className="text-primary underline text-sm">Voltar ao início</Link>
      </div>
    );
  }

  if (state === "unsafe") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4 p-6 text-center">
        <ShieldX className="h-16 w-16 text-destructive/60" />
        <h1 className="text-2xl font-bold text-destructive">Link bloqueado</h1>
        <p className="text-muted-foreground max-w-sm">Este link utiliza um protocolo não permitido.</p>
        <Link to="/" className="text-primary underline text-sm">Voltar ao início</Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-6 p-6">
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
