import { ConstellationStar } from "@/types/constellation";
import {
  STAR_BRIGHTNESS_OPACITY,
  STAR_COLORS,
  STAR_TYPE_CONFIG,
} from "@/utils/constellationOptions";
import React, { useEffect } from "react";
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

export function ConstellationStarView({
  star,
  animate = false,
  onPress,
  accessibilityLabel,
  glyph,
}: ConstellationStarProps) {
  const config = STAR_TYPE_CONFIG[star.type] ?? STAR_TYPE_CONFIG.sparkle;
  const baseOpacity = STAR_BRIGHTNESS_OPACITY[star.brightness] ?? 0.6;
  const isSpecial = config.gold || star.brightness === "special";
  const color = isSpecial ? STAR_COLORS.gold : pickColor(star.id);
  const renderedGlyph = glyph ?? config.glyph;

  const progress = useSharedValue(animate ? 0 : 1);
  const twinkle = useSharedValue(0);

  useEffect(() => {
    if (animate) {
      progress.value = 0;
      progress.value = withTiming(1, {
        duration: 700,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [animate, progress]);

  // Very subtle idle twinkle on a small subset of stars (never every star).
  useEffect(() => {
    let hash = 0;
    for (let i = 0; i < star.id.length; i++) {
      hash = (hash << 5) - hash + star.id.charCodeAt(i);
      hash |= 0;
    }
    const shouldTwinkle = Math.abs(hash) % 4 === 0 && !isSpecial;
    if (!shouldTwinkle) return;

    twinkle.value = 0;
    twinkle.value = withDelay(
      Math.abs(hash) % 2000,
      withRepeat(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [star.id, isSpecial, twinkle]);

  const animatedStyle = useAnimatedStyle(() => {
    const twinkleFactor = 1 - twinkle.value * 0.35; // 1.0 → 0.65
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
    opacity: progress.value * (0.16 + twinkle.value * 0.22),
  }));

  const x = Math.min(0.96, Math.max(0.04, star.position.x)) * 100;
  const y = Math.min(0.96, Math.max(0.04, star.position.y)) * 100;

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
            <Animated.View
              style={[
                styles.glow,
                {
                  width: config.sizePx + 16,
                  height: config.sizePx + 16,
                  borderRadius: (config.sizePx + 16) / 2,
                  backgroundColor: color,
                },
                glowStyle,
              ]}
            />
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
  clusterBox: {
    width: 20,
    height: 14,
  },
  clusterDot: {
    position: "absolute",
  },
});
