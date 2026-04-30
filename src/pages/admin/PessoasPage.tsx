import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
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
import { Search, UserPlus, Users, Loader2, ShieldAlert, Merge, Filter, Download, FileSpreadsheet, Eye, Info, CheckCircle2, XCircle } from "lucide-react";
import { phoneMask } from "@/lib/phoneUtils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { exportToXLSX, timestampedName } from "@/lib/exportData";

const personSchema = z.object({
  full_name: z.string().trim().min(2, "Nome muito curto").max(200),
  birth_date: z.string().min(10, "Data obrigatória"),
  gender: z.enum(["male", "female"], { required_error: "Gênero obrigatório" }),
  cpf: z.string().trim().max(14).optional().or(z.literal("")),
  rg: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.string().trim().email("E-mail inválido").max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  is_active: z.boolean().default(true),
  food_restrictions: z.string().optional().or(z.literal("")),
  medical_notes: z.string().optional().or(z.literal("")),
  disability_type: z.string().optional().or(z.literal("")),
});

interface PersonRow {
  id: string;
  full_name: string;
  cpf: string | null;
  rg: string | null;
  birth_date: string | null;
  gender: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  participants_count: number;
  food_restrictions: string | null;
  medical_notes: string | null;
  disability_type: string | null;
}

const cpfMask = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

