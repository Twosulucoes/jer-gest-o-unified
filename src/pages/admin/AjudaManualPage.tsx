import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Search, BookOpen, CheckCircle2, ArrowRight, Loader2, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface Section {
  id: string;
  category: string;
  title: string;
  content_md: string;
  sort_order: number;
  link_path?: string;
  action_label?: string;
}

interface ProgressRecord {
  section_id: string;
  completed: boolean;
}

export default function AjudaManualPage() {
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin") || roles.includes("super_admin");
  const [sections, setSections] = useState<Section[]>([]);
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("help_manual_sections")
      .select("id, category, title, content_md, sort_order, link_path, action_label")
      .eq("is_published", true)
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true });
    
    let fetchedSections = (data ?? []) as Section[];
    
    // Filtro de perfil para a categoria Primeiros Passos
    if (!isAdmin) {
      fetchedSections = fetchedSections.filter(s => s.category !== "0. Primeiros Passos");
    }

    setSections(fetchedSections);
    
    if (user) {
      const { data: progData, error: progError } = await supabase
        .from("admin_manual_progress")
        .select("section_id, completed")
        .eq("user_id", user.id);
      
      if (!progError && progData) {
        const progMap: Record<string, boolean> = {};
        progData.forEach((p: any) => {
          progMap[p.section_id] = p.completed;
        });
        setProgress(progMap);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const toggleComplete = async (sectionId: string, currentStatus: boolean) => {
    if (!user) return;
    setLoadingProgress(true);
    const newStatus = !currentStatus;
    
    const { error } = await supabase
      .from("admin_manual_progress")
      .upsert({
        user_id: user.id,
        section_id: sectionId,
        completed: newStatus,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,section_id' });

    if (error) {
      toast.error("Erro ao salvar progresso");
    } else {
      setProgress(prev => ({ ...prev, [sectionId]: newStatus }));
      toast.success(newStatus ? "Etapa concluída!" : "Etapa marcada como pendente");
    }
    setLoadingProgress(false);
  };

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
          Guia completo de operação do JER Gestão.
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
            {visibleCat === "0. Primeiros Passos" ? (
              <div className="space-y-6">
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-primary">Seu progresso na jornada</h3>
                      <span className="text-sm font-bold text-primary">
                        {Math.round((visibleSections.filter(s => progress[s.id]).length / visibleSections.length) * 100)}%
                      </span>
                    </div>
                    <Progress value={(visibleSections.filter(s => progress[s.id]).length / visibleSections.length) * 100} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-2">
                      {visibleSections.filter(s => progress[s.id]).length} de {visibleSections.length} etapas concluídas
                    </p>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {visibleSections.map((s) => (
                    <Card key={s.id} className={`transition-all ${progress[s.id] ? "bg-accent/30 border-primary/30" : "hover:border-primary/50"}`}>
                      <CardContent className="pt-6 flex flex-col h-full">
                        <div className="flex items-start justify-between mb-3">
                          <h2 className={`font-heading text-lg font-bold ${progress[s.id] ? "text-primary/70 line-through" : "text-primary"}`}>
                            {s.title}
                          </h2>
                          <button 
                            onClick={() => toggleComplete(s.id, !!progress[s.id])}
                            disabled={loadingProgress}
                            className={`p-1 rounded-full transition-colors ${progress[s.id] ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-accent"}`}
                          >
                            <CheckCircle2 className={`h-6 w-6 ${progress[s.id] ? "fill-primary text-white" : ""}`} />
                          </button>
                        </div>
                        <p className="text-sm text-muted-foreground mb-6 flex-1">
                          {s.content_md}
                        </p>
                        <div className="flex items-center gap-2 mt-auto">
                          {s.link_path && (
                            <Button asChild size="sm" variant={progress[s.id] ? "outline" : "default"} className="flex-1">
                              <Link to={s.link_path}>
                                {s.action_label || "Acessar"}
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              visibleSections.map((s) => (
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
              ))
            )}
            {visibleSections.length === 0 && (
              <Card><CardContent className="py-12 text-center text-muted-foreground">
                Nenhum resultado para "{query}".
              </CardContent></Card>
            )}
          </div>
        </div>
      )}
      {roles.includes("super_admin") && (
        <div className="mt-12 pt-6 border-t flex flex-col items-center gap-4 text-center">
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 max-w-2xl">
            <h4 className="font-bold text-primary flex items-center justify-center gap-2 mb-1">
              <FileText className="h-4 w-4" />
              Área Técnica (Super Admin)
            </h4>
            <p className="text-sm text-muted-foreground mb-4">
              Você tem acesso à documentação técnica do sistema, gerada diretamente dos arquivos do repositório (Docs-as-Code).
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/super/documentacao">
                Acessar Documentação Técnica
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
