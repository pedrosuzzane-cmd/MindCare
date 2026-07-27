import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "@MindCare:offline_sync_queue";
const MAX_RETRIES = 5;

export interface QueueItem {
  journalId: string;
  action: "create" | "update" | "delete";
  queuedAt: string;
  retryCount: number;
  lastError?: string;
}

const getQueue = async (): Promise<QueueItem[]> => {
  try {
    const json = await AsyncStorage.getItem(QUEUE_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
};

const saveQueue = async (queue: QueueItem[]): Promise<void> => {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

const enqueue = async (
  item: Omit<QueueItem, "queuedAt" | "retryCount">,
): Promise<void> => {
  const queue = await getQueue();
  const existing = queue.find((q) => q.journalId === item.journalId);
  if (existing) {
    existing.action = item.action;
    existing.lastError = item.lastError;
  } else {
    queue.push({
      ...item,
      queuedAt: new Date().toISOString(),
      retryCount: 0,
    });
  }
  await saveQueue(queue);
};

const dequeue = async (journalId: string): Promise<void> => {
  const queue = await getQueue();
  await saveQueue(queue.filter((q) => q.journalId !== journalId));
};

const incrementRetry = async (
  journalId: string,
  error?: string,
): Promise<boolean> => {
  const queue = await getQueue();
  const item = queue.find((q) => q.journalId === journalId);
  if (!item) return false;

  item.retryCount += 1;
  item.lastError = error;
  await saveQueue(queue);
  return item.retryCount < MAX_RETRIES;
};

const getPendingItems = async (): Promise<QueueItem[]> => {
  const queue = await getQueue();
  return queue.filter((q) => q.retryCount < MAX_RETRIES);
};

const getFailedItems = async (): Promise<QueueItem[]> => {
  const queue = await getQueue();
  return queue.filter((q) => q.retryCount >= MAX_RETRIES);
};

const clearQueue = async (): Promise<void> => {
  await AsyncStorage.removeItem(QUEUE_KEY);
};

const getQueueCount = async (): Promise<number> => {
  const queue = await getQueue();
  return queue.filter((q) => q.retryCount < MAX_RETRIES).length;
};

export const offlineSyncQueue = {
  enqueue,
  dequeue,
  incrementRetry,
  getPendingItems,
  getFailedItems,
  clearQueue,
  getQueueCount,
};
