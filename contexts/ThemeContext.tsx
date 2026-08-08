import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  MindCareTheme,
  ThemeMode,
  themes,
} from "@/constants/theme";

const THEME_MODE_KEY = "@mindcare/theme-mode";

interface ThemeContextValue {
  mode: ThemeMode;
  theme: MindCareTheme;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "light",
  theme: themes.light,
  setMode: () => {},
  toggle: () => {},
});

export function ThemeProvider({
  children,
  initialMode,
}: {
  children: React.ReactNode;
  initialMode: ThemeMode;
}) {
  const [mode, setModeState] = useState<ThemeMode>(initialMode);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(THEME_MODE_KEY)
      .then((saved) => {
        if (mounted && (saved === "light" || saved === "dark")) {
          setModeState(saved);
        }
      })
      .catch(() => {
        // Keep the system default if storage can't be read.
      });
    return () => {
      mounted = false;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(THEME_MODE_KEY, next).catch(() => {
      // Non-fatal: theme still applies for the session.
    });
  }, []);

  const toggle = useCallback(() => {
    setModeState((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      AsyncStorage.setItem(THEME_MODE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, theme: themes[mode], setMode, toggle }),
    [mode, setMode, toggle],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useMindCareTheme() {
  return useContext(ThemeContext);
}
