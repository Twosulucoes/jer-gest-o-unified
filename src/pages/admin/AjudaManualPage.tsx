import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Section {
  id: string;
  category: string;
  title: string;
  content_md: string;
  sort_order: number;
}

export default function AjudaManualPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any)
        .from("help_manual_sections")
        .select("id,category,title,content_md,sort_order")
        .eq("is_published", true)
        .order("category", { ascending: true })
        .order("sort_order", { ascending: true });
      if (!error) setSections((data ?? []) as Section[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.content_md.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q),
    );
  }, [sections, query]);

  const categories = useMemo(
    () => Array.from(new Set(filtered.map((s) => s.category))),
    [filtered],
  );

  const visibleCat = activeCat && categories.includes(activeCat) ? activeCat : categories[0];
  const visibleSections = filtered.filter((s) => s.category === visibleCat);

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          Manual de Instruções
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Guia completo de operação do JER's Gestão.
        </p>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar no manual…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : sections.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          O manual ainda não foi cadastrado. Procure o super administrador.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          {/* Sidebar de categorias */}
          <aside className="lg:sticky lg:top-20 self-start">
            <Card>
              <CardContent className="p-2">
                <ScrollArea className="lg:h-[calc(100vh-200px)]">
                  <nav className="space-y-1">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setActiveCat(cat)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                          cat === visibleCat
                            ? "bg-primary text-primary-foreground font-medium"
                            : "hover:bg-accent text-foreground"
                        }`}
                      >
                        {cat}
                        <Badge variant={cat === visibleCat ? "secondary" : "outline"} className="ml-2 text-[10px]">
                          {filtered.filter((s) => s.category === cat).length}
                        </Badge>
                      </button>
                    ))}
                  </nav>
                </ScrollArea>
              </CardContent>
            </Card>
          </aside>

          {/* Conteúdo */}
          <div className="space-y-4 min-w-0">
            {visibleSections.map((s) => (
              <Card key={s.id}>
                <CardContent className="pt-6">
                  <h2 className="font-heading text-xl font-bold text-primary mb-3">
                    {s.title}
                  </h2>
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-primary prose-table:text-sm prose-th:bg-muted prose-th:p-2 prose-td:p-2 prose-table:border prose-th:border prose-td:border">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {s.content_md}
                    </ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            ))}
            {visibleSections.length === 0 && (
              <Card><CardContent className="py-12 text-center text-muted-foreground">
                Nenhum resultado para "{query}".
              </CardContent></Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
