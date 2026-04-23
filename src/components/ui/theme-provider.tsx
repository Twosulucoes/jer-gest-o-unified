import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem("jer-theme") as Theme) || "dark";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    root.style.colorScheme = theme;
    
    try {
      localStorage.setItem("jer-theme", theme);
    } catch {}
  }, [theme]);

  return (
    <div className={theme}>
      {children}
    </div>
  );
}

export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      return (localStorage.getItem("jer-theme") as Theme) || "dark";
    } catch {
      return "dark";
    }
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(newTheme);
    root.style.colorScheme = newTheme;
    try {
      localStorage.setItem("jer-theme", newTheme);
    } catch {}
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return { theme, setTheme, toggleTheme };
};
