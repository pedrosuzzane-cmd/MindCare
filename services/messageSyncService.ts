/**
 * Offline message queue & synchronisation manager.
 *
 * Uses AsyncStorage to persist pending outgoing messages so they survive app
 * restarts.  Subscribes to NetInfo connectivity changes and automatically
 * flushes the queue when the device comes back online.
 *
 * Key guarantees:
 *  - Every message gets a permanent UUID **before** the first Firestore attempt.
 *  - Retries always target the same Firestore document (idempotent writes).
 *  - A sync lock prevents concurrent flush processes.
 *  - Only messages belonging to the currently authenticated user are sent.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { v4 as uuidv4 } from "uuid";
import { sendMessage } from "./messagingService";
import type { MessageSyncStatus, PendingMessage } from "@/types/messaging";

// ── AsyncStorage key ─────────────────────────────────────────────────────────
const QUEUE_KEY = "@MindCare:message_queue";
const MAX_RETRIES = 5;

// ── Sync lock ────────────────────────────────────────────────────────────────
let syncInProgress = false;

// ── Queue persistence helpers ────────────────────────────────────────────────

async function readQueue(): Promise<PendingMessage[]> {
  try {
    const json = await AsyncStorage.getItem(QUEUE_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: PendingMessage[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates a new unique message ID.  Called once per logical send.
 */
export function generateMessageId(): string {
  return uuidv4();
}

/**
 * Enqueues a message for sending.  The message is persisted in AsyncStorage
 * so it survives app restarts and is immediately returned for optimistic UI.
 *
 * If the device is online the function will **also** attempt to write to
 * Firestore right away (fire-and-forget inside the caller).
 */
export async function enqueueMessage(
  msg: Omit<PendingMessage, "syncStatus" | "retryCount" | "clientCreatedAt"> & {
    clientCreatedAt?: number;
  },
): Promise<PendingMessage> {
  const pending: PendingMessage = {
    ...msg,
    clientCreatedAt: msg.clientCreatedAt ?? Date.now(),
    syncStatus: "pending",
    retryCount: 0,
  };

  const queue = await readQueue();
  // Guard against duplicates — if an item with the same ID already exists, update it
  const idx = queue.findIndex((q) => q.id === pending.id);
  if (idx >= 0) {
    queue[idx] = pending;
  } else {
    queue.push(pending);
  }
  await writeQueue(queue);
  return pending;
}

/**
 * Updates the sync status of a specific message in the queue.
 */
export async function updateMessageStatus(
  messageId: string,
  status: MessageSyncStatus,
  error?: string,
): Promise<void> {
  const queue = await readQueue();
  const item = queue.find((q) => q.id === messageId);
  if (!item) return;
  item.syncStatus = status;
  if (error !== undefined) item.lastError = error;
  await writeQueue(queue);
}

/**
 * Removes a message from the queue (called after successful Firestore write).
 */
export async function dequeueMessage(messageId: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((q) => q.id !== messageId));
}

/**
 * Returns all pending messages for a given user.
 */
export async function getPendingMessages(
  userId: string,
): Promise<PendingMessage[]> {
  const queue = await readQueue();
  return queue.filter(
    (q) => q.senderId === userId && q.syncStatus !== "sent",
  );
}

/**
 * Returns the count of pending messages for a given user.
 */
export async function getPendingCount(userId: string): Promise<number> {
  const queue = await readQueue();
  return queue.filter(
    (q) => q.senderId === userId && q.syncStatus !== "sent",
  ).length;
}

/**
 * Removes all sent messages from the queue (cleanup helper).
 */
export async function purgeSent(): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((q) => q.syncStatus !== "sent"));
}

// ── Core sync loop ───────────────────────────────────────────────────────────

/**
 * Processes all pending messages for the given user.
 *
 * - Acquires a lock so only one sync runs at a time.
 * - Processes messages sequentially to preserve ordering.
 * - Stops early if the device goes offline.
 * - Only sends messages whose senderId matches `currentUserId` (auth safety).
 */
