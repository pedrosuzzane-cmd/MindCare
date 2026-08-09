import { MindCareTheme } from "@/constants/theme";
import { ConstellationStar } from "@/types/constellation";
import {
  currentSeason,
  moodSkyColors,
} from "@/utils/constellationOptions";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo, useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import { ConstellationStarView } from "./ConstellationStar";

const LINE_THICKNESS = 1.2;
const LINE_GLOW_THICKNESS = 4;

interface ConstellationSkyProps {
  stars: ConstellationStar[];
  theme: MindCareTheme;
  onPressStar: (star: ConstellationStar) => void;
  /** Id of the currently selected star (stronger glow). */
  selectedId?: string | null;
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

/** Dim, non-interactive backdrop dots for atmosphere. */
const BACKDROP_DOTS = Array.from({ length: 18 }, (_, i) => ({
  x: ((i * 37 + 11) % 97) / 100,
  y: ((i * 53 + 7) % 91) / 100,
  dim: i % 3 === 0,
}));

export function ConstellationSky({
  stars,
  theme,
  onPressStar,
  selectedId,
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

  /**
   * Connect consecutive stars in chronological order (oldest → newest). The
   * lines are quiet, low-opacity strokes so the sky stays calm and clean.
   */
  const lines = useMemo<SkyLine[]>(() => {
    if (layout.width === 0 || layout.height === 0) return [];
    if (stars.length < 2) return [];
    const sorted = [...stars].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const result: SkyLine[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1];
      const b = sorted[i];
      result.push({
        key: `${a.journalId}_${b.journalId}`,
        x1: a.position.x * layout.width,
        y1: a.position.y * layout.height,
        x2: b.position.x * layout.width,
        y2: b.position.y * layout.height,
      });
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

      {/* Ambient backdrop dots */}
      {BACKDROP_DOTS.map((pos, idx) => (
        <View
          key={`backdrop_${idx}`}
          pointerEvents="none"
          style={[
            styles.backdrop,
            {
              left: `${pos.x * 100}%`,
              top: `${pos.y * 100}%`,
              opacity: pos.dim ? 0.2 : 0.12,
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
              strokeOpacity={0.07}
              strokeLinecap="round"
            />
            <Line
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={lineColor}
              strokeWidth={LINE_THICKNESS}
              strokeOpacity={0.38}
              strokeLinecap="round"
            />
          </React.Fragment>
        ))}
      </Svg>

      {/* Real stars */}
      {stars.map((star) => (
        <ConstellationStarView
          key={star.journalId}
          star={star}
          selected={star.journalId === selectedId}
          animate={
            star.isNewest || star.isMilestone || star.journalId === selectedId
          }
          onPress={onPressStar}
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
});
