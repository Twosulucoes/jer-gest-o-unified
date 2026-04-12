import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Plus, Copy, ExternalLink, Eye, Loader2, Search } from "lucide-react";
import ModuleHeader from "@/components/admin/ModuleHeader";

const BASE_URL = "https://adm.jers.com.br";

const KIND_LABELS: Record<string, string> = {
  external_link: "Link Externo",
  public_page: "Página Pública",
  redirect: "Redirect",
};

export default function LinksPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const { data: items, isLoading } = useQuery({
    queryKey: ["public_content"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_content")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("public_content").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["public_content"] });
      toast.success("Status atualizado");
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  const copyLink = (item: { kind: string; slug: string }) => {
    const path = item.kind === "public_page" ? `/p/${item.slug}` : `/go/${item.slug}`;
    navigator.clipboard.writeText(`${BASE_URL}${path}`);
    toast.success("Link copiado!");
  };

  const filtered = (items || []).filter((item) => {
    if (kindFilter !== "all" && item.kind !== kindFilter) return false;
    if (activeFilter !== "all" && String(item.active) !== activeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!item.title.toLowerCase().includes(q) && !item.slug.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Links & Páginas Públicas"
        description="Gerencie links externos, redirects e páginas públicas do sistema."
      />

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar título ou slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-56"
            />
          </div>
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="external_link">Link Externo</SelectItem>
              <SelectItem value="public_page">Página Pública</SelectItem>
              <SelectItem value="redirect">Redirect</SelectItem>
            </SelectContent>
          </Select>
          <Select value={activeFilter} onValueChange={setActiveFilter}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="true">Ativo</SelectItem>
              <SelectItem value="false">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => navigate("/admin/links/novo")} className="gap-2">
          <Plus className="h-4 w-4" /> Novo
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhum item encontrado.</div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Visibilidade</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {KIND_LABELS[item.kind] || item.kind}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{item.title}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{item.slug}</TableCell>
                  <TableCell>
                    <Badge variant={item.visibility === "public" ? "default" : "secondary"} className="text-xs">
                      {item.visibility}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={item.active}
                      onCheckedChange={(checked) => toggleActive.mutate({ id: item.id, active: checked })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => copyLink(item)} title="Copiar link">
                        <Copy className="h-4 w-4" />
                      </Button>
                      {item.kind === "public_page" && (
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/links/preview/${item.id}`)} title="Preview">
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/links/${item.id}`)} title="Editar">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
