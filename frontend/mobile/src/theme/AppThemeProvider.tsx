import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type ThemePalette = {
  isDark: boolean;
  bg: string;
  card: string;
  cardMuted: string;
  text: string;
  subText: string;
  mutedText: string;
  border: string;
  inputBg: string;
  overlay: string;
  icon: string;
};

type ThemeContextValue = {
  theme: ThemePalette;
  isDark: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function buildTheme(isDark: boolean): ThemePalette {
  if (isDark) {
    return {
      isDark,
      bg: "#0f172a",
      card: "#111827",
      cardMuted: "#1f2937",
      text: "#f8fafc",
      subText: "#cbd5e1",
      mutedText: "#94a3b8",
      border: "#334155",
      inputBg: "#0b1220",
      overlay: "rgba(2, 6, 23, 0.68)",
      icon: "#e2e8f0",
    };
  }

  return {
    isDark,
    bg: "#f8fafc",
    card: "#ffffff",
    cardMuted: "#f8fafc",
    text: "#0f172a",
    subText: "#64748b",
    mutedText: "#94a3b8",
    border: "#e2e8f0",
    inputBg: "#ffffff",
    overlay: "rgba(15, 23, 42, 0.28)",
    icon: "#334155",
  };
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  const value = useMemo(
    () => ({
      isDark,
      theme: buildTheme(isDark),
      toggleTheme: () => setIsDark((prev) => !prev),
    }),
    [isDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }
  return value;
}
