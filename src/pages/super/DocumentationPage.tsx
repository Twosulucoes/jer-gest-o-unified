import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { 
  ChevronRight, 
  FileText, 
  Search, 
  Menu, 
  X, 
  ArrowLeft,
  ExternalLink,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

// Vite's import.meta.glob to find all .md files in the project
// excluding node_modules and some other system directories if needed
const allMdFiles = import.meta.glob([
  "/**/*.md", 
  "!**/node_modules/**",
  "!**/dist/**",
  "!**/public/**", // We don't want to scan public as documentation unless specified
], { 
  query: '?raw', 
  import: 'default',
  eager: true 
}) as Record<string, string>;

export default function DocumentationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  
  // Parse the current file from the URL hash or query param
  const queryParams = new URLSearchParams(location.search);
  const currentFilePath = queryParams.get("path") || "/README.md";

  // Filter and format the list of files
  const docFiles = useMemo(() => {
    return Object.keys(allMdFiles)
      .map(path => {
        // Clean path: remove leading / if it's there
        const cleanPath = path.startsWith("/") ? path : `/${path}`;
        const parts = cleanPath.split("/");
        const name = parts[parts.length - 1];
        const dir = parts.slice(0, parts.length - 1).join("/") || "/";
        
        return {
          path: cleanPath,
          name,
          dir,
          content: allMdFiles[path] || ""
        };
      })
      .sort((a, b) => {
        // Sort by directory first, then by name
        if (a.dir !== b.dir) return a.dir.localeCompare(b.dir);
        return a.name.localeCompare(b.name);
      });
  }, []);

  const filteredFiles = useMemo(() => {
    if (!searchQuery) return docFiles;
    const query = searchQuery.toLowerCase();
    return docFiles.filter(f => 
      f.name.toLowerCase().includes(query) || 
      f.path.toLowerCase().includes(query) ||
      f.content.toLowerCase().includes(query)
    );
  }, [docFiles, searchQuery]);

  const currentFile = useMemo(() => {
    return docFiles.find(f => f.path === currentFilePath) || docFiles.find(f => f.path.endsWith(currentFilePath));
  }, [docFiles, currentFilePath]);

  // Log audit event when a document is opened
  useEffect(() => {
    if (currentFile && user) {
      const logAudit = async () => {
        try {
          await supabase.from("audit_events").insert({
            action: "VIEW_DOCUMENTATION",
            table_name: "documentation",
            record_id: currentFile.path,
            payload: {
              path: currentFile.path,
              name: currentFile.name
            },
            created_by: user.id
          });
        } catch (error) {
          console.error("Error logging documentation audit:", error);
        }
      };
      logAudit();
    }
  }, [currentFile, user]);

  useEffect(() => {
    // Simulate loading for better UX transition
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, [currentFilePath]);

  // Group files by directory for the sidebar
  const groupedFiles = useMemo(() => {
    const groups: Record<string, typeof docFiles> = {};
    filteredFiles.forEach(file => {
      if (!groups[file.dir]) groups[file.dir] = [];
      groups[file.dir].push(file);
    });
    return groups;
  }, [filteredFiles]);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const href = e.currentTarget.getAttribute("href");
    
    // Check if it's an internal .md link
    if (href && (href.endsWith(".md") || href.includes(".md#"))) {
      e.preventDefault();
      
      // Handle relative paths
      let targetPath = href;
      if (!href.startsWith("/")) {
        // Resolve relative to current file dir
        const currentDir = currentFile?.dir || "/";
        targetPath = `${currentDir}/${href}`.replace(/\/+/g, "/");
      }
      
      // Clean target path (remove ./ etc)
      targetPath = targetPath.replace(/\/\.\//g, "/");
      
      navigate(`?path=${encodeURIComponent(targetPath)}`);
      window.scrollTo(0, 0);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-4 w-full">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      );
    }

    if (!currentFile) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Info className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold">Documento não encontrado</h2>
          <p className="text-muted-foreground mt-2">
            O arquivo <code className="bg-muted px-1 rounded">{currentFilePath}</code> não foi localizado no repositório.
          </p>
          <Button 
            variant="outline" 
            className="mt-6"
            onClick={() => navigate("?path=/README.md")}
          >
            Voltar para o README
          </Button>
        </div>
      );
    }

    // Pre-process content to handle image paths
    // Strategy: if it's a local image path, we expect it to be in /public/docs-assets/
    // but the user might use relative paths in .md. 
    // For now, we follow the "absolute path in /public/docs-assets/" decision.
    const processedContent = currentFile.content;

    return (
      <article className="prose prose-slate dark:prose-invert max-w-none prose-pre:bg-muted prose-pre:text-muted-foreground prose-a:text-primary hover:prose-a:underline">
        <div className="mb-8 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link to="/super" className="hover:text-primary">Super Admin</Link>
            <ChevronRight className="h-4 w-4" />
            <span className="font-medium text-foreground">Documentação Técnica</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-0">
            {currentFile.name}
          </h1>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono text-[10px]">
              {currentFile.path}
            </Badge>
          </div>
        </div>
        
        <Separator className="my-6" />
        
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ node, ...props }) => (
              <a 
                {...props} 
                onClick={(e) => {
                  const href = props.href;
                  if (href && !href.startsWith("http") && !href.startsWith("mailto") && !href.startsWith("#")) {
                    handleLinkClick(e as any);
                  }
                }}
                target={props.href?.startsWith("http") ? "_blank" : undefined}
                rel={props.href?.startsWith("http") ? "noopener noreferrer" : undefined}
              >
                {props.children}
                {props.href?.startsWith("http") && <ExternalLink className="inline-block h-3 w-3 ml-1" />}
              </a>
            ),
            img: ({ node, ...props }) => {
              // Handle image paths
              let src = props.src || "";
              if (src && !src.startsWith("http") && !src.startsWith("/")) {
                // If it's a relative path, we check if it's meant to be in /docs-assets/
                // As per Decision 4: "estratégia futura para imagens em /public/docs-assets/"
                src = `/docs-assets/${src}`;
              }
              return (
                <img 
                  {...props} 
                  src={src} 
                  className="rounded-lg border shadow-sm mx-auto my-8" 
                  alt={props.alt || "Imagem de documentação"}
                />
              );
            }
          }}
        >
          {processedContent}
        </ReactMarkdown>
        
        <div className="mt-16 pt-8 border-t text-sm text-muted-foreground">
          <p>
            Esta documentação é gerada automaticamente a partir dos arquivos .md do projeto.
            Alterações exigem um novo deploy para serem refletidas aqui.
          </p>
        </div>
      </article>
    );
  };

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-background">
      {/* Mobile sidebar toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed bottom-4 right-4 z-50 md:hidden bg-primary text-primary-foreground rounded-full shadow-lg"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        {isSidebarOpen ? <X /> : <Menu />}
      </Button>

      {/* Sidebar */}
      <aside 
        className={cn(
          "w-80 border-r bg-muted/30 flex flex-col transition-all duration-300 z-40",
          !isSidebarOpen && "md:-ml-80",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="p-4 border-b space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documentos
            </h2>
            <Badge variant="outline" className="font-normal">
              {docFiles.length} arquivos
            </Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar na doc..."
              className="pl-8 bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-6">
            {Object.entries(groupedFiles).map(([dir, files]) => (
              <div key={dir} className="space-y-1">
                <h3 className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {dir === "/" ? "Raiz do Projeto" : dir.replace(/^\//, "")}
                </h3>
                {files.map(file => (
                  <button
                    key={file.path}
                    onClick={() => {
                      navigate(`?path=${encodeURIComponent(file.path)}`);
                      if (window.innerWidth < 768) setIsSidebarOpen(false);
                      window.scrollTo(0, 0);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors text-left",
                      currentFilePath === file.path 
                        ? "bg-primary/10 text-primary font-medium" 
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </button>
                ))}
              </div>
            ))}
            
            {docFiles.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Nenhum arquivo .md encontrado.
              </div>
            )}
            
            {searchQuery && filteredFiles.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Nenhum resultado para "{searchQuery}"
              </div>
            )}
          </div>
        </ScrollArea>
        
        <div className="p-4 border-t bg-muted/50">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-start text-xs text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/super")}
          >
            <ArrowLeft className="h-3 w-3 mr-2" />
            Voltar ao Painel Super
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-10 md:px-10 lg:px-12">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
