export type MobileColorPalette = {
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
  primary: string;
  primaryText: string;
  info: string;
  infoSoft: string;
  infoBorder: string;
  infoText: string;
  success: string;
  successSoft: string;
  successBorder: string;
  successText: string;
  danger: string;
  dangerSoft: string;
  dangerBorder: string;
  warning: string;
  warningSoft: string;
  warningBorder: string;
  warningText: string;
};

export type MobileTypography = {
  fontFamily: {
    regular: string;
    medium: string;
    semibold: string;
    bold: string;
  };
  fontSize: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    "2xl": number;
    "3xl": number;
  };
  lineHeight: {
    tight: number;
    normal: number;
    relaxed: number;
  };
  fontWeight: {
    medium: "500";
    semibold: "600";
    bold: "700";
    extrabold: "800";
  };
};

export type MobileTheme = {
  isDark: boolean;
  colors: MobileColorPalette;
  typography: MobileTypography;
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
  primary: string;
  primaryText: string;
  info: string;
  infoSoft: string;
  infoBorder: string;
  infoText: string;
  success: string;
  successSoft: string;
  successBorder: string;
  successText: string;
  danger: string;
  dangerSoft: string;
  dangerBorder: string;
  warning: string;
  warningSoft: string;
  warningBorder: string;
  warningText: string;
};

const TYPOGRAPHY: MobileTypography = {
  fontFamily: {
    regular: "System",
    medium: "System",
    semibold: "System",
    bold: "System",
  },
  fontSize: {
    xs: 11,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    "2xl": 22,
    "3xl": 26,
  },
  lineHeight: {
    tight: 16,
    normal: 20,
    relaxed: 24,
  },
  fontWeight: {
    medium: "500",
    semibold: "600",
    bold: "700",
    extrabold: "800",
  },
};

const LIGHT_COLORS: MobileColorPalette = {
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
  primary: "#0f172a",
  primaryText: "#ffffff",
  info: "#2563eb",
  infoSoft: "#eff6ff",
  infoBorder: "#dbeafe",
  infoText: "#1d4ed8",
  success: "#15803d",
  successSoft: "#f0fdf4",
  successBorder: "#bbf7d0",
  successText: "#ffffff",
  danger: "#b91c1c",
  dangerSoft: "#fee2e2",
  dangerBorder: "#fecaca",
  warning: "#b45309",
  warningSoft: "#fffbeb",
  warningBorder: "#fde68a",
  warningText: "#92400e",
};

const DARK_COLORS: MobileColorPalette = {
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
  primary: "#f8fafc",
  primaryText: "#0f172a",
  info: "#93c5fd",
  infoSoft: "#172554",
  infoBorder: "#1d4ed8",
  infoText: "#dbeafe",
  success: "#22c55e",
  successSoft: "#052e16",
  successBorder: "#166534",
  successText: "#052e16",
  danger: "#f87171",
  dangerSoft: "#450a0a",
  dangerBorder: "#7f1d1d",
  warning: "#f59e0b",
  warningSoft: "#451a03",
  warningBorder: "#92400e",
  warningText: "#fde68a",
};

export function buildMobileTheme(isDark: boolean): MobileTheme {
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  return {
    isDark,
    colors,
    typography: TYPOGRAPHY,
    ...colors,
  };
}

export const DEFAULT_MOBILE_THEME = buildMobileTheme(false);
