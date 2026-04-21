import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEventId } from "@/contexts/EventContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, X, Plus, AlertTriangle, ChevronsUpDown, Check } from "lucide-react";
import { z } from "zod";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** When provided, edits this participant. Otherwise creates a new person + participant. */
  participantId?: string | null;
}

const personSchema = z.object({
  full_name: z.string().trim().min(2, "Nome obrigatório").max(200),
  cpf: z.string().trim().min(11, "CPF inválido").max(14),
  email: z.string().trim().email("E-mail inválido").max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  birth_date: z.string().optional().or(z.literal("")),
  gender: z.enum(["male", "female"]).optional(),
});

export default function PessoaFormDialog({ open, onOpenChange, participantId }: Props) {
  const { user } = useAuth();
  const eventId = useActiveEventId();
  const qc = useQueryClient();
  const isEdit = !!participantId;

  // Form state
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [participantType, setParticipantType] = useState("colaborador");
  const [delegationId, setDelegationId] = useState<string>("");
  const [delegationOpen, setDelegationOpen] = useState(false);
  const [needsTransport, setNeedsTransport] = useState(false);
  const [needsMeals, setNeedsMeals] = useState(false);
  const [needsLodging, setNeedsLodging] = useState(false);
  const [logisticsRestrictions, setLogisticsRestrictions] = useState("");
  const [logisticsNotes, setLogisticsNotes] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Catalog of roles
  const { data: roleCatalog = [] } = useQuery({
    queryKey: ["event_role_catalog"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("event_role_catalog" as never) as any)
        .select("code, name").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return data as { code: string; name: string }[];
    },
  });

  const { data: delegations = [] } = useQuery({
    queryKey: ["delegations_for_form", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delegations")
        .select("id, school_name, institution:institutions(name)")
        .eq("event_id", eventId!).order("school_name");
      if (error) throw error;
      return data;
    },
  });

  // Load existing data when editing
  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ["pessoa_form_data", participantId],
    enabled: open && isEdit,
    queryFn: async () => {
      const { data: p, error } = await supabase
        .from("participants")
        .select("id, person_id, participant_type, delegation_id, needs_transport, needs_meals, needs_lodging, logistics_restrictions, logistics_notes, person:people(full_name, cpf, email, phone, birth_date, gender)")
        .eq("id", participantId!).single();
      if (error) throw error;
      const { data: roles } = await (supabase.from("participant_event_roles" as never) as any)
        .select("role_type").eq("participant_id", participantId!).eq("is_active", true);
      return { participant: p, roles: (roles ?? []).map((r: any) => r.role_type) };
    },
  });

  useEffect(() => {
    if (existing && isEdit) {
      const p: any = existing.participant;
      setFullName(p.person?.full_name ?? "");
      setCpf(p.person?.cpf ?? "");
      setEmail(p.person?.email ?? "");
      setPhone(p.person?.phone ?? "");
      setBirthDate(p.person?.birth_date ?? "");
      setGender(p.person?.gender ?? "");
      setParticipantType(p.participant_type);
      setDelegationId(p.delegation_id ?? "");
      setNeedsTransport(!!p.needs_transport);
      setNeedsMeals(!!p.needs_meals);
      setNeedsLodging(!!p.needs_lodging);
      setLogisticsRestrictions(p.logistics_restrictions ?? "");
      setLogisticsNotes(p.logistics_notes ?? "");
      setSelectedRoles(existing.roles);
    } else if (open && !isEdit) {
      // Reset
      setFullName(""); setCpf(""); setEmail(""); setPhone(""); setBirthDate("");
      setGender(""); setParticipantType("colaborador"); setDelegationId("");
      setNeedsTransport(false); setNeedsMeals(false); setNeedsLodging(false);
      setLogisticsRestrictions(""); setLogisticsNotes(""); setSelectedRoles([]);
      setErrors({});
    }
  }, [existing, isEdit, open]);

  const toggleRole = (code: string) => {
    setSelectedRoles((prev) => prev.includes(code) ? prev.filter(r => r !== code) : [...prev, code]);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!eventId || !user) throw new Error("Sessão inválida");

      const parsed = personSchema.safeParse({
        full_name: fullName, cpf, email, phone, birth_date: birthDate, gender: gender || undefined,
      });
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        parsed.error.errors.forEach(e => { fieldErrors[e.path[0] as string] = e.message; });
        setErrors(fieldErrors);
        throw new Error("Corrija os campos destacados");
      }
      setErrors({});

      const cpfClean = cpf.replace(/\D/g, "");

      let personId: string;
      let pId: string;

      if (isEdit && existing) {
        personId = (existing.participant as any).person_id;
        pId = (existing.participant as any).id;
        // Update person
        const { error: errPerson } = await supabase.from("people").update({
          full_name: fullName.trim(),
          cpf: cpfClean,
          email: email || null,
          phone: phone || null,
          birth_date: birthDate || null,
          gender: gender || null,
        }).eq("id", personId);
        if (errPerson) throw errPerson;
        // Update participant
        const { error: errPart } = await supabase.from("participants").update({
          participant_type: participantType,
          delegation_id: delegationId || null,
          needs_transport: needsTransport,
          needs_meals: needsMeals,
          needs_lodging: needsLodging,
          logistics_restrictions: logisticsRestrictions || null,
          logistics_notes: logisticsNotes || null,
        } as any).eq("id", pId);
        if (errPart) throw errPart;
      } else {
        // Find or create person by CPF
        const { data: foundPerson } = await supabase.from("people").select("id").eq("cpf", cpfClean).maybeSingle();
        if (foundPerson) {
          personId = foundPerson.id;
          // Already linked to this event?
          const { data: existingPart } = await supabase.from("participants").select("id")
            .eq("person_id", personId).eq("event_id", eventId).maybeSingle();
          if (existingPart) {
            throw new Error("Esta pessoa (CPF " + cpfClean + ") já está cadastrada neste evento.");
          }
        } else {
          const { data: newPerson, error: errCreate } = await supabase.from("people").insert({
            full_name: fullName.trim(),
            cpf: cpfClean,
            email: email || null,
            phone: phone || null,
            birth_date: birthDate || null,
            gender: gender || null,
          }).select("id").single();
          if (errCreate) throw errCreate;
          personId = newPerson.id;
        }
        const { data: newPart, error: errPart } = await supabase.from("participants").insert({
          person_id: personId,
          event_id: eventId,
          delegation_id: delegationId || null,
          participant_type: participantType,
          status: "confirmed",
          is_active: true,
          needs_transport: needsTransport,
          needs_meals: needsMeals,
          needs_lodging: needsLodging,
          logistics_restrictions: logisticsRestrictions || null,
          logistics_notes: logisticsNotes || null,
        } as any).select("id").single();
        if (errPart) throw errPart;
        pId = newPart.id;
      }

      // Sync roles: delete old then insert new (simple approach)
      await (supabase.from("participant_event_roles" as never) as any)
        .delete().eq("participant_id", pId).eq("event_id", eventId);
      if (selectedRoles.length > 0) {
        const rows = selectedRoles.map(role_type => ({
          participant_id: pId,
          event_id: eventId,
          delegation_id: delegationId || null,
          role_type,
          is_active: true,
        }));
        const { error: errRoles } = await (supabase.from("participant_event_roles" as never) as any).insert(rows);
        if (errRoles) throw errRoles;
      }

      return pId;
    },
    onSuccess: () => {
      toast({ title: isEdit ? "Pessoa atualizada" : "Pessoa cadastrada" });
      qc.invalidateQueries({ queryKey: ["all-participants"] });
      qc.invalidateQueries({ queryKey: ["participant_full"] });
      qc.invalidateQueries({ queryKey: ["pessoa_form_data"] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message ?? String(err), variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar pessoa" : "Cadastrar nova pessoa"}</DialogTitle>
          <DialogDescription>
            Cadastre qualquer pessoa que participa do evento. Uma pessoa pode ter múltiplas funções e a unicidade é garantida pelo CPF.
          </DialogDescription>
        </DialogHeader>

        {loadingExisting ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-5">
            {/* Identificação */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Identificação</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Nome completo *</Label>
                  <Input value={fullName} onChange={e => setFullName(e.target.value)} />
                  {errors.full_name && <p className="text-xs text-destructive mt-1">{errors.full_name}</p>}
                </div>
                <div>
                  <Label>CPF *</Label>
                  <Input value={cpf} onChange={e => setCpf(e.target.value)} disabled={isEdit} placeholder="00000000000" />
                  {errors.cpf && <p className="text-xs text-destructive mt-1">{errors.cpf}</p>}
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
                  {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
                <div>
                  <Label>Data de nascimento</Label>
                  <Input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
                </div>
                <div>
                  <Label>Gênero</Label>
                  <Select value={gender} onValueChange={(v) => setGender(v as any)}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Masculino</SelectItem>
                      <SelectItem value="female">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* Vínculo */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Vínculo no evento</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Tipo principal *</Label>
                  <Select value={participantType} onValueChange={setParticipantType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="athlete">Atleta</SelectItem>
                      <SelectItem value="coach">Técnico</SelectItem>
                      <SelectItem value="head_of_delegation">Chefe de Delegação</SelectItem>
                      <SelectItem value="official">Oficial</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="colaborador">Colaborador da organização</SelectItem>
                      <SelectItem value="terceiro">Terceiro / prestador</SelectItem>
                      <SelectItem value="arbitro">Árbitro</SelectItem>
                      <SelectItem value="mesario">Mesário</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Delegação (opcional)</Label>
                  <Popover open={delegationOpen} onOpenChange={setDelegationOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={delegationOpen}
                        className="w-full justify-between font-normal"
                      >
                        <span className="truncate">
                          {delegationId
                            ? delegations.find((d: any) => d.id === delegationId)?.school_name
                            : "Sem delegação"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar delegação..." />
                        <CommandList>
                          <CommandEmpty>Nenhuma delegação encontrada.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="__none"
                              onSelect={() => { setDelegationId(""); setDelegationOpen(false); }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", !delegationId ? "opacity-100" : "opacity-0")} />
                              Sem delegação
                            </CommandItem>
                            {delegations.map((d: any) => (
                              <CommandItem
                                key={d.id}
                                value={d.school_name}
                                onSelect={() => { setDelegationId(d.id); setDelegationOpen(false); }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", delegationId === d.id ? "opacity-100" : "opacity-0")} />
                                {d.school_name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div>
                <Label>Funções operacionais (selecione todas que se aplicam)</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {roleCatalog.map((r) => {
                    const active = selectedRoles.includes(r.code);
                    return (
                      <Badge
                        key={r.code}
                        variant={active ? "default" : "outline"}
                        className="cursor-pointer hover:bg-primary/80"
                        onClick={() => toggleRole(r.code)}
                      >
                        {active ? <X className="h-3 w-3 mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                        {r.name}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Logística */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Elegibilidade logística</h3>
              <p className="text-xs text-muted-foreground">
                Marque os serviços que esta pessoa pode consumir. Consumos são contabilizados por pessoa, não por função.
              </p>
              <div className="grid grid-cols-3 gap-2">
                <label className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted/40">
                  <Checkbox checked={needsTransport} onCheckedChange={(v) => setNeedsTransport(!!v)} />
                  <span className="text-sm">Transporte</span>
                </label>
                <label className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted/40">
                  <Checkbox checked={needsMeals} onCheckedChange={(v) => setNeedsMeals(!!v)} />
                  <span className="text-sm">Alimentação</span>
                </label>
                <label className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted/40">
                  <Checkbox checked={needsLodging} onCheckedChange={(v) => setNeedsLodging(!!v)} />
                  <span className="text-sm">Alojamento</span>
                </label>
              </div>
              <div>
                <Label>Restrições</Label>
                <Input value={logisticsRestrictions} onChange={e => setLogisticsRestrictions(e.target.value)} placeholder="Ex.: alergia a frutos do mar, mobilidade reduzida..." />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={logisticsNotes} onChange={e => setLogisticsNotes(e.target.value)} rows={2} />
              </div>
            </section>

            {Object.keys(errors).length > 0 && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Corrija os campos marcados antes de salvar.</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saveMutation.isPending}>Cancelar</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {isEdit ? "Salvar alterações" : "Cadastrar pessoa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
