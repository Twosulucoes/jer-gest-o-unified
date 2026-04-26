import { useEffect, useState } from "react";

interface VersionInfo {
  appVersion: string;
  environment: string;
  branch: string;
  commit: string;
  commitFull: string;
  buildDate: string;
  supabaseProjectRef: string;
}

export function VersionBadge() {
  const [version, setVersion] = useState<VersionInfo | null>(null);

  useEffect(() => {
    fetch("/version.json", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch version");
        return res.json();
      })
      .then((data) => setVersion(data))
      .catch(() => setVersion(null));
  }, []);

  if (!version) return null;

  const title = `Version: ${version.appVersion}
Environment: ${version.environment}
Branch: ${version.branch}
Commit: ${version.commitFull}
Build Date: ${version.buildDate}
Project: ${version.supabaseProjectRef}`;

  return (
    <div 
      className="fixed bottom-2 right-2 text-[10px] text-muted-foreground opacity-50 hover:opacity-100 transition-opacity cursor-help z-50 pointer-events-auto"
      title={title}
    >
      v{version.appVersion} · {version.environment} · {version.commit}
    </div>
  );
}
