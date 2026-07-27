import React, { useEffect, useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
  20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37,
  38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55,
  56, 57, 58, 59,
];
const PERIODS: ("AM" | "PM")[] = ["AM", "PM"];

const ITEM_HEIGHT = 40;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

// ── Animated wheel item ──
function WheelItem<T>({
  item,
  index,
  scrollY,
  renderItem,
}: {
  item: T;
  index: number;
  scrollY: SharedValue<number>;
  renderItem: (item: T) => React.ReactNode;
}) {
  const itemOffset = index * ITEM_HEIGHT;

  const animatedStyle = useAnimatedStyle(() => {
    const distance = Math.abs(scrollY.value - itemOffset);
    const opacity = interpolate(
      distance,
      [0, PICKER_HEIGHT / 2],
      [1, 0.25],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      distance,
      [0, PICKER_HEIGHT / 2],
      [1, 0.85],
      Extrapolation.CLAMP,
    );
    return { opacity, transform: [{ scale }] };
  });

  return (
    <Animated.View style={animatedStyle}>
      {renderItem(item)}
    </Animated.View>
  );
}

// ── Single scroll column with infinite loop ──
function ScrollColumn<T>({
  items,
  selectedValue,
  onValueChange,
  renderItem,
  width,
}: {
  items: T[];
  selectedValue: T;
  onValueChange: (value: T) => void;
  renderItem: (item: T, isSelected: boolean) => React.ReactNode;
  width: number;
}) {
  const loopedItems = [...items, ...items, ...items];
  const middleStart = items.length;

  const scrollRef = useRef<Animated.ScrollView>(null);
  const initialIndex =
    items.indexOf(selectedValue) >= 0
      ? items.indexOf(selectedValue) + middleStart
      : middleStart;

  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    const idx = items.indexOf(selectedValue);
    if (idx >= 0) {
      const target = idx + middleStart;
      if (target !== currentIndex) {
        setCurrentIndex(target);
        scrollRef.current?.scrollTo({
          y: target * ITEM_HEIGHT,
          animated: false,
        });
      }
    }
  }, [selectedValue]);

  const scrollY = useSharedValue(initialIndex * ITEM_HEIGHT);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const snapToNearest = (y: number) => {
    const idx = Math.round(y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(idx, loopedItems.length - 1));
    scrollRef.current?.scrollTo({
      y: clamped * ITEM_HEIGHT,
      animated: true,
    });
    return clamped;
  };

  const handleMomentumEnd = (
    e: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const y = e.nativeEvent.contentOffset.y;
    let newIndex = Math.round(y / ITEM_HEIGHT);

    // Teleport back to middle block if near edges
    if (newIndex < items.length / 2) {
      newIndex += middleStart;
      scrollRef.current?.scrollTo({
        y: newIndex * ITEM_HEIGHT,
        animated: false,
      });
    } else if (newIndex >= items.length * 2.5) {
      newIndex -= middleStart;
      scrollRef.current?.scrollTo({
        y: newIndex * ITEM_HEIGHT,
        animated: false,
      });
    }

    const selectedIdx = newIndex % items.length;
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
      onValueChange(items[selectedIdx]);
    }
    scrollRef.current?.scrollTo({
      y: newIndex * ITEM_HEIGHT,
      animated: true,
    });
  };

  const handleScrollEndDrag = (
    e: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const y = e.nativeEvent.contentOffset.y;
    snapToNearest(y);
  };

  return (
    <View style={[styles.column, { width }]}>
      <View style={styles.highlight} pointerEvents="none" />
      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={scrollHandler}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate={0.998}
        onMomentumScrollEnd={handleMomentumEnd}
        onScrollEndDrag={handleScrollEndDrag}
        bounces={false}
        contentOffset={{ x: 0, y: initialIndex * ITEM_HEIGHT }}
      >
        <View style={{ height: PICKER_HEIGHT / 2 - ITEM_HEIGHT / 2 }} />
        {loopedItems.map((item, idx) => (
          <WheelItem
            key={idx}
            item={item}
            index={idx}
            scrollY={scrollY}
            renderItem={(it) =>
              renderItem(it, idx === currentIndex)
            }
          />
        ))}
        <View style={{ height: PICKER_HEIGHT / 2 - ITEM_HEIGHT / 2 }} />
      </Animated.ScrollView>
    </View>
  );
}

// ── Main component ──
interface ClockTimePickerProps {
  val: { hour: number; minute: number; period: "AM" | "PM" };
  onChange: (v: { hour: number; minute: number; period: "AM" | "PM" }) => void;
  accentColor?: string;
}

export default function ClockTimePicker({
  val,
  onChange,
  accentColor = "#8A63D2",
}: ClockTimePickerProps) {
  const [hour, setHour] = useState(val.hour);
  const [minute, setMinute] = useState(val.minute);
  const [period, setPeriod] = useState<"AM" | "PM">(val.period);

  useEffect(() => {
    setHour(val.hour);
    setMinute(val.minute);
    setPeriod(val.period);
  }, [val.hour, val.minute, val.period]);

  const emit = (h: number, m: number, p: "AM" | "PM") => {
    onChange({ hour: h, minute: m, period: p });
  };

  return (
    <View style={styles.container}>
      {/* Hour column */}
      <ScrollColumn
        items={HOURS}
        selectedValue={hour}
        width={60}
        onValueChange={(v) => {
          setHour(v);
          emit(v, minute, period);
        }}
        renderItem={(item, sel) => (
          <View style={styles.item}>
            <Text
              style={[
                styles.itemText,
                sel && styles.itemTextSelected,
                sel && { color: accentColor },
              ]}
            >
              {item}
            </Text>
          </View>
        )}
      />

      {/* Separator */}
      <View style={styles.separator}>
        <Text style={[styles.separatorText, { color: accentColor }]}>:</Text>
      </View>

      {/* Minute column */}
      <ScrollColumn
        items={MINUTES}
        selectedValue={minute}
        width={60}
        onValueChange={(v) => {
          setMinute(v);
          emit(hour, v, period);
        }}
        renderItem={(item, sel) => (
          <View style={styles.item}>
            <Text
              style={[
                styles.itemText,
                sel && styles.itemTextSelected,
                sel && { color: accentColor },
              ]}
            >
              {String(item).padStart(2, "0")}
            </Text>
          </View>
        )}
      />

      {/* Period column */}
      <ScrollColumn
        items={PERIODS}
        selectedValue={period}
        width={60}
        onValueChange={(v) => {
          setPeriod(v);
          emit(hour, minute, v);
        }}
        renderItem={(item, sel) => (
          <View style={styles.item}>
            <Text
              style={[
                styles.periodText,
                sel && styles.periodTextSelected,
                sel && { color: accentColor },
              ]}
            >
              {item}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FAF8FF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  column: {
    height: PICKER_HEIGHT,
    overflow: "hidden",
    position: "relative",
  },
  highlight: {
    position: "absolute",
    top: PICKER_HEIGHT / 2 - ITEM_HEIGHT / 2,
    left: 2,
    right: 2,
    height: ITEM_HEIGHT,
    backgroundColor: "rgba(138, 99, 210, 0.08)",
    borderRadius: 10,
    zIndex: 10,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: "center",
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  itemText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#999",
    fontVariant: ["tabular-nums"],
  },
  itemTextSelected: {
    fontSize: 24,
    fontWeight: "800",
  },
  periodText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#999",
  },
  periodTextSelected: {
    fontSize: 20,
    fontWeight: "800",
  },
  separator: {
    width: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 2,
  },
  separatorText: {
    fontSize: 26,
    fontWeight: "800",
  },
});
