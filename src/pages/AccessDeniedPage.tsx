import { ShieldAlert, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getOperationalRedirect } from "@/config/accessControl";

export default function AccessDeniedPage() {
  const navigate = useNavigate();
  const { roles } = useAuth();
  
  const suggestedRedirect = getOperationalRedirect(roles) || "/admin";
  const redirectLabel = suggestedRedirect.includes("/pwa") ? "Ir para Área Operacional" : "Ir para o Painel";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
        <ShieldAlert className="h-12 w-12 text-destructive" />
      </div>
      
      <h1 className="mb-2 text-3xl font-bold tracking-tight text-foreground">
        Acesso Negado
      </h1>
      
      <p className="mb-8 max-w-md text-muted-foreground">
        Seu perfil atual não possui as permissões necessárias para acessar este módulo. 
        Se você acredita que isso é um erro, entre em contato com o administrador do sistema.
      </p>
      
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button 
          variant="outline" 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        
        <Button 
          variant="default" 
          onClick={() => navigate(suggestedRedirect)}
          className="flex items-center gap-2"
        >
          <Home className="h-4 w-4" />
          {redirectLabel}
        </Button>
      </div>
    </div>
  );
}
