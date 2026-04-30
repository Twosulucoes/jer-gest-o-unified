import { Trophy, Calendar, Menu, LogIn, Award, LayoutDashboard, ArrowLeft } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { VisualIdentity } from "./VisualIdentity";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
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
    <header className="glass-panel-strong px-4 py-3 sticky top-0 z-50">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <div className="flex items-center gap-2">
          {showBackButton && onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <Link to="/" className="transition-opacity hover:opacity-80">
            <VisualIdentity size="sm" subtitle={subtitle || "Portal Público"} />
          </Link>
          
          <nav className="hidden md:flex items-center gap-1 ml-6 border-l pl-6 border-border/50">
            <Button
              variant={isResults ? "secondary" : "ghost"}
              size="sm"
              asChild
              className={cn(
                "h-9 text-xs gap-2 px-4 transition-all",
                isResults && "bg-primary/10 text-primary hover:bg-primary/20"
              )}
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
              className={cn(
                "h-9 text-xs gap-2 px-4 transition-all",
                isMedals && "bg-primary/10 text-primary hover:bg-primary/20"
              )}
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
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary transition-all">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl shadow-xl animate-scale-in">
                <DropdownMenuItem asChild className="rounded-xl">
                  <Link to="/public/results" className="gap-3 py-2.5">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="font-medium">Resultados e Agenda</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="rounded-xl">
                  <Link to="/public/medals" className="gap-3 py-2.5">
                    <Trophy className="h-4 w-4 text-primary" />
                    <span className="font-medium">Quadro de Medalhas</span>
                  </Link>
                </DropdownMenuItem>
                <div className="my-2 border-t border-border/50" />
                {!user ? (
                  <DropdownMenuItem asChild className="rounded-xl">
                    <Link to="/login" className="gap-3 py-2.5 text-primary">
                      <LogIn className="h-4 w-4" />
                      <span className="font-bold">Acesso Restrito</span>
                    </Link>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem asChild className="rounded-xl">
                    <Link to="/admin" className="gap-3 py-2.5 text-indigo-600">
                      <LayoutDashboard className="h-4 w-4" />
                      <span className="font-bold">Painel Admin</span>
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {!user && (
            <Button variant="ghost" size="sm" asChild className="hidden md:flex text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all rounded-xl px-4">
              <Link to="/login" className="gap-2 font-medium">
                <LogIn className="h-4 w-4" />
                Entrar
              </Link>
            </Button>
          )}
          {user && (
            <Button variant="outline" size="sm" asChild className="hidden md:flex h-9 text-xs border-primary/20 hover:bg-primary/5 rounded-xl px-4 transition-all">
              <Link to="/admin">Painel Administrativo</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
