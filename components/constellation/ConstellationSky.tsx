import { MindCareTheme } from "@/constants/theme";
import { ConstellationStar } from "@/types/constellation";
import {
  STAR_POSITIONS,
  currentSeason,
  moodSkyColors,
} from "@/utils/constellationOptions";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo, useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import { ConstellationStarView } from "./ConstellationStar";

const NEW_STAR_WINDOW_MS = 15_000;
const LINE_THICKNESS = 1.2;
const LINE_GLOW_THICKNESS = 4;

interface ConstellationSkyProps {
  stars: ConstellationStar[];
  theme: MindCareTheme;
  onPressStar: (star: ConstellationStar) => void;
  /** Optional per-star glyph override (e.g. achievement emoji). */
  glyphForStar?: (star: ConstellationStar) => string | undefined;
  /** Latest journal mood color; tints the sky when present. */
  moodColor?: string;
}

interface SkyLine {
  key: string;
  left: number;
  top: number;
  width: number;
  height: number;
  angle: number;
}

/** Dim, non-interactive backdrop stars for atmosphere. */
const BACKDROP_STAR_POSITIONS = STAR_POSITIONS.filter(
  (_p, idx) => idx % 3 === 0 && idx % 2 === 1,
);

export function ConstellationSky({
  stars,
  theme,
  onPressStar,
  glyphForStar,
  moodColor,
}: ConstellationSkyProps) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const gradientColors = useMemo(
    () =>
      moodColor
        ? moodSkyColors(moodColor, theme.mode)
        : theme.mode === "dark"
          ? (["#241C40", "#1A1230", "#0F0B1E"] as const)
          : (["#4A3B78", "#3B2E63", "#2A2152"] as const),
    [moodColor, theme.mode],
  );

  const season = useMemo(() => currentSeason(), []);

  const now = Date.now();
  const newStarIds = useMemo(() => {
    const set = new Set<string>();
    for (const star of stars) {
      const created = new Date(star.createdAt).getTime();
      if (now - created >= 0 && now - created < NEW_STAR_WINDOW_MS) {
        set.add(star.id);
      }
    }
    return set;
  }, [stars, now]);

  const lineColor = theme.mode === "dark" ? "#E9DFFF" : "#F4EEFF";

  /**
   * Each constellation group draws a quiet line between consecutive stars in
   * chronological order — every new star is linked to the one that came before
   * it, so the constellation grows into a shape over time.
   */
  const lines = useMemo<SkyLine[]>(() => {
    if (layout.width === 0 || layout.height === 0) return [];
    if (stars.length < 2) return [];

    const groups = new Map<string, ConstellationStar[]>();
    for (const star of stars) {
      const key = star.constellationId || "reflection";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(star);
    }

    const result: SkyLine[] = [];
    for (const [groupKey, groupStars] of groups) {
      if (groupStars.length < 2) continue;
      const sorted = [...groupStars].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      for (let i = 1; i < sorted.length; i++) {
        const a = sorted[i - 1];
        const b = sorted[i];
        const ax = a.position.x * layout.width;
        const ay = a.position.y * layout.height;
        const bx = b.position.x * layout.width;
        const by = b.position.y * layout.height;
        const dx = bx - ax;
        const dy = by - ay;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        result.push({
          key: `${groupKey}_${a.id}`,
          left: (ax + bx) / 2 - length / 2,
          top: (ay + by) / 2 - LINE_THICKNESS / 2,
          width: length,
          height: LINE_THICKNESS,
          angle,
        });
      }
    }
    return result;
  }, [stars, layout]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width, height });
  };

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <LinearGradient
        colors={gradientColors as unknown as [string, string, string]}
        style={StyleSheet.absoluteFill}
      />

      {/* Seasonal overlay */}
      <LinearGradient
        colors={season.colors as unknown as [string, string, string]}
        style={[StyleSheet.absoluteFill, { opacity: season.opacity }]}
        pointerEvents="none"
      />

      {/* Ambient backdrop stars */}
      {BACKDROP_STAR_POSITIONS.map((pos, idx) => (
        <View
          key={`backdrop_${idx}`}
          pointerEvents="none"
          style={[
            styles.backdrop,
            {
              left: `${pos.x * 100}%`,
              top: `${pos.y * 100}%`,
              opacity: idx % 4 === 0 ? 0.22 : 0.14,
            },
          ]}
        />
      ))}

      {/* Constellation lines */}
      {lines.map((line) => (
        <View key={line.key} pointerEvents="none">
          <View
            style={[
              styles.lineGlow,
              {
                left: line.left - (LINE_GLOW_THICKNESS - line.height) / 2,
                top: line.top - (LINE_GLOW_THICKNESS - line.height) / 2,
                width: line.width,
                height: LINE_GLOW_THICKNESS,
                backgroundColor: lineColor,
                transform: [{ rotate: `${line.angle}rad` }],
              },
            ]}
          />
          <View
            style={[
              styles.line,
              {
                left: line.left,
                top: line.top,
                width: line.width,
                height: line.height,
                backgroundColor: lineColor,
                transform: [{ rotate: `${line.angle}rad` }],
              },
            ]}
          />
        </View>
      ))}

      {/* Real stars */}
      {stars.map((star) => (
        <ConstellationStarView
          key={star.id}
          star={star}
          animate={newStarIds.has(star.id)}
          onPress={onPressStar}
          glyph={glyphForStar?.(star)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 24,
  },
  backdrop: {
    position: "absolute",
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#FFFFFF",
  },
  line: {
    position: "absolute",
    borderRadius: 1,
    opacity: 0.4,
  },
  lineGlow: {
    position: "absolute",
    borderRadius: 2,
    opacity: 0.1,
  },
});