export async function syncPendingMessages(
  currentUserId: string,
): Promise<void> {
  if (syncInProgress) return; // lock — prevent concurrent runs
  syncInProgress = true;

  try {
    const queue = await readQueue();
    const pending = queue.filter(
      (q) =>
        q.senderId === currentUserId &&
        q.syncStatus !== "sent" &&
        q.retryCount < MAX_RETRIES,
    );

    if (pending.length === 0) return;

    // Check connectivity before starting
    const net = await NetInfo.fetch();
    if (!net.isConnected) return;

    for (const msg of pending) {
      // Re-check connectivity before each message
      const currentNet = await NetInfo.fetch();
      if (!currentNet.isConnected) break;

      // Auth safety — never send another user's messages
      if (msg.senderId !== currentUserId) continue;

      // Mark as sending
      await updateMessageStatus(msg.id, "sending");

      try {
        await sendMessage(
          msg.conversationId,
          msg.text,
          msg.senderId,
          msg.isAdmin,
          msg.moderationStatus,
          msg.id, // <-- the permanent UUID — idempotent write
        );

        // Success — remove from queue
        await dequeueMessage(msg.id);
      } catch (err: any) {
        const isNetworkError = isTemporaryError(err);

        if (isNetworkError) {
          // Keep pending for later retry
          const queue2 = await readQueue();
          const item = queue2.find((q) => q.id === msg.id);
          if (item) {
            item.syncStatus = "pending";
            item.retryCount += 1;
            item.lastError = err?.message || "Network error";
            await writeQueue(queue2);
          }
        } else {
          // Permanent error — mark as failed, stop retrying
          await updateMessageStatus(msg.id, "failed", err?.message || "Failed");
        }
      }
    }
  } finally {
    syncInProgress = false;
  }
}

// ── Network classification ───────────────────────────────────────────────────

/**
 * Returns a human-readable label for the current connection type.
 */
export function getConnectionLabel(state: NetInfoState): string {
  if (!state.isConnected) return "Offline";
  if (state.type === "wifi") return "Wi-Fi";
  if (state.type === "cellular") return "Mobile data";
  if (state.type === "other") return "Connected";
  return "Online";
}

/**
 * Returns true when the connection type is wifi or cellular.
 */
export function isOnline(state: NetInfoState): boolean {
  return state.isConnected === true;
}

// ── Error classification ─────────────────────────────────────────────────────

/**
 * Determines whether a Firestore error is temporary (worth retrying) or
 * permanent (should stop retrying).
 */
function isTemporaryError(err: any): boolean {
  if (!err) return false;

  const code = err.code || err.message || "";

  // Firestore / Firebase error codes that indicate a temporary issue
  const temporaryPatterns = [
    "unavailable",
    "deadline-exceeded",
    "resource-exhausted",
    "aborted",
    "internal",
    "cancelled",
    "network",
    "offline",
    "timeout",
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "fetch",
    "Network request failed",
  ];

  const lower = String(code).toLowerCase();
  return temporaryPatterns.some((p) => lower.includes(p.toLowerCase()));
}

// ── NetInfo subscription (auto-sync) ─────────────────────────────────────────

let netUnsubscribe: (() => void) | null = null;
let syncCallback: ((count: number) => void) | null = null;

/**
 * Starts listening for connectivity changes.  When the device transitions
 * from offline → online, pending messages are automatically synced.
 *
 * @param currentUserId  Only sync messages for this user.
 * @param onSyncComplete Called with the number of remaining pending messages
 *                       after each sync attempt.
 * @returns A cleanup function to stop listening.
 */
export function initializeSync(
  currentUserId: string,
  onSyncComplete?: (pendingCount: number) => void,
): () => void {
  // Clean up any previous listener
  cleanupSync();

  syncCallback = onSyncComplete || null;

  netUnsubscribe = NetInfo.addEventListener(async (state) => {
    if (isOnline(state)) {
      await syncPendingMessages(currentUserId);
      const remaining = await getPendingCount(currentUserId);
      syncCallback?.(remaining);
    }
  });

  // Also attempt an immediate sync (for messages queued while app was backgrounded)
  NetInfo.fetch().then(async (state) => {
    if (isOnline(state)) {
      await syncPendingMessages(currentUserId);
      const remaining = await getPendingCount(currentUserId);
      syncCallback?.(remaining);
    }
  });

  return cleanupSync;
}

/**
 * Stops the network listener and cleans up resources.
 */
export function cleanupSync(): void {
  if (netUnsubscribe) {
    netUnsubscribe();
    netUnsubscribe = null;
  }
  syncCallback = null;
}

// ── Convenience re-export ────────────────────────────────────────────────────

export const messageSyncService = {
  generateMessageId,
  enqueueMessage,
  updateMessageStatus,
  dequeueMessage,
  getPendingMessages,
  getPendingCount,
  purgeSent,
  syncPendingMessages,
  initializeSync,
  cleanupSync,
  getConnectionLabel,
  isOnline,
};
