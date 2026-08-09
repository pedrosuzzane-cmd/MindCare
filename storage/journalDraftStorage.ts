import AsyncStorage from "@react-native-async-storage/async-storage";

export interface JournalDraft {
  title: string;
  thoughts: string;
  mood: string;
  category: string;
  customCategory: string;
  savedAt: string;
}

const DRAFT_KEY = "@MindCare:journal_draft";

const getDraft = async (): Promise<JournalDraft | null> => {
  try {
    const jsonValue = await AsyncStorage.getItem(DRAFT_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.error("Failed to load journal draft from storage.", e);
    return null;
  }
};

const saveDraft = async (draft: JournalDraft): Promise<void> => {
  try {
    const jsonValue = JSON.stringify(draft);
    await AsyncStorage.setItem(DRAFT_KEY, jsonValue);
  } catch (e) {
    console.error("Failed to save journal draft to storage.", e);
  }
};

const clearDraft = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch (e) {
    console.error("Failed to clear journal draft from storage.", e);
  }
};

export const journalDraftStorage = {
  getDraft,
  saveDraft,
  clearDraft,
};
