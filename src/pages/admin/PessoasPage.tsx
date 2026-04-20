import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Search, UserPlus, Users, Loader2, ShieldAlert, Merge } from "lucide-react";

const personSchema = z.object({
  full_name: z.string().trim().min(2, "Nome muito curto").max(200),
  birth_date: z.string().min(10, "Data obrigatória"),
  gender: z.enum(["male", "female"], { required_error: "Gênero obrigatório" }),
  cpf: z.string().trim().max(14).optional().or(z.literal("")),
  email: z.string().trim().email("E-mail inválido").max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
});

interface PersonRow {
  id: string;
  full_name: string;
  cpf: string | null;
  birth_date: string | null;
  gender: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  participants_count: number;
}

export default function PessoasPage() {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const canManage = hasRole("admin") || hasRole("secretaria") || hasRole("super_admin");

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: people = [], isLoading } = useQuery({
    queryKey: ["people-central", search],
    queryFn: async () => {
      let q = supabase
        .from("people")
        .select("id, full_name, cpf, birth_date, gender, email, phone, is_active")
        .order("full_name")
        .limit(500);
      if (search.trim().length >= 2) {
        const term = `%${search.trim()}%`;
        q = q.or(`full_name.ilike.${term},cpf.ilike.${term},email.ilike.${term}`);
      }
      const { data, error } = await q;
      if (error) throw error;

      // Conta participantes para cada pessoa retornada
      const ids = (data ?? []).map((r) => r.id);
      let counts: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: parts } = await supabase
          .from("participants")
          .select("person_id")
          .in("person_id", ids);
        (parts ?? []).forEach((p: any) => {
          counts[p.person_id] = (counts[p.person_id] ?? 0) + 1;
        });
      }
      return (data ?? []).map((r) => ({ ...r, participants_count: counts[r.id] ?? 0 })) as PersonRow[];
    },
  });

  const resetForm = () => {
    setFullName(""); setBirthDate(""); setGender(""); setCpf("");
    setEmail(""); setPhone(""); setErrors({}); setEditingId(null);
  };

  const openCreate = () => { resetForm(); setFormOpen(true); };

  const openEdit = (p: PersonRow) => {
    setEditingId(p.id);
    setFullName(p.full_name);
    setBirthDate(p.birth_date ?? "");
    setGender((p.gender as "male" | "female") ?? "");
    setCpf(p.cpf ?? "");
    setEmail(p.email ?? "");
    setPhone(p.phone ?? "");
    setErrors({});
    setFormOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parsed = personSchema.safeParse({
        full_name: fullName, birth_date: birthDate, gender,
        cpf, email, phone,
      });
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        parsed.error.errors.forEach((e) => { errs[e.path[0] as string] = e.message; });
        setErrors(errs);
        throw new Error("Validação falhou");
      }
      const payload = {
        full_name: parsed.data.full_name,
        birth_date: parsed.data.birth_date,
        gender: parsed.data.gender,
        cpf: parsed.data.cpf || null,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
      };
      if (editingId) {
        const { error } = await supabase.from("people").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("people").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editingId ? "Pessoa atualizada" : "Pessoa criada" });
      setFormOpen(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["people-central"] });
    },
    onError: (e: any) => {
      if (e.message !== "Validação falhou") {
        toast({ title: "Erro", description: e.message, variant: "destructive" });
      }
    },
  });

  if (!canManage) {
    return (
      <Card className="m-4">
        <CardContent className="flex items-center gap-2 p-6 text-muted-foreground">
          <ShieldAlert className="h-5 w-5" />
          Acesso restrito a administração e secretaria.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Users className="h-6 w-6 text-primary" /> Pessoas
          </h1>
          <p className="text-sm text-muted-foreground">
            Cadastro central de pessoas. Cada pessoa pode ter múltiplas funções em diferentes eventos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/admin/pessoas/duplicidades">
              <Merge className="mr-2 h-4 w-4" /> Duplicidades
            </Link>
          </Button>
          <Button onClick={openCreate}>
            <UserPlus className="mr-2 h-4 w-4" /> Nova pessoa
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Buscar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Nome, CPF ou e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              maxLength={100}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : people.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhuma pessoa encontrada.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Nascimento</TableHead>
                    <TableHead className="text-center">Funções</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {people.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.full_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.cpf || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.birth_date ? new Date(p.birth_date).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={p.participants_count > 0 ? "default" : "outline"}>
                          {p.participants_count}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {p.is_active
                          ? <Badge variant="secondary">Ativo</Badge>
                          : <Badge variant="outline">Inativo</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={(v) => { setFormOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar pessoa" : "Nova pessoa"}</DialogTitle>
            <DialogDescription>
              Cadastro central. Para vincular a um evento como participante, use a página de Participantes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="full_name">Nome completo *</Label>
              <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={200} />
              {errors.full_name && <p className="text-xs text-destructive mt-1">{errors.full_name}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="birth_date">Data nascimento *</Label>
                <Input id="birth_date" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                {errors.birth_date && <p className="text-xs text-destructive mt-1">{errors.birth_date}</p>}
              </div>
              <div>
                <Label htmlFor="gender">Gênero *</Label>
                <Select value={gender} onValueChange={(v) => setGender(v as "male" | "female")}>
                  <SelectTrigger id="gender"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Masculino</SelectItem>
                    <SelectItem value="female">Feminino</SelectItem>
                  </SelectContent>
                </Select>
                {errors.gender && <p className="text-xs text-destructive mt-1">{errors.gender}</p>}
              </div>
            </div>
            <div>
              <Label htmlFor="cpf">CPF</Label>
              <Input id="cpf" value={cpf} onChange={(e) => setCpf(e.target.value)} maxLength={14} placeholder="Somente números" />
              {errors.cpf && <p className="text-xs text-destructive mt-1">{errors.cpf}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
              </div>
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Salvar" : "Criar pessoa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
