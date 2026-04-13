import { useEffect } from "react";

export function useAoVivoManifest() {
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]');
    const original = link?.getAttribute("href");
    if (link) {
      link.setAttribute("href", "/aovivo/manifest.webmanifest");
    }
    return () => {
      if (link && original) {
        link.setAttribute("href", original);
      }
    };
  }, []);
}
