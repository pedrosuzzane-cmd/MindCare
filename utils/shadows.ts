import { Platform } from "react-native";

type ShadowPreset = "sm" | "md" | "lg" | "xl";

const presetMap: Record<ShadowPreset, { y: number; r: number; o: number; e: number }> = {
  sm: { y: 1, r: 4, o: 0.06, e: 2 },
  md: { y: 2, r: 8, o: 0.1, e: 4 },
  lg: { y: 4, r: 12, o: 0.15, e: 8 },
  xl: { y: 6, r: 16, o: 0.2, e: 12 },
};

function build(y: number, r: number, o: number, e: number, c: string) {
  if (Platform.OS === "web") {
    return { boxShadow: `0px ${y}px ${r}px rgba(0,0,0,${o})` };
  }
  return {
    shadowColor: c,
    shadowOffset: { width: 0, height: y },
    shadowOpacity: o,
    shadowRadius: r,
    elevation: e,
  };
}

export const shadows = {
  sm: (c = "#000") => build(1, 4, 0.06, 2, c),
  md: (c = "#000") => build(2, 8, 0.1, 4, c),
  lg: (c = "#000") => build(4, 12, 0.15, 8, c),
  xl: (c = "#000") => build(6, 16, 0.2, 12, c),
  custom: (y: number, r: number, o: number, e: number, c = "#000") => build(y, r, o, e, c),
};
