import { ConstellationStar } from "@/types/constellation";
import { STAR_TYPE_CONFIG, formatJournalDate } from "@/utils/constellationOptions";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const TOUCH_SIZE = 44;
const HALF_TOUCH = TOUCH_SIZE / 2;

interface ConstellationStarProps {
  star: ConstellationStar;
  /** Star currently selected by the student (stronger glow + pulse). */
  selected?: boolean;
  /** Play the calm idle pulse (newest / milestone / selected stars only). */
  animate?: boolean;
  /** Older star outside the connected path — rendered a little dimmer. */
  dim?: boolean;
  onPress?: (star: ConstellationStar) => void;
  accessibilityLabel?: string;
}

export function ConstellationStarView({
  star,
  selected = false,
  animate = false,
  dim = false,
  onPress,
  accessibilityLabel,
}: ConstellationStarProps) {
  const config = STAR_TYPE_CONFIG[star.type] ?? STAR_TYPE_CONFIG.sparkle;
  const color = star.color;
  const renderedGlyph = config.glyph;

  // Older stars outside the connected path render a little dimmer so the
  // sky stays readable once the constellation grows large.
  const dimmed =
    dim && !selected && !star.isMilestone && !star.isNewest ? 0.55 : 1;

  // Gentle idle pulse — only played for a small subset of stars so the sky
  // never spins hundreds of loops.
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!animate) {
      pulse.value = 0;
      return;
    }
    pulse.value = 0;
    pulse.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => {
      pulse.value = 0;
    };
  }, [animate, pulse]);

  const animatedStyle = useAnimatedStyle(() => {
    const boost = selected ? 0.12 : 0.06;
    return {
      opacity: config.opacity * (selected ? 1 : 0.92) * dimmed,
      transform: [
        { translateX: -HALF_TOUCH },
        { translateY: -HALF_TOUCH },
        { scale: (selected ? 1.16 : 1) + pulse.value * boost },
      ],
    };
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: (selected ? 0.32 : 0.16) * dimmed + pulse.value * (selected ? 0.2 : 0.1),
  }));

  const outerGlowStyle = useAnimatedStyle(() => ({
    opacity: (selected ? 0.16 : 0.08) * dimmed + pulse.value * (selected ? 0.12 : 0.06),
  }));

  const x = Math.min(0.95, Math.max(0.05, star.position.x)) * 100;
  const y = Math.min(0.94, Math.max(0.06, star.position.y)) * 100;

  const glowSize = config.sizePx + (selected ? 20 : 14);
  const outerGlowSize = config.sizePx + (selected ? 40 : 28);
  const coreSize = Math.max(4, Math.round(config.sizePx * 0.22));

  return (
    <View
      style={[styles.anchor, { left: `${x}%`, top: `${y}%` }]}
      pointerEvents="box-none"
    >
      <Animated.View style={[styles.touch, animatedStyle]}>
        <Pressable
          onPress={() => onPress?.(star)}
          hitSlop={8}
          style={styles.pressable}
          accessibilityRole="button"
          accessibilityLabel={
            accessibilityLabel ||
            `${formatJournalDate(star.date)} journal star, ${star.categoryName} category, ${star.moodLabel} mood`
          }
          accessibilityHint="Opens your reflections for that day"
        >
          {config.glow || selected ? (
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
                    backgroundColor: selected ? "#FFFFFF" : color,
                  },
                ]}
              />
            </>
          ) : null}
          <Text
            style={[
              styles.glyph,
              {
                fontSize: config.sizePx,
                color: selected ? "#FFFFFF" : color,
                textShadowColor: config.glow || selected ? color : "transparent",
              },
            ]}
          >
            {renderedGlyph}
          </Text>
          {star.isNewest && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>new</Text>
            </View>
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
  newBadge: {
    position: "absolute",
    top: 4,
    right: 2,
    backgroundColor: "rgba(252, 211, 77, 0.22)",
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  newBadgeText: {
    fontSize: 8,
    fontWeight: "800",
    color: "#FCD34D",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
});
