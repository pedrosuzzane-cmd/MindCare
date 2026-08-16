/**
 * Categorised emoji picker for the chat input.
 * Renders a horizontal category tab bar + a scrollable grid of emojis.
 */

import React, { useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useMindCareTheme } from "@/contexts/ThemeContext";
import type { MindCareTheme } from "@/constants/theme";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

interface Category {
  key: string;
  label: string;
  icon: string;
  emojis: string[];
}

const CATEGORIES: Category[] = [
  {
    key: "smileys",
    label: "Smileys",
    icon: "😀",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂",
      "🙂", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗",
      "😚", "😙", "🥲", "😋", "😛", "😜", "🤪", "😝",
      "🤑", "🤗", "🤭", "🤫", "🤔", "🫡", "🤐", "🤨",
      "😐", "😑", "😶", "🫥", "😏", "😒", "🙄", "😬",
      "😮‍💨", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷",
      "🤒", "🤕", "🤢", "🤮", "🥵", "🥶", "🥴", "😵",
      "🤯", "🤠", "🥳", "🥸", "😎", "🤓", "🧐", "😕",
      "😟", "🙁", "☹️", "😮", "😯", "😲", "😳", "🥺",
      "🥹", "😦", "😧", "😨", "😰", "😥", "😢", "😭",
      "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱",
    ],
  },
  {
    key: "hearts",
    label: "Hearts",
    icon: "❤️",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
      "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓",
      "💗", "💖", "💘", "💝", "💟", "♥️", "🫶", "💑",
    ],
  },
  {
    key: "hands",
    label: "Hands",
    icon: "👋",
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "🫱", "🫲", "🫳",
      "🫴", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟",
      "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️",
      "🫵", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏",
      "🙌", "🫶", "👐", "🤲", "🤝", "🙏", "💪", "🦾",
    ],
  },
  {
    key: "nature",
    label: "Nature",
    icon: "🌿",
    emojis: [
      "🌸", "💐", "🌷", "🌹", "🥀", "🌺", "🌻", "🌼",
      "🍀", "🌿", "🍃", "🍂", "🍁", "🌾", "🌵", "🌴",
      "🌳", "🌲", "🪵", "🍄", "🐚", "🪸", "🪨", "🌊",
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼",
      "🐻‍❄️", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵",
      "🦋", "🐛", "🐝", "🐞", "🐜", "🪲", "🦗", "🦟",
    ],
  },
  {
    key: "food",
    label: "Food",
    icon: "🍔",
    emojis: [
      "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓",
      "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝",
      "🍅", "🥑", "🫑", "🌶️", "🫒", "🥬", "🥦", "🧄",
      "🍔", "🍟", "🍕", "🌭", "🥪", "🌮", "🌯", "🫔",
      "☕", "🍵", "🧃", "🥤", "🍺", "🍷", "🧋", "🫧",
      "🎂", "🍰", "🧁", "🥧", "🍫", "🍬", "🍭", "🍮",
    ],
  },
  {
    key: "objects",
    label: "Objects",
    icon: "💡",
    emojis: [
      "⌚", "📱", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "🖲️",
      "💡", "🔦", "🕯️", "📷", "📹", "🎥", "📺", "📻",
      "🎙️", "🎚️", "🎛️", "⏰", "📡", "🔋", "💰", "💎",
      "🔑", "🗝️", "🔒", "🔓", "📦", "📫", "📮", "✏️",
      "📝", "📁", "📂", "📅", "📌", "📎", "📐", "📏",
      "🎉", "🎊", "🎈", "🎁", "🎀", "🏆", "🥇", "🎯",
    ],
  },
  {
    key: "symbols",
    label: "Symbols",
    icon: "✨",
    emojis: [
      "✨", "🌟", "💫", "⭐", "🔥", "💥", "💢", "💦",
      "💨", "🕊️", "✅", "❌", "❓", "❗", "‼️", "⁉️",
      "💤", "🎵", "🎶", "➕", "➖", "➗", "✖️", "🟰",
      "💯", "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚫",
      "⚪", "🩷", "🩵", "🩶", "♻️", "🔴", "🔹", "🔸",
      "🏳️", "🏴", "🏁", "🚩", "🎌", "🏆", "⭐", "🌟",
    ],
  },
];

export default function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const { theme } = useMindCareTheme();
  const styles = createStyles(theme);
  const [activeCategory, setActiveCategory] = useState("smileys");
  const category = CATEGORIES.find((c) => c.key === activeCategory) || CATEGORIES[0];

  return (
    <View style={styles.container}>
      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat.key}
            style={[
              styles.tab,
              activeCategory === cat.key && styles.tabActive,
            ]}
            onPress={() => setActiveCategory(cat.key)}
          >
            <Text style={styles.tabIcon}>{cat.icon}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Emoji grid */}
      <FlatList
        data={category.emojis}
        keyExtractor={(item, idx) => `${item}_${idx}`}
        numColumns={8}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={true}
        renderItem={({ item }) => (
          <Pressable
            style={styles.emojiCell}
            onPress={() => onSelect(item)}
          >
            <Text style={styles.emoji}>{item}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const createStyles = (theme: MindCareTheme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.card,
      borderTopWidth: 1,
      borderTopColor: theme.borderSoft,
      maxHeight: 280,
    },
    tabBar: {
      maxHeight: 44,
    },
    tabBarContent: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 4,
    },
    tab: {
      width: 38,
      height: 30,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.secondaryCard,
    },
    tabActive: {
      backgroundColor: theme.softPurple,
    },
    tabIcon: {
      fontSize: 16,
    },
    grid: {
      paddingHorizontal: 8,
      paddingBottom: 8,
    },
    emojiCell: {
      flex: 1,
      aspectRatio: 1,
      maxWidth: "12.5%",
      justifyContent: "center",
      alignItems: "center",
    },
    emoji: {
      fontSize: 24,
    },
  });
