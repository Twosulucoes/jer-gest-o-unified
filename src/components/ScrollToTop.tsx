import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    const root = document.getElementById("root");
    if (root) root.scrollTop = 0;
  }, [pathname]);

  return null;
}
