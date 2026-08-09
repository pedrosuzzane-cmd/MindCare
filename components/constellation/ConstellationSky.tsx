import { MindCareTheme } from "@/constants/theme";
import { ConstellationStar } from "@/types/constellation";
import {
  STAR_POSITIONS,
  currentSeason,
  moodSkyColors,
} from "@/utils/constellationOptions";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import Svg, { Line } from "react-native-svg";
import { ConstellationStarView } from "./ConstellationStar";

const NEW_STAR_MESSAGE_MS = 4500;
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
  x1: number;
  y1: number;
  x2: number;
  y2: number;
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

  const lineColor = theme.mode === "dark" ? "#E9DFFF" : "#F4EEFF";

  // A journal-derived star still marked `highlight` just appeared — show the
  // short celebratory note once (milestone/achievement novas get their own
  // reward moments, so they don't trigger the note).
  const showNewStarMessage = stars.some(
    (s) =>
      s.highlight === true &&
      (s.source === "journal" || s.source === "gratitude"),
  );

  const [showMessage, setShowMessage] = useState(showNewStarMessage);
  useEffect(() => {
    if (!showNewStarMessage) {
      setShowMessage(false);
      return;
    }
    setShowMessage(true);
    const timer = setTimeout(() => setShowMessage(false), NEW_STAR_MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [showNewStarMessage]);

  /**
   * Each constellation group draws a quiet line between consecutive stars in
   * chronological order — every new star is linked to the one that came before
   * it, so the constellation grows into a recognizable shape over time.
   */
  const lines = useMemo<SkyLine[]>(() => {
    if (layout.width === 0 || layout.height === 0) return [];
    if (stars.length < 2) return [];

    const groups = new Map<string, ConstellationStar[]>();
    for (const star of stars) {
      // All journal-derived stars (reflections + gratitude) share one journey
      // path so the sky draws a single recognizable constellation; achievement
      // and milestone novas stay as their own quiet side chains.
      const key =
        star.source === "journal" || star.source === "gratitude"
          ? "journey"
          : star.constellationId || "reflection";
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
        result.push({
          key: `${groupKey}_${a.id}`,
          x1: a.position.x * layout.width,
          y1: a.position.y * layout.height,
          x2: b.position.x * layout.width,
          y2: b.position.y * layout.height,
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

      {/* Constellation lines — subtle SVG strokes, never overpowering. */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        {lines.map((line) => (
          <React.Fragment key={line.key}>
            <Line
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={lineColor}
              strokeWidth={LINE_GLOW_THICKNESS}
              strokeOpacity={0.08}
              strokeLinecap="round"
            />
            <Line
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={lineColor}
              strokeWidth={LINE_THICKNESS}
              strokeOpacity={0.4}
              strokeLinecap="round"
            />
          </React.Fragment>
        ))}
      </Svg>

      {/* Real stars */}
      {stars.map((star) => (
        <ConstellationStarView
          key={star.id}
          star={star}
          animate={star.highlight === true}
          onPress={onPressStar}
          glyph={glyphForStar?.(star)}
        />
      ))}

      {/* "Your thoughts became a new star" note */}
      {showMessage && (
        <Animated.View
          entering={FadeInDown.duration(400)}
          exiting={FadeOutUp.duration(400)}
          pointerEvents="none"
          style={styles.newStarBanner}
        >
          <View style={styles.newStarPill}>
            <Text style={styles.newStarText}>
              Your thoughts became a new star ✨
            </Text>
          </View>
        </Animated.View>
      )}
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
  newStarBanner: {
    position: "absolute",
    top: 16,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  newStarPill: {
    backgroundColor: "rgba(20, 14, 40, 0.62)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  newStarText: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.95)",
  },
});
