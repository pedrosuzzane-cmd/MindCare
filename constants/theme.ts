/**
 * MindCare design tokens.
 *
 * Light + Dark palettes follow the MindCare visual identity:
 * white / very soft lavender sections / subtle purple borders,
 * purple primary actions, pastel accents, dark navy-purple text,
 * soft shadows and rounded cards.
 */

import { DarkTheme, DefaultTheme } from "@react-navigation/native";
import { Platform } from "react-native";

export type ThemeMode = "light" | "dark";

export interface MindCareTheme {
  mode: ThemeMode;
  /** Main screen background */
  background: string;
  /** Slightly tinted background (alternating sections) */
  backgroundAlt: string;
  /** Very soft lavender wash */
  verySoftPurple: string;
  /** Soft lavender (active pills, icon containers) */
  softPurple: string;
  /** Primary purple for actions / active states */
  primary: string;
  /** Deep brand purple for gradients / accents */
  primaryDeep: string;
  /** Primary card surface */
  card: string;
  /** Secondary card surface (inside cards) */
  secondaryCard: string;
  /** Input / chip surface */
  inputBg: string;
  /** Primary text (dark navy/purple in light mode) */
  text: string;
  /** Secondary text */
  secondaryText: string;
  /** Border / divider */
  border: string;
  /** Softer border for inner elements */
  borderSoft: string;
  /** Web box-shadow color used by cards */
  shadow: string;
  /** Brand gradient colors (header backgrounds) */
  headerGradient: readonly [string, string];
  /** Light lavender gradient used by light screens (theme-aware) */
  softGradient: readonly [string, string, string];
  /** Bottom tab bar surface */
  tabBar: string;
  tabBarBorder: string;
  tabIconDefault: string;
  tabIconSelected: string;
  /** Accent tints used across dashboard micro stats / icons */
  accent: {
    purple: string;
    green: string;
    amber: string;
    teal: string;
    rose: string;
  };
  /** Semantic status colors (theme-aware for contrast) */
  status: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  /** On-primary text (buttons inside primary surfaces) */
  onPrimary: string;
}

export const lightTheme: MindCareTheme = {
  mode: "light",
  background: "#FAF9FD",
  backgroundAlt: "#F7F4FC",
  verySoftPurple: "#FAF7FF",
  softPurple: "#F4EEFF",
  primary: "#8A63D2",
  primaryDeep: "#7C4DCC",
  card: "#FFFFFF",
  secondaryCard: "#F7F2FF",
  inputBg: "#F7F4FC",
  text: "#242038",
  secondaryText: "#737083",
  border: "#ECE8F4",
  borderSoft: "#F0ECF8",
  shadow: "rgba(124, 77, 204, 0.08)",
  headerGradient: ["#8A63D2", "#7C5AC8"],
  softGradient: ["#E8E0F5", "#F4F2F8", "#E8E0F5"],
  tabBar: "#FFFFFF",
  tabBarBorder: "#F3F0FF",
  tabIconDefault: "#9CA3AF",
  tabIconSelected: "#8A63D2",
  accent: {
    purple: "#7C4DCC",
    green: "#10B981",
    amber: "#D97706",
    teal: "#0F766E",
    rose: "#B56576",
  },
  status: {
    success: "#0E9F6E",
    warning: "#B45309",
    error: "#DC2626",
    info: "#0284C7",
  },
  onPrimary: "#FFFFFF",
};

export const darkTheme: MindCareTheme = {
  mode: "dark",
  background: "#15131C",
  backgroundAlt: "#1B1823",
  verySoftPurple: "#1D1A26",
  softPurple: "#332A46",
  primary: "#A47BE8",
  primaryDeep: "#A47BE8",
  card: "#211E2B",
  secondaryCard: "#282435",
  inputBg: "#282435",
  text: "#F7F4FC",
  secondaryText: "#B9B3C7",
  border: "#393342",
  borderSoft: "#332E3F",
  shadow: "rgba(0, 0, 0, 0.35)",
  headerGradient: ["#8A63D2", "#6D4FB8"],
  softGradient: ["#211E2B", "#282435", "#211E2B"],
  tabBar: "#1B1823",
  tabBarBorder: "#2A2636",
  tabIconDefault: "#6E6A7D",
  tabIconSelected: "#A47BE8",
  accent: {
    purple: "#A47BE8",
    green: "#34D399",
    amber: "#F0A94A",
    teal: "#2DD4BF",
    rose: "#E47E93",
  },
  status: {
    success: "#34D399",
    warning: "#F0A94A",
    error: "#F87171",
    info: "#38BDF8",
  },
  onPrimary: "#FFFFFF",
};

export const themes: Record<ThemeMode, MindCareTheme> = {
  light: lightTheme,
  dark: darkTheme,
};

/** Navigation themes built from the MindCare palettes. */
export const navThemes = {
  light: {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: lightTheme.primary,
      background: lightTheme.background,
      card: lightTheme.card,
      text: lightTheme.text,
      border: lightTheme.border,
      notification: lightTheme.primary,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: darkTheme.primary,
      background: darkTheme.background,
      card: darkTheme.card,
      text: darkTheme.text,
      border: darkTheme.border,
      notification: darkTheme.primary,
    },
  },
};

/* ------------------------------------------------------------------ */
/* Legacy shape kept for existing helpers (use-theme-color, etc.)     */
/* ------------------------------------------------------------------ */

const tintColorLight = lightTheme.primary;
const tintColorDark = darkTheme.primary;

export const Colors = {
  light: {
    text: lightTheme.text,
    background: lightTheme.background,
    tint: tintColorLight,
    icon: lightTheme.secondaryText,
    tabIconDefault: lightTheme.tabIconDefault,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: darkTheme.text,
    background: darkTheme.background,
    tint: tintColorDark,
    icon: darkTheme.secondaryText,
    tabIconDefault: darkTheme.tabIconDefault,
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
