/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { DEV_PER_TAB_AUTH } from "@/lib/utils/constants";

const DEV_THEME_KEY = "rms_dev_theme";

type Theme = "light" | "dark" | "system";

export interface ThemeContextType {
  theme: Theme;
  resolvedTheme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeContext must be used within a ThemeProvider");
  }
  return context;
}

/**
 * Non-throwing variant for components that also render on the server. The
 * provider deliberately withholds context until after mount (see
 * `ThemeProviderInner`), so SSR-time consumers get `undefined` rather than an
 * exception and can render a neutral placeholder.
 */
export function useOptionalThemeContext(): ThemeContextType | undefined {
  return useContext(ThemeContext);
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "system";
  if (DEV_PER_TAB_AUTH) {
    return (sessionStorage.getItem(DEV_THEME_KEY) as Theme) || "system";
  }
  return (localStorage.getItem("theme") as Theme) || "system";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.add(prefersDark ? "dark" : "light");
  } else {
    root.classList.add(theme);
  }
}

function ThemeProviderInner({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return getInitialTheme();
  });
  const [resolvedTheme, setResolvedTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    const initial = getInitialTheme();
    setThemeState(initial);
    applyTheme(initial);
    setResolvedTheme(initial);
    setMounted(true);

    if (initial === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = (e: MediaQueryListEvent) => {
        const resolved = e.matches ? "dark" : "light";
        applyTheme(resolved);
        setResolvedTheme(resolved);
      };
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    setResolvedTheme(newTheme);
    
    if (DEV_PER_TAB_AUTH) {
      sessionStorage.setItem(DEV_THEME_KEY, newTheme);
    } else {
      localStorage.setItem("theme", newTheme);
    }
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  const value = {
    theme,
    resolvedTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeProviderInner>{children}</ThemeProviderInner>;
}