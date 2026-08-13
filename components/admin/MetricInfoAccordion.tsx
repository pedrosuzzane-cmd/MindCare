import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface MetricInfoLine {
  label?: string;
  text: string;
}

interface MetricInfoAccordionProps {
  title?: string;
  lines: MetricInfoLine[];
}

/**
 * Collapsible "How is this calculated?" explainer used under analytics
 * sections. Collapsed by default so methodology text does not crowd the UI.
 */
export function MetricInfoAccordion({
  title = "How is this calculated?",
  lines,
}: MetricInfoAccordionProps) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => [
          styles.header,
          open && styles.headerOpen,
          pressed && { opacity: 0.8 },
        ]}
      >
        <View style={styles.headerLeft}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color="#8A63D2"
          />
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color="#8A63D2"
        />
      </Pressable>
      {open && (
        <View style={styles.body}>
          {lines.map((line, i) => (
            <View key={i} style={styles.lineRow}>
              {line.label ? (
                <Text style={styles.lineLabel}>{line.label}</Text>
              ) : null}
              <Text style={styles.lineText}>{line.text}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E6DCF7",
    backgroundColor: "#FBF9FF",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  headerOpen: {
    backgroundColor: "#F5F0FE",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#5B2E91",
    flexShrink: 1,
  },
  body: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 8,
  },
  lineRow: {
    gap: 2,
  },
  lineLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#8A63D2",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  lineText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#334155",
  },
});
