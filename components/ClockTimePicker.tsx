import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, { useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useMindCareTheme } from "@/contexts/ThemeContext";

interface Props {
  val: { hour: number; minute: number; period: "AM" | "PM" };
  onChange: (v: { hour: number; minute: number; period: "AM" | "PM" }) => void;
  accentColor?: string;
}

function to24(hour: number, period: "AM" | "PM"): number {
  if (period === "PM" && hour !== 12) return hour + 12;
  if (period === "AM" && hour === 12) return 0;
  return hour;
}

function to12(h24: number): { hour: number; period: "AM" | "PM" } {
  const period: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  let h = h24 % 12;
  if (h === 0) h = 12;
  return { hour: h, period };
}

function timeToDate(
  hour: number,
  minute: number,
  period: "AM" | "PM",
): Date {
  const d = new Date();
  d.setHours(to24(hour, period), minute, 0, 0);
  return d;
}

/**
 * Headless native time picker.
 * Mount when `visible` is true — on Android it shows a dialog,
 * on iOS it shows an inline spinner. The native OS handles OK / Cancel.
 */
export default function ClockTimePicker({
  val,
  onChange,
  visible,
  onDismiss,
}: Props & { visible: boolean; onDismiss: () => void }) {
  const { theme } = useMindCareTheme();

  const dateValue = useMemo(
    () => timeToDate(val.hour, val.minute, val.period),
    [val.hour, val.minute, val.period],
  );

  const [date, setDate] = useState(dateValue);

  useEffect(() => {
    setDate(timeToDate(val.hour, val.minute, val.period));
  }, [val.hour, val.minute, val.period]);

  if (!visible) return null;

  const handleChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === "android") {
      onDismiss();
      if (event.type === "set" && selectedDate) {
        const { hour, period } = to12(selectedDate.getHours());
        onChange({ hour, minute: selectedDate.getMinutes(), period });
      }
    } else {
      if (selectedDate) {
        setDate(selectedDate);
        const { hour, period } = to12(selectedDate.getHours());
        onChange({ hour, minute: selectedDate.getMinutes(), period });
      }
      onDismiss();
    }
  };

  return (
    <DateTimePicker
      value={date}
      mode="time"
      display="default"
      onChange={handleChange}
      textColor={theme.text}
      {...(Platform.OS === "ios" ? { accentColor: theme.primary } : {})}
    />
  );
}
