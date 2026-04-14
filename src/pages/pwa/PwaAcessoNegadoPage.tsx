import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function PwaAcessoNegadoPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <ShieldX className="h-16 w-16 text-destructive" />
      <h1 className="text-2xl font-bold text-foreground">Acesso Negado</h1>
      <p className="max-w-sm text-muted-foreground">
        Você não tem permissão para acessar este módulo. Entre em contato com a coordenação para solicitar acesso.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => navigate("/pwa")}>
          Voltar ao Início
        </Button>
        <Button variant="outline" onClick={() => navigate("/pwa/login")}>
          Trocar Conta
        </Button>
      </div>
    </div>
  );
}
