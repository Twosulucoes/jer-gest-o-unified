import { Trophy, Calendar, Menu, LogIn, Award, LayoutDashboard } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { VisualIdentity } from "./VisualIdentity";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PublicHeaderProps {
  subtitle?: string;
  onBack?: () => void;
  showBackButton?: boolean;
}

export const PublicHeader = ({ subtitle, onBack, showBackButton }: PublicHeaderProps) => {
  const { user } = useAuth();
  const location = useLocation();

  const isResults = location.pathname.startsWith("/public/results");
  const isMedals = location.pathname.startsWith("/public/medals");

  return (
    <header className="border-b bg-white px-4 py-3 sticky top-0 z-50 shadow-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <div className="flex items-center gap-2">
          {showBackButton && onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-8 w-8 rounded-full"
            >
              <Menu className="h-4 w-4 rotate-90" />
            </Button>
          )}
          <Link to="/">
            <VisualIdentity size="sm" subtitle={subtitle || "Portal Público"} />
          </Link>
          
          <nav className="hidden md:flex items-center gap-1 ml-6 border-l pl-6">
            <Button
              variant={isResults ? "secondary" : "ghost"}
              size="sm"
              asChild
              className="h-8 text-xs gap-2"
            >
              <Link to="/public/results">
                <Calendar className="h-3.5 w-3.5" />
                Resultados e Agenda
              </Link>
            </Button>
            <Button
              variant={isMedals ? "secondary" : "ghost"}
              size="sm"
              asChild
              className="h-8 text-xs gap-2"
            >
              <Link to="/public/medals">
                <Trophy className="h-3.5 w-3.5" />
                Quadro de Medalhas
              </Link>
            </Button>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link to="/public/results" className="gap-2">
                    <Calendar className="h-4 w-4" /> Resultados
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/public/medals" className="gap-2">
                    <Trophy className="h-4 w-4" /> Medalhas
                  </Link>
                </DropdownMenuItem>
                {!user && (
                  <DropdownMenuItem asChild>
                    <Link to="/login" className="gap-2 font-semibold text-primary">
                      <LogIn className="h-4 w-4" /> Acesso Restrito
                    </Link>
                  </DropdownMenuItem>
                )}
                {user && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="gap-2 font-semibold text-indigo-600">
                      <LayoutDashboard className="h-4 w-4" /> Painel Admin
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {!user && (
            <Button variant="ghost" size="sm" asChild className="hidden md:flex text-muted-foreground hover:text-primary transition-colors">
              <Link to="/login" className="gap-1.5">
                <LogIn className="h-3.5 w-3.5" />
                Entrar
              </Link>
            </Button>
          )}
          {user && (
            <Button variant="outline" size="sm" asChild className="h-8 text-xs border-primary/20 hover:bg-primary/5">
              <Link to="/admin">Voltar ao Painel</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
