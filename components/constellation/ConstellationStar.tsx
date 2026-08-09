import { ConstellationStar } from "@/types/constellation";
import {
  STAR_BRIGHTNESS_OPACITY,
  STAR_COLORS,
  STAR_TYPE_CONFIG,
  starCategoryColor,
} from "@/utils/constellationOptions";
import React, { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const TOUCH_SIZE = 44;
const HALF_TOUCH = TOUCH_SIZE / 2;

interface ConstellationStarProps {
  star: ConstellationStar;
  animate?: boolean;
  onPress?: (star: ConstellationStar) => void;
  accessibilityLabel?: string;
  /** Replaces the configured glyph (e.g. an achievement emoji). */
  glyph?: string;
}

/** Deterministic fallback palette for legacy stars without a category. */
const pickColor = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const palette = [
    STAR_COLORS.lavender,
    STAR_COLORS.paleViolet,
    STAR_COLORS.lightPurple,
    STAR_COLORS.white,
  ];
  return palette[Math.abs(hash) % palette.length];
};

const CLUSTER_DOTS = [
  { dx: -4, dy: 2, s: 4 },
  { dx: 3, dy: -2, s: 5 },
  { dx: 1, dy: 3, s: 3 },
];

/**
 * Pick a calm idle animation for a star. Distant (tiny/cluster) stars stay
 * still; a subset of the rest twinkle gently so the sky breathes without a
 * hundred simultaneous loops.
 */
const twinkleProfileFor = (star: ConstellationStar): {
  amplitude: number;
  period: number;
  delay: number;
  animate: boolean;
} => {
  let hash = 0;
  for (let i = 0; i < star.id.length; i++) {
    hash = (hash << 5) - hash + star.id.charCodeAt(i);
    hash |= 0;
  }
  const distant = star.type === "tiny" || star.type === "cluster";
  if (distant) return { amplitude: 0, period: 0, delay: 0, animate: false };

  const specialGlow = star.type === "special" || star.type === "bright";
  if (specialGlow) {
    return {
      amplitude: 0.35,
      period: 2400,
      delay: Math.abs(hash) % 2500,
      animate: true,
    };
  }

  const mode = Math.abs(hash) % 4;
  if (mode === 0) {
    // Quick sparkle for a few stars.
    return { amplitude: 0.45, period: 1300, delay: Math.abs(hash) % 3000, animate: true };
  }
  if (mode === 1) {
    // Gentle, slow pulse for a few more.
    return { amplitude: 0.2, period: 4000, delay: Math.abs(hash) % 3000, animate: true };
  }
  // Most normal stars stay calm and static.
  return { amplitude: 0, period: 0, delay: 0, animate: false };
};

export function ConstellationStarView({
  star,
  animate = false,
  onPress,
  accessibilityLabel,
  glyph,
}: ConstellationStarProps) {
  const config = STAR_TYPE_CONFIG[star.type] ?? STAR_TYPE_CONFIG.sparkle;
  const baseOpacity = STAR_BRIGHTNESS_OPACITY[star.brightness] ?? 0.6;
  const isGold = star.source === "achievement" || star.source === "milestone";
  const color = isGold
    ? STAR_COLORS.gold
    : starCategoryColor(star.category) ?? pickColor(star.id);
  const renderedGlyph = glyph ?? config.glyph;

  const progress = useSharedValue(animate ? 0 : 1);
  const twinkle = useSharedValue(0);
  const profile = useMemo(() => twinkleProfileFor(star), [star]);

  useEffect(() => {
    if (animate) {
      progress.value = 0;
      progress.value = withTiming(1, {
        duration: 700,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [animate, progress]);

  // Idle twinkle — only a small, deterministic subset of stars loop forever.
  useEffect(() => {
    if (!profile.animate) return;
    twinkle.value = 0;
    twinkle.value = withDelay(
      profile.delay,
      withRepeat(
        withTiming(1, { duration: profile.period, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [profile, twinkle]);

  const animatedStyle = useAnimatedStyle(() => {
    const twinkleFactor = 1 - twinkle.value * profile.amplitude;
    return {
      opacity: progress.value * config.opacity * baseOpacity * twinkleFactor,
      transform: [
        { translateX: -HALF_TOUCH },
        { translateY: -HALF_TOUCH },
        { scale: progress.value * (0.4 + 0.6 * (1 - twinkle.value * 0.1)) },
      ],
    };
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: progress.value * (0.18 + twinkle.value * 0.28),
  }));

  const outerGlowStyle = useAnimatedStyle(() => ({
    opacity: progress.value * (0.08 + twinkle.value * 0.12),
  }));

  const x = Math.min(0.96, Math.max(0.04, star.position.x)) * 100;
  const y = Math.min(0.96, Math.max(0.04, star.position.y)) * 100;

  const glowSize = config.sizePx + 14;
  const outerGlowSize = config.sizePx + 28;
  const coreSize = Math.max(3, Math.round(config.sizePx * 0.24));

  return (
    <View
      style={[styles.anchor, { left: `${x}%`, top: `${y}%` }]}
      pointerEvents="box-none"
    >
      <Animated.View style={[styles.touch, animatedStyle]}>
        <Pressable
          onPress={() => onPress?.(star)}
          hitSlop={6}
          style={styles.pressable}
          accessibilityRole="button"
          accessibilityLabel={
            accessibilityLabel ||
            (star.source === "gratitude"
              ? "Gratitude star"
              : star.source === "achievement"
                ? "Achievement star"
                : "Reflection star")
          }
          accessibilityHint="Opens details about this star"
        >
          {config.glow && (
            <>
              <Animated.View
                style={[
                  styles.glowOuter,
                  {
                    width: outerGlowSize,
                    height: outerGlowSize,
                    borderRadius: outerGlowSize / 2,
                    backgroundColor: color,
                  },
                  outerGlowStyle,
                ]}
              />
              <Animated.View
                style={[
                  styles.glow,
                  {
                    width: glowSize,
                    height: glowSize,
                    borderRadius: glowSize / 2,
                    backgroundColor: color,
                  },
                  glowStyle,
                ]}
              />
              <View
                style={[
                  styles.glowCore,
                  {
                    width: coreSize,
                    height: coreSize,
                    borderRadius: coreSize / 2,
                    backgroundColor: color,
                  },
                ]}
              />
            </>
          )}
          {config.cluster ? (
            <View style={styles.clusterBox}>
              {CLUSTER_DOTS.map((dot, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.clusterDot,
                    {
                      width: dot.s,
                      height: dot.s,
                      borderRadius: dot.s / 2,
                      backgroundColor: color,
                      left: dot.dx,
                      top: dot.dy,
                    },
                  ]}
                />
              ))}
            </View>
          ) : (
            <Text
              style={[
                styles.glyph,
                {
                  fontSize: config.sizePx,
                  color,
                  textShadowColor: config.glow ? color : "transparent",
                },
              ]}
            >
              {renderedGlyph}
            </Text>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: "absolute",
    width: 0,
    height: 0,
  },
  touch: {
    width: TOUCH_SIZE,
    height: TOUCH_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  pressable: {
    width: TOUCH_SIZE,
    height: TOUCH_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  glyph: {
    fontWeight: "400",
    textShadowRadius: 8,
  },
  glow: {
    position: "absolute",
  },
  glowOuter: {
    position: "absolute",
  },
  glowCore: {
    position: "absolute",
    opacity: 0.9,
  },
  clusterBox: {
    width: 20,
    height: 14,
  },
  clusterDot: {
    position: "absolute",
  },
});