export default function PessoasPage() {
  const { stageId } = useParams();
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const canManage = hasRole("admin") || hasRole("secretaria") || hasRole("super_admin");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [foodRestrictions, setFoodRestrictions] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [disabilityType, setDisabilityType] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: people = [], isLoading } = useQuery({
    queryKey: ["people-central", search, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("people")
        .select("id, full_name, cpf, rg, birth_date, gender, email, phone, is_active, food_restrictions, medical_notes, disability_type")
        .order("full_name")
        .limit(300);

      if (statusFilter === "active") q = q.eq("is_active", true);
      else if (statusFilter === "inactive") q = q.eq("is_active", false);

      if (search.trim().length >= 2) {
        const term = `%${search.trim()}%`;
        q = q.or(`full_name.ilike.${term},cpf.ilike.${term},email.ilike.${term},rg.ilike.${term}`);
      }
      
      const { data, error } = await q;
      if (error) throw error;

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
    setFullName(""); setBirthDate(""); setGender(""); setCpf(""); setRg("");
    setEmail(""); setPhone(""); setIsActive(true); setFoodRestrictions("");
    setMedicalNotes(""); setDisabilityType(""); setErrors({}); setEditingId(null);
  };

  const openCreate = () => { resetForm(); setFormOpen(true); };

  const openEdit = (p: PersonRow) => {
    setEditingId(p.id);
    setFullName(p.full_name);
    setBirthDate(p.birth_date ?? "");
    setGender((p.gender as "male" | "female") ?? "");
    setCpf(p.cpf ?? "");
    setRg(p.rg ?? "");
    setEmail(p.email ?? "");
    setPhone(p.phone ?? "");
    setIsActive(p.is_active);
    setFoodRestrictions(p.food_restrictions ?? "");
    setMedicalNotes(p.medical_notes ?? "");
    setDisabilityType(p.disability_type ?? "");
    setErrors({});
    setFormOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parsed = personSchema.safeParse({
        full_name: fullName, birth_date: birthDate, gender,
        cpf, rg, email, phone, is_active: isActive,
        food_restrictions: foodRestrictions, medical_notes: medicalNotes,
        disability_type: disabilityType,
      });
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        parsed.error.errors.forEach((e) => { errs[e.path[0] as string] = e.message; });
        setErrors(errs);
        throw new Error("Validação falhou");
      }
      const payload: any = {
        full_name: parsed.data.full_name,
        birth_date: parsed.data.birth_date,
        gender: parsed.data.gender,
        cpf: parsed.data.cpf || null,
        rg: parsed.data.rg || null,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        is_active: parsed.data.is_active,
        food_restrictions: parsed.data.food_restrictions || null,
        medical_notes: parsed.data.medical_notes || null,
        disability_type: parsed.data.disability_type || null,
        kind: "participant", // Garante campo obrigatório
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

  const handleExport = () => {
    if (people.length === 0) {
      toast({ title: "Nada para exportar", variant: "destructive" });
      return;
    }
    exportToXLSX(people, [
      { header: "Nome Completo", accessor: (r) => r.full_name },
      { header: "CPF", accessor: (r) => r.cpf },
      { header: "RG", accessor: (r) => r.rg },
      { header: "Nascimento", accessor: (r) => r.birth_date },
      { header: "Gênero", accessor: (r) => r.gender === "male" ? "Masc" : "Fem" },
      { header: "E-mail", accessor: (r) => r.email },
      { header: "Telefone", accessor: (r) => r.phone },
      { header: "Status", accessor: (r) => r.is_active ? "Ativo" : "Inativo" },
      { header: "Participações", accessor: (r) => r.participants_count },
      { header: "Restrições Alimentares", accessor: (r) => r.food_restrictions },
      { header: "Notas Médicas", accessor: (r) => r.medical_notes },
      { header: "Tipo Deficiência", accessor: (r) => r.disability_type },
    ], timestampedName("central_pessoas"));
  };

  const duplicidadesLink = "/admin/pessoas/duplicidades";

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
    <div className="space-y-4 p-4 md:p-6 animate-fade-in">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Users className="h-6 w-6 text-primary" /> Central de Pessoas
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestão unificada do cadastro de participantes e equipe.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExport} disabled={isLoading || people.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Exportar
          </Button>
          <Button asChild variant="outline">
            <Link to={duplicidadesLink}>
              <Merge className="mr-2 h-4 w-4" /> Duplicidades
            </Link>
          </Button>
          <Button onClick={openCreate}>
            <UserPlus className="mr-2 h-4 w-4" /> Nova pessoa
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="md:col-span-3">
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" /> Filtros e Busca
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Nome, CPF, RG ou e-mail..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  maxLength={100}
                />
              </div>
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="active">Apenas Ativos</SelectItem>
                  <SelectItem value="inactive">Apenas Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" /> Resumo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Listados:</span>
                <span className="font-medium">{people.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Com participações:</span>
                <span className="font-medium text-primary">
                  {people.filter(p => p.participants_count > 0).length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : people.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Search className="h-10 w-10 opacity-20" />
              <p>Nenhuma pessoa encontrada com os filtros atuais.</p>
              {search && (
                <Button variant="link" onClick={() => setSearch("")}>Limpar busca</Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Nome</TableHead>
                    <TableHead>Documentos</TableHead>
                    <TableHead>Nascimento</TableHead>
                    <TableHead className="text-center">Eventos</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {people.map((p) => (
                    <TableRow key={p.id} className={!p.is_active ? "opacity-60 bg-muted/30" : ""}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{p.full_name}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">{p.email || ""}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="h-5 px-1 font-mono text-[10px]">CPF</Badge>
                          <span>{p.cpf ? cpfMask(p.cpf) : "—"}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="h-5 px-1 font-mono text-[10px]">RG</Badge>
                          <span>{p.rg || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.birth_date ? new Date(p.birth_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={p.participants_count > 0 ? "default" : "outline"} className="rounded-full h-6 w-6 p-0 flex items-center justify-center">
                          {p.participants_count}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {p.is_active
                          ? <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1"><CheckCircle2 className="h-3 w-3" /> Ativo</Badge>
                          : <Badge variant="outline" className="text-muted-foreground gap-1"><XCircle className="h-3 w-3" /> Inativo</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(p)}>
                          <Eye className="h-4 w-4" />
                        </Button>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar pessoa" : "Nova pessoa"}</DialogTitle>
            <DialogDescription>
              Informações globais do cadastro. Alterações afetam todos os eventos.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="geral" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="geral">Dados Gerais</TabsTrigger>
              <TabsTrigger value="adicional">Info Adicional</TabsTrigger>
            </TabsList>
            
            <TabsContent value="geral" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nome completo *</Label>
                  <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={200} />
                  {errors.full_name && <p className="text-xs text-destructive">{errors.full_name}</p>}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="birth_date">Data nascimento *</Label>
                    <Input id="birth_date" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                    {errors.birth_date && <p className="text-xs text-destructive">{errors.birth_date}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gênero *</Label>
                    <Select value={gender} onValueChange={(v) => setGender(v as "male" | "female")}>
                      <SelectTrigger id="gender"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Masculino</SelectItem>
                        <SelectItem value="female">Feminino</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.gender && <p className="text-xs text-destructive">{errors.gender}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF</Label>
                    <Input id="cpf" value={cpf} onChange={(e) => setCpf(cpfMask(e.target.value))} maxLength={14} placeholder="000.000.000-00" />
                    {errors.cpf && <p className="text-xs text-destructive">{errors.cpf}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rg">RG</Label>
                    <Input id="rg" value={rg} onChange={(e) => setRg(e.target.value)} maxLength={20} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
                    {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input id="phone" value={phone} onChange={(e) => setPhone(phoneMask(e.target.value))} maxLength={30} placeholder="(00) 00000-0000" />
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Switch id="is_active" checked={isActive} onCheckedChange={setIsActive} />
                  <Label htmlFor="is_active">Cadastro ativo</Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="adicional" className="space-y-4 pt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="disability_type">Tipo de Deficiência / Acessibilidade</Label>
                  <Input id="disability_type" value={disabilityType} onChange={(e) => setDisabilityType(e.target.value)} placeholder="Ex: Auditiva, Visual, Cadeirante..." />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="food_restrictions">Restrições Alimentares</Label>
                  <Textarea id="food_restrictions" value={foodRestrictions} onChange={(e) => setFoodRestrictions(e.target.value)} placeholder="Alergias, dietas específicas..." rows={3} />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="medical_notes">Observações Médicas / Saúde</Label>
                  <Textarea id="medical_notes" value={medicalNotes} onChange={(e) => setMedicalNotes(e.target.value)} placeholder="Medicamentos contínuos, condições especiais..." rows={3} />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6 gap-2">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Salvar Alterações" : "Criar Cadastro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}