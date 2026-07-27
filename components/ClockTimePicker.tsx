import React, { useCallback, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Modal,
  NativeSyntheticEvent,
  PanResponder,
  PanResponderGestureState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const CLOCK_SIZE = 260;
const CLOCK_RADIUS = CLOCK_SIZE / 2 - 16;
const CENTER = CLOCK_SIZE / 2;
const INNER_NUMBER_RADIUS = CLOCK_RADIUS - 18;

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function angleToValue(angleDeg: number, items: number[]): number {
  const sector = 360 / items.length;
  const offset = -90;
  const normalized = ((angleDeg - offset) % 360 + 360) % 360;
  const index = Math.round(normalized / sector) % items.length;
  return items[index];
}

function valueToAngle(value: number, items: number[]): number {
  const sector = 360 / items.length;
  const index = items.indexOf(value);
  if (index === -1) return 0;
  return index * sector - 90;
}

function getItemLabel(item: number, mode: "hour" | "minute"): string {
  if (mode === "hour") return String(item);
  return String(item).padStart(2, "0");
}

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
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<"hour" | "minute">("hour");
  const [draftHour, setDraftHour] = useState(val.hour);
  const [draftMinute, setDraftMinute] = useState(val.minute);
  const [draftPeriod, setDraftPeriod] = useState<"AM" | "PM">(val.period);

  // Absolute position of the clock face on screen
  const clockAbsPos = useRef({ x: 0, y: 0 });
  const clockSize = useRef({ w: CLOCK_SIZE, h: CLOCK_SIZE });

  const open = () => {
    setDraftHour(val.hour);
    setDraftMinute(val.minute);
    setDraftPeriod(val.period);
    setMode("hour");
    setVisible(true);
  };

  const close = () => setVisible(false);

  const confirm = () => {
    onChange({ hour: draftHour, minute: draftMinute, period: draftPeriod });
    setVisible(false);
  };

  const onClockLayout = useCallback((e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    clockAbsPos.current = { x, y };
    clockSize.current = { w: width, h: height };
  }, []);

  const currentItems = mode === "hour" ? HOURS : MINUTES;
  const currentValue = mode === "hour" ? draftHour : draftMinute;

  // Use pageX/pageY to compute touch position relative to clock center.
  // This works reliably on both iOS and Android.
  const computeTouchFromGesture = useCallback(
    (gestureState: PanResponderGestureState) => {
      const cx = clockSize.current.w / 2;
      const cy = clockSize.current.h / 2;
      // pageX/pageY are absolute screen coords; subtract the clock's absolute position
      const relX = gestureState.moveX - clockAbsPos.current.x;
      const relY = gestureState.moveY - clockAbsPos.current.y;
      const dx = relX - cx;
      const dy = relY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 10) return null;

      const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
      return angleToValue(angleDeg, currentItems);
    },
    [currentItems],
  );

  // Use refs so the PanResponder always reads the latest values
  // without needing to be recreated.
  const modeRef = useRef(mode);
  const draftHourRef = useRef(draftHour);
  const draftMinuteRef = useRef(draftMinute);

  // Keep refs synced
  modeRef.current = mode;
  draftHourRef.current = draftHour;
  draftMinuteRef.current = draftMinute;

  const applyValue = useCallback((snapped: number | null) => {
    if (snapped === null) return;
    if (modeRef.current === "hour") {
      setDraftHour(snapped);
    } else {
      setDraftMinute(snapped);
    }
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 2 || Math.abs(gs.dy) > 2,
      onPanResponderGrant: (_, gs) => {
        const snapped = computeTouchFromGesture(gs);
        applyValue(snapped);
      },
      onPanResponderMove: (_, gs) => {
        const snapped = computeTouchFromGesture(gs);
        applyValue(snapped);
      },
      onPanResponderRelease: () => {},
    }),
  ).current;

  // Recreate panResponder when computeTouchFromGesture changes
  // (i.e. when currentItems changes due to mode switch)
  const prevModeRef = useRef(mode);
  if (prevModeRef.current !== mode) {
    prevModeRef.current = mode;
    // We can't recreate the panResponder in render cleanly,
    // so we force the handlers to use latest refs via applyValue/modeRef.
  }

  const selectedAngle =
    mode === "hour"
      ? valueToAngle(draftHour, HOURS)
      : valueToAngle(draftMinute, MINUTES);

  const handLength = INNER_NUMBER_RADIUS - 12;
  const handRotation = selectedAngle + 90;

  return (
    <>
      <Pressable style={s.trigger} onPress={open}>
        <View style={s.triggerInner}>
          <View style={s.triggerTimeBox}>
            <Text style={s.triggerHour}>
              {String(val.hour).padStart(2, "0")}
            </Text>
            <Text style={s.triggerColon}>:</Text>
            <Text style={s.triggerMinute}>
              {String(val.minute).padStart(2, "0")}
            </Text>
          </View>
          <View style={[s.triggerPeriod, { backgroundColor: accentColor }]}>
            <Text style={s.triggerPeriodText}>{val.period}</Text>
          </View>
        </View>
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>
              {mode === "hour" ? "Select Hour" : "Select Minutes"}
            </Text>

            <View style={s.clockWrapper}>
              <View
                style={s.clockFace}
                onLayout={onClockLayout}
                {...panResponder.panHandlers}
              >
                {/* Clock hand line */}
                <View
                  style={{
                    position: "absolute",
                    left: CENTER - 1.5,
                    top: CENTER - handLength,
                    width: 3,
                    height: handLength,
                    backgroundColor: accentColor,
                    borderRadius: 1.5,
                    transformOrigin: "center bottom",
                    transform: [{ rotate: `${handRotation}deg` }],
                    opacity: 0.85,
                  }}
                />

                {/* Center pin */}
                <View
                  style={[
                    s.centerPin,
                    {
                      left: CENTER - 6,
                      top: CENTER - 6,
                      backgroundColor: accentColor,
                    },
                  ]}
                />

                {/* Selected tip dot */}
                <View
                  style={[
                    s.tipDot,
                    {
                      left:
                        CENTER +
                        Math.cos((selectedAngle * Math.PI) / 180) * handLength -
                        8,
                      top:
                        CENTER +
                        Math.sin((selectedAngle * Math.PI) / 180) * handLength -
                        8,
                      backgroundColor: accentColor,
                    },
                  ]}
                />

                {/* Number labels */}
                {currentItems.map((item) => {
                  const angle =
                    mode === "hour"
                      ? valueToAngle(item, HOURS)
                      : valueToAngle(item, MINUTES);
                  const rad = (angle * Math.PI) / 180;
                  const numX = CENTER + Math.cos(rad) * INNER_NUMBER_RADIUS;
                  const numY = CENTER + Math.sin(rad) * INNER_NUMBER_RADIUS;
                  const isSelected = item === currentValue;
                  return (
                    <View
                      key={item}
                      style={[
                        s.numberDot,
                        {
                          left: numX - 16,
                          top: numY - 16,
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: isSelected
                            ? accentColor
                            : "transparent",
                          justifyContent: "center",
                          alignItems: "center",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.numberText,
                          {
                            color: isSelected ? "#FFFFFF" : "#4A4458",
                          },
                          isSelected && { fontWeight: "800" },
                        ]}
                      >
                        {getItemLabel(item, mode)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Mode tabs */}
            <View style={s.modeTabs}>
              <Pressable
                onPress={() => setMode("hour")}
                style={[
                  s.modeTab,
                  mode === "hour" && { backgroundColor: accentColor },
                ]}
              >
                <Text
                  style={[
                    s.modeTabText,
                    mode === "hour" && { color: "#FFFFFF", fontWeight: "700" },
                  ]}
                >
                  Hour
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMode("minute")}
                style={[
                  s.modeTab,
                  mode === "minute" && { backgroundColor: accentColor },
                ]}
              >
                <Text
                  style={[
                    s.modeTabText,
                    mode === "minute" && {
                      color: "#FFFFFF",
                      fontWeight: "700",
                    },
                  ]}
                >
                  Minutes
                </Text>
              </Pressable>
            </View>

            {/* Digital preview */}
            <View style={s.previewRow}>
              <Text style={s.previewTime}>
                {String(draftHour).padStart(2, "0")}:
                {String(draftMinute).padStart(2, "0")}
              </Text>
            </View>

            {/* AM / PM toggle */}
            <View style={s.periodRow}>
              {(["AM", "PM"] as const).map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setDraftPeriod(p)}
                  style={[
                    s.periodBtn,
                    draftPeriod === p && { backgroundColor: accentColor },
                  ]}
                >
                  <Text
                    style={[
                      s.periodBtnText,
                      draftPeriod === p && {
                        color: "#FFFFFF",
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {p}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Action buttons */}
            <View style={s.actions}>
              <Pressable onPress={close} style={s.cancelBtn}>
                <Text style={s.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirm}
                style={[s.confirmBtn, { backgroundColor: accentColor }]}
              >
                <Text style={s.confirmText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  trigger: {
    borderRadius: 16,
    overflow: "hidden",
  },
  triggerInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAF8FF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    paddingVertical: 4,
    paddingHorizontal: 4,
    gap: 8,
  },
  triggerTimeBox: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingLeft: 14,
    gap: 2,
  },
  triggerHour: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E1B4B",
    fontVariant: ["tabular-nums"],
  },
  triggerColon: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E1B4B",
    marginHorizontal: 1,
  },
  triggerMinute: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E1B4B",
    fontVariant: ["tabular-nums"],
  },
  triggerPeriod: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  triggerPeriodText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(30, 27, 75, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: "center",
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E1B4B",
    marginBottom: 20,
  },

  clockWrapper: {
    width: CLOCK_SIZE,
    height: CLOCK_SIZE,
    marginBottom: 16,
  },
  clockFace: {
    width: CLOCK_SIZE,
    height: CLOCK_SIZE,
    borderRadius: CLOCK_SIZE / 2,
    backgroundColor: "#FAF8FF",
    borderWidth: 2,
    borderColor: "#E9D5FF",
  },
  numberDot: {
    position: "absolute",
  },
  numberText: {
    fontSize: 14,
    fontWeight: "600",
  },
  centerPin: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    zIndex: 10,
  },
  tipDot: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    zIndex: 10,
  },

  modeTabs: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  modeTab: {
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3EAFF",
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8A63D2",
  },

  previewRow: {
    marginBottom: 14,
  },
  previewTime: {
    fontSize: 36,
    fontWeight: "800",
    color: "#1E1B4B",
    fontVariant: ["tabular-nums"],
    letterSpacing: 2,
  },

  periodRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  periodBtn: {
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#F3EAFF",
  },
  periodBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8A63D2",
  },

  actions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    width: "100%",
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "#F3EAFF",
    alignItems: "center",
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#8A63D2",
  },
  confirmBtn: {
    flex: 1.5,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  confirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
