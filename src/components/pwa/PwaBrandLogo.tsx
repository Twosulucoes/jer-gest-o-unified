import { cn } from "@/lib/utils";

interface PwaBrandLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "h-10",
  md: "h-14",
  lg: "h-20",
};

export function PwaBrandLogo({ className, size = "md" }: PwaBrandLogoProps) {
  return (
    <img
      src="/brand/logo.png"
      alt="JER Gestão"
      className={cn(sizeMap[size], "object-contain", className)}
    />
  );
}
