export interface MoodOption {
  id: string;
  emoji: string;
  label: string;
  color: string;
}

export interface CategoryOption {
  id: string;
  name: string;
  color: string;
  emoji: string;
}

export const MOODS: MoodOption[] = [
  { id: "happy", emoji: "😄", label: "Happy", color: "#FFD700" },
  { id: "calm", emoji: "😊", label: "Calm", color: "#98FB98" },
  { id: "relaxed", emoji: "😌", label: "Relaxed", color: "#87CEEB" },
  { id: "good", emoji: "🙂", label: "Good", color: "#90EE90" },
  { id: "neutral", emoji: "😐", label: "Neutral", color: "#D3D3D3" },
  { id: "worried", emoji: "😟", label: "Worried", color: "#FFA500" },
  { id: "sad", emoji: "😞", label: "Sad", color: "#4169E1" },
  { id: "overwhelmed", emoji: "😣", label: "Overwhelmed", color: "#8B0000" },
  { id: "exhausted", emoji: "😫", label: "Exhausted", color: "#708090" },
  { id: "stressed", emoji: "😓", label: "Stressed", color: "#FF6347" },
  { id: "burnout", emoji: "😤", label: "Burnout", color: "#800020" },
  { id: "mad", emoji: "😡", label: "Mad", color: "#DC2626" },
  { id: "fearful", emoji: "😰", label: "Fearful", color: "#2563EB" },
  { id: "flushed", emoji: "😅", label: "Flushed", color: "#F472B6" },
  { id: "very-upset", emoji: "😢", label: "Very Upset", color: "#000080" },
];

export const CATEGORIES: CategoryOption[] = [
  { id: "personal", name: "Personal", color: "#9C7EEB", emoji: "🧍" },
  { id: "academic", name: "Academic", color: "#8A63D2", emoji: "📚" },
  { id: "wellness", name: "Wellness", color: "#9C27B0", emoji: "🌿" },
  { id: "emotions", name: "Emotions", color: "#EC4899", emoji: "🧠" },
  { id: "social", name: "Social", color: "#E91E63", emoji: "👥" },
  { id: "family", name: "Family", color: "#F59E0B", emoji: "🏠" },
  { id: "goals", name: "Goals", color: "#FF9800", emoji: "🎯" },
  { id: "growth", name: "Growth", color: "#16A34A", emoji: "🌱" },
  { id: "gratitude", name: "Gratitude", color: "#7C5AC8", emoji: "💜" },
  { id: "work", name: "Work", color: "#FF5722", emoji: "💼" },
  { id: "financial", name: "Financial", color: "#0EA5E9", emoji: "💰" },
  { id: "spiritual", name: "Spiritual", color: "#7B1FA2", emoji: "✨" },
  { id: "life_events", name: "Life Events", color: "#64748B", emoji: "🌎" },
  { id: "other", name: "Other", color: "#6B7280", emoji: "⋯" },
];

export const getMood = (id?: string): MoodOption | undefined =>
  MOODS.find((m) => m.id === id);

export const getCategory = (id?: string): CategoryOption | undefined =>
  CATEGORIES.find((c) => c.id === id);

export const getCategoryLabel = (
  id?: string,
  customCategory?: string,
): string => {
  const category = getCategory(id);
  if (!category) return id || "";
  if (category.id === "other" && customCategory?.trim()) {
    return customCategory.trim();
  }
  return category.name;
};
