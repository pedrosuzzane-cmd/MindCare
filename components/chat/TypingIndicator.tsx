/**
 * Typing indicator component showing animated dots while AI is responding.
 */

import React, { useEffect, useRef } from "react";
import { Animated, Image, Platform, StyleSheet, View } from "react-native";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";

export default function TypingIndicator() {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: Platform.OS !== "web",
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 400,
            useNativeDriver: Platform.OS !== "web",
          }),
        ]),
      );
    };

    const anim1 = animate(dot1, 0);
    const anim2 = animate(dot2, 200);
    const anim3 = animate(dot3, 400);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1, dot2, dot3]);

  const getDotStyle = (dot: Animated.Value) => ({
    opacity: dot.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 1],
    }),
    transform: [
      {
        scale: dot.interpolate({
          inputRange: [0, 1],
          outputRange: [0.8, 1.2],
        }),
      },
    ],
  });

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Image source={require("@/assets/images/mindyai.png")} style={styles.avatarImage} />
      </View>
      <View style={styles.bubble}>
        <View style={styles.dotsContainer}>
          <Animated.View style={[styles.dot, getDotStyle(dot1)]} />
          <Animated.View style={[styles.dot, getDotStyle(dot2)]} />
          <Animated.View style={[styles.dot, getDotStyle(dot3)]} />
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      marginBottom: 16,
      paddingHorizontal: 16,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.softPurple,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 8,
      marginTop: 4,
      overflow: "hidden",
    },
    avatarImage: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    bubble: {
      backgroundColor: theme.inputBg,
      borderRadius: 18,
      borderBottomLeftRadius: 4,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    dotsContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.primary,
    },
  });