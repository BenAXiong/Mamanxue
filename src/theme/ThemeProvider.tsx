/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ThemePreference = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const THEME_STORAGE_KEY = "mx-theme-preference";

const ThemeContext = createContext<ThemeContextValue>({
  preference: "system",
  resolved: "dark",
  setPreference: () => {},
});

function getStoredPreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyThemeAttribute(theme: ResolvedTheme) {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.dataset.theme = theme;
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [preference, setPreference] = useState<ThemePreference>(() => getStoredPreference());
  const [resolved, setResolved] = useState<ResolvedTheme>(() => {
    const stored = getStoredPreference();
    const initial = stored === "system" ? getSystemTheme() : stored;
    applyThemeAttribute(initial);
    return initial;
  });

  const updateResolvedTheme = useCallback(
    (nextPreference: ThemePreference) => {
      const systemTheme = getSystemTheme();
      const next = nextPreference === "system" ? systemTheme : nextPreference;
      setResolved(next);
      applyThemeAttribute(next);
    },
    [],
  );

  useEffect(() => {
    updateResolvedTheme(preference);
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, preference);

    if (preference !== "system" || typeof window.matchMedia !== "function") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      updateResolvedTheme("system");
    };
    media.addEventListener("change", handler);
    return () => {
      media.removeEventListener("change", handler);
    };
  }, [preference, updateResolvedTheme]);

  useEffect(() => {
    applyThemeAttribute(resolved);
  }, [resolved]);

  const handleSetPreference = useCallback((next: ThemePreference) => {
    setPreference(next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolved,
      setPreference: handleSetPreference,
    }),
    [preference, resolved, handleSetPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
