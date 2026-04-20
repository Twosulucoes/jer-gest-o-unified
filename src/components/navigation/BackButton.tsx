import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getModuleFallbackPath,
  getModuleKey,
  peekPreviousInModule,
  popPreviousInModule,
} from "@/hooks/useNavigationHistory";

interface BackButtonProps {
  /** Override label. Defaults to "Voltar". */
  label?: string;
  /** Force a specific destination instead of the inferred one. */
  fallbackTo?: string;
  /** Hide the text on small screens (icon only). */
  compactOnMobile?: boolean;
  /** Visual variant. */
  variant?: "ghost" | "outline" | "secondary";
  /** Extra classes. */
  className?: string;
}

/**
 * Smart Back button.
 *
 * Resolution order:
 * 1. If there is a previous entry within the current module's history → go there.
 * 2. Else, if `fallbackTo` is provided → go there.
 * 3. Else → go to the module home (e.g. /admin/competicao). If already at module
 *    home, go to /admin.
 *
 * Never falls back to browser history (which could escape the app).
 */
export function BackButton({
  label = "Voltar",
  fallbackTo,
  compactOnMobile = true,
  variant = "ghost",
  className,
}: BackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentFullPath = location.pathname + location.search;
  const moduleKey = getModuleKey(location.pathname);

  const hasPrev = !!peekPreviousInModule(moduleKey, currentFullPath);
  const moduleHome = getModuleFallbackPath(moduleKey);
  const isAtModuleHome = currentFullPath === moduleHome;

  const handleClick = useCallback(() => {
    const previous = popPreviousInModule(moduleKey, currentFullPath);
    if (previous) {
      navigate(previous);
      return;
    }
    if (fallbackTo) {
      navigate(fallbackTo);
      return;
    }
    if (isAtModuleHome) {
      navigate("/admin");
      return;
    }
    navigate(moduleHome);
  }, [navigate, moduleKey, currentFullPath, fallbackTo, isAtModuleHome, moduleHome]);

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      onClick={handleClick}
      className={cn("gap-1.5 -ml-2 text-muted-foreground hover:text-foreground", className)}
      aria-label={label}
    >
      <ArrowLeft className="h-4 w-4" />
      <span className={cn(compactOnMobile && "hidden sm:inline")}>{label}</span>
    </Button>
  );
}

export default BackButton;
