import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "mindcare-custom-reminders";

export interface CustomReminder {
  id: string;
  title: string;
  message: string;
  hour: number; // 1-12
  minute: number; // 0-59
  period: "AM" | "PM";
  enabled: boolean;
  repeatDays: number[]; // 0=Sun..6=Sat — empty = every day
  createdAt: string;
  scheduledNotificationIds?: string[];
}

/**
 * Generate a simple unique ID.
 */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Load all custom reminders from AsyncStorage.
 */
export async function loadCustomReminders(): Promise<CustomReminder[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CustomReminder[];
  } catch {
    return [];
  }
}

/**
 * Save the full list of custom reminders to AsyncStorage.
 */
export async function saveCustomReminders(
  reminders: CustomReminder[],
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}

/**
 * Add a new custom reminder. Returns the created reminder.
 */
export async function addCustomReminder(
  data: Omit<CustomReminder, "id" | "createdAt">,
): Promise<CustomReminder> {
  const reminders = await loadCustomReminders();
  const newReminder: CustomReminder = {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  reminders.push(newReminder);
  await saveCustomReminders(reminders);
  return newReminder;
}

/**
 * Update an existing custom reminder by ID.
 */
export async function updateCustomReminder(
  id: string,
  updates: Partial<Omit<CustomReminder, "id" | "createdAt">>,
): Promise<CustomReminder | null> {
  const reminders = await loadCustomReminders();
  const idx = reminders.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  reminders[idx] = { ...reminders[idx], ...updates };
  await saveCustomReminders(reminders);
  return reminders[idx];
}

/**
 * Delete a custom reminder by ID.
 */
export async function deleteCustomReminder(id: string): Promise<boolean> {
  const reminders = await loadCustomReminders();
  const filtered = reminders.filter((r) => r.id !== id);
  if (filtered.length === reminders.length) return false;
  await saveCustomReminders(filtered);
  return true;
}

/**
 * Toggle enabled state of a custom reminder.
 */
export async function toggleCustomReminder(
  id: string,
): Promise<CustomReminder | null> {
  const reminders = await loadCustomReminders();
  const idx = reminders.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  reminders[idx].enabled = !reminders[idx].enabled;
  await saveCustomReminders(reminders);
  return reminders[idx];
}
