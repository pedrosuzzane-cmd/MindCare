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
const LINE_COLOR = "#A78BFA";
const LINE_OPACITY = 0.25;
const LINE_ACTIVE_OPACITY = 0.6;
const LINE_ACTIVE_THICKNESS = 1.7;

/**
 * Only the most recent stars are connected with constellation lines. Once the
 * sky grows past this many journals, older stars stay visible but the path
 * stays readable and never turns into a spider web.
 */
const CONNECTED_LINE_LIMIT = 40;

interface ConstellationSkyProps {
  stars: ConstellationStar[];
  theme: MindCareTheme;
  onPressStar: (star: ConstellationStar) => void;
  /** Id of the currently selected star (stronger glow). */
  selectedId?: string | null;
  /** Latest journal mood color; tints the sky when present. */
  moodColor?: string;
  /** Number of most-recent stars to connect with constellation lines. */
  lineLimit?: number;
}

interface SkyLine {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Touches the currently selected star, so it renders a little brighter. */
  active: boolean;
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
  lineLimit = CONNECTED_LINE_LIMIT,
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

  /**
   * The newest `lineLimit` stars (chronologically) form the connected path;
   * older stars render without lines once the sky grows large.
   */
  const connectedStars = useMemo(() => {
    const sorted = [...stars].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const windowStart = Math.max(0, sorted.length - lineLimit);
    return sorted.slice(windowStart);
  }, [stars, lineLimit]);

  const connectedIds = useMemo(
    () => new Set(connectedStars.map((s) => s.journalId)),
    [connectedStars],
  );

  /**
   * Connect consecutive stars in chronological order (oldest → newest). The
   * lines are quiet, low-opacity strokes so the sky stays calm and clean. The
   * two segments immediately before/after the selected star brighten slightly
   * to show where it sits in the path.
   */
  const lines = useMemo<SkyLine[]>(() => {
    if (layout.width === 0 || layout.height === 0) return [];
    if (connectedStars.length < 2) return [];
    const result: SkyLine[] = [];
    for (let i = 1; i < connectedStars.length; i++) {
      const a = connectedStars[i - 1];
      const b = connectedStars[i];
      const active =
        selectedId != null &&
        (a.journalId === selectedId || b.journalId === selectedId);
      result.push({
        key: `${a.journalId}_${b.journalId}`,
        x1: a.position.x * layout.width,
        y1: a.position.y * layout.height,
        x2: b.position.x * layout.width,
        y2: b.position.y * layout.height,
        active,
      });
    }
    return result;
  }, [connectedStars, layout, selectedId]);

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
              stroke={LINE_COLOR}
              strokeWidth={LINE_GLOW_THICKNESS}
              strokeOpacity={line.active ? 0.16 : 0.05}
              strokeLinecap="round"
            />
            <Line
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={LINE_COLOR}
              strokeWidth={line.active ? LINE_ACTIVE_THICKNESS : LINE_THICKNESS}
              strokeOpacity={line.active ? LINE_ACTIVE_OPACITY : LINE_OPACITY}
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
          dim={!connectedIds.has(star.journalId)}
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
