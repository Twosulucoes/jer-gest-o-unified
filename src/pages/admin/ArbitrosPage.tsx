import { ArbitrosTab } from "@/components/admin/arbitragem/ArbitrosTab";

export default function ArbitrosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Equipe de Árbitros</h1>
        <p className="text-sm text-muted-foreground">
          Cadastro global de árbitros. As designações por etapa ficam em Escalas.
        </p>
      </div>
      <ArbitrosTab />
    </div>
  );
}
