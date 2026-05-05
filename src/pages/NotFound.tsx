import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center px-4">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Página não encontrada</p>
        <p className="mb-6 text-sm text-muted-foreground">
          O endereço <code className="px-1 rounded bg-background border">{location.pathname}</code> não existe.
        </p>
        <a
          href="/"
          className="inline-flex items-center px-4 py-2 rounded-md text-primary underline hover:text-primary/90 focus-ring"
        >
          Voltar para o início
        </a>
      </div>
    </div>
  );
};

export default NotFound;
