import { useNavigate } from "react-router-dom";
import { MessageSquare, BookOpen, LifeBuoy } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AjudaIndexPage() {
  const navigate = useNavigate();

  const options = [
    {
      title: "Manual de Instruções",
      description: "Documentação completa com guias passo a passo, vídeos e manuais técnicos de todos os módulos.",
      icon: <BookOpen className="h-8 w-8 text-blue-500" />,
      path: "/admin/ajuda/manual",
      buttonText: "Acessar Manual",
    },
    {
      title: "Chat com IA (Suporte)",
      description: "Tire dúvidas rápidas sobre o funcionamento do sistema com nosso assistente inteligente disponível 24/7.",
      icon: <MessageSquare className="h-8 w-8 text-green-500" />,
      path: "/admin/ajuda/chat",
      buttonText: "Iniciar Chat",
    },
    {
      title: "Central de Chamados",
      description: "Precisa de ajuda humana ou encontrou um erro? Abra um chamado para nossa equipe técnica.",
      icon: <LifeBuoy className="h-8 w-8 text-orange-500" />,
      path: "/admin/ajuda/chamados",
      buttonText: "Abrir Chamado",
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold text-foreground">Como podemos ajudar hoje?</h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Escolha uma das opções abaixo para encontrar orientações ou suporte técnico para o sistema JER Gestão.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {options.map((option) => (
          <Card key={option.path} className="flex flex-col hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="mb-4 p-3 bg-muted w-fit rounded-xl">
                {option.icon}
              </div>
              <CardTitle>{option.title}</CardTitle>
              <CardDescription className="min-h-[60px]">
                {option.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto pt-4">
              <Button 
                onClick={() => navigate(option.path)} 
                className="w-full gap-2"
                variant={option.path === "/admin/ajuda/manual" ? "default" : "outline"}
              >
                {option.buttonText}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-muted/30 p-8 rounded-2xl border border-dashed flex flex-col items-center text-center space-y-4">
        <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Documentação Técnica</div>
        <p className="max-w-lg text-muted-foreground">
          Se você é um Super Administrador, também pode acessar a documentação técnica gerada a partir do código fonte.
        </p>
        <Button variant="link" onClick={() => navigate("/super/documentacao")}>
          Ver Documentação Técnica (Super Admin)
        </Button>
      </div>
    </div>
  );
}
