/**
 * Two-layer content moderation for peer-to-peer messaging.
 *
 * Layer 1: Client-side blocklist — instant, no API call
 * Layer 2: AI-based via backend /api/moderate — catches subtle/coded language
 *
 * If the AI endpoint is unreachable, fail open (return safe).
 */

import type { ModerationResult } from "@/types/messaging";
import { API_URL } from "@/backend/config";

// ── Blocklist ────────────────────────────────────────────────────────────────

const BLOCKED_PATTERNS: { pattern: RegExp; reason: string; category: string }[] =
  [
    // Profanity
    { pattern: /\bf+u+c+k+\w*/i, reason: "Profanity is not allowed.", category: "profanity" },
    { pattern: /\bs+h+i+t+\w*/i, reason: "Profanity is not allowed.", category: "profanity" },
    { pattern: /\ba+s+s+h+o+l+e+\w*/i, reason: "Profanity is not allowed.", category: "profanity" },
    { pattern: /\bb+i+t+c+h+\w*/i, reason: "Profanity is not allowed.", category: "profanity" },
    { pattern: /\bd+a+m+n+\w*/i, reason: "Profanity is not allowed.", category: "profanity" },
    { pattern: /\bc+r+a+p+\w*/i, reason: "Profanity is not allowed.", category: "profanity" },
    { pattern: /\bp+i+s+s+\w*/i, reason: "Profanity is not allowed.", category: "profanity" },
    { pattern: /\ba+s+s\b/i, reason: "Profanity is not allowed.", category: "profanity" },
    { pattern: /\bb+s+t+\w*/i, reason: "Profanity is not allowed.", category: "profanity" },
    { pattern: /\bd-i+c-k+\w*/i, reason: "Profanity is not allowed.", category: "profanity" },

    // Slurs and hate speech
    { pattern: /\bn+i+g+\w*/i, reason: "Hate speech is not allowed.", category: "hate" },
    { pattern: /\bf+a+g+\w*/i, reason: "Hate speech is not allowed.", category: "hate" },
    { pattern: /\br+e+t+a+r+d+\w*/i, reason: "Hate speech is not allowed.", category: "hate" },
    { pattern: /\bk+i+k+e+\w*/i, reason: "Hate speech is not allowed.", category: "hate" },
    { pattern: /\bn+a+z+i+\w*/i, reason: "Hate speech is not allowed.", category: "hate" },

    // Bullying and harassment
    { pattern: /\bkill\s+yourself\b/i, reason: "This message violates community guidelines.", category: "bullying" },
    { pattern: /\bk+y+s+\b/i, reason: "This message violates community guidelines.", category: "bullying" },
    { pattern: /\bgo\s+die\b/i, reason: "This message violates community guidelines.", category: "bullying" },
    { pattern: /\bnobody\s+likes\s+you\b/i, reason: "This message violates community guidelines.", category: "bullying" },
    { pattern: /\byou'?re?\s+worthless\b/i, reason: "This message violates community guidelines.", category: "bullying" },
    { pattern: /\byou'?re?\s+ugly\b/i, reason: "This message violates community guidelines.", category: "bullying" },
    { pattern: /\byou'?re?\s+stupid\b/i, reason: "This message violates community guidelines.", category: "bullying" },
    { pattern: /\byou'?re?\s+fat\b/i, reason: "This message violates community guidelines.", category: "bullying" },
    { pattern: /\bshut\s+up\b/i, reason: "Please be respectful in your conversations.", category: "bullying" },
    { pattern: /\bpathetic\b/i, reason: "This message violates community guidelines.", category: "bullying" },
    { pattern: /\bloser\b/i, reason: "This message violates community guidelines.", category: "bullying" },

    // Self-harm (redirect to crisis support)
    { pattern: /\bcut\s+(myself|my\s+skin|my\s+wrist|my\s+arm)\b/i, reason: "self_harm", category: "crisis" },
    { pattern: /\bwant\s+to\s+die\b/i, reason: "self_harm", category: "crisis" },
    { pattern: /\bend\s+it\s+all\b/i, reason: "self_harm", category: "crisis" },
    { pattern: /\bsuicide\b/i, reason: "self_harm", category: "crisis" },
    { pattern: /\bcommit\s+suicide\b/i, reason: "self_harm", category: "crisis" },
    { pattern: /\bkill\s+me\b/i, reason: "self_harm", category: "crisis" },
    { pattern: /\bno\s+reason\s+to\s+live\b/i, reason: "self_harm", category: "crisis" },
    { pattern: /\brather\s+be\s+dead\b/i, reason: "self_harm", category: "crisis" },

    // Drugs and substances
    { pattern: /\bweed\b/i, reason: "Discussions about controlled substances are not allowed.", category: "drugs" },
    { pattern: /\bmarijuana\b/i, reason: "Discussions about controlled substances are not allowed.", category: "drugs" },
    { pattern: /\bcocaine\b/i, reason: "Discussions about controlled substances are not allowed.", category: "drugs" },
    { pattern: /\bmeth\b/i, reason: "Discussions about controlled substances are not allowed.", category: "drugs" },
    { pattern: /\bheroin\b/i, reason: "Discussions about controlled substances are not allowed.", category: "drugs" },
    { pattern: /\bxanax\b/i, reason: "Discussions about controlled substances are not allowed.", category: "drugs" },
    { pattern: /\bget\s+high\b/i, reason: "Discussions about controlled substances are not allowed.", category: "drugs" },
    { pattern: /\bget\s+wasted\b/i, reason: "Discussions about controlled substances are not allowed.", category: "drugs" },
    { pattern: /\bdo\s+drugs\b/i, reason: "Discussions about controlled substances are not allowed.", category: "drugs" },

    // Sexual content
    { pattern: /\bporn\b/i, reason: "Sexually explicit content is not allowed.", category: "sexual" },
    { pattern: /\bpornography\b/i, reason: "Sexually explicit content is not allowed.", category: "sexual" },
    { pattern: /\bnude\s+pics?\b/i, reason: "Sexually explicit content is not allowed.", category: "sexual" },
    { pattern: /\bsex\s+chat\b/i, reason: "Sexually explicit content is not allowed.", category: "sexual" },
    { pattern: /\bsend\s+(me\s+)?nudes?\b/i, reason: "Sexually explicit content is not allowed.", category: "sexual" },
    { pattern: /\bhook\s*up\b/i, reason: "Sexually explicit content is not allowed.", category: "sexual" },
  ];

// ── Normalization helper ─────────────────────────────────────────────────────

/**
 * Normalizes text for blocklist matching.
 * Lowercases, strips common obfuscation (dots, dashes, spaces between letters).
 */
function normalizeText(text: string): string {
  let t = text.toLowerCase();
  // Strip dots, dashes, underscores, spaces between single characters: f.u.c.k → fuck
  t = t.replace(/[\s._\-]+/g, "");
  // Strip repeated characters: fuuuuck → fuck
  t = t.replace(/(.)\1{2,}/g, "$1$1");
  return t;
}

/**
 * Crisis message with support resources.
 */
const CRISIS_MESSAGE =
  "If you're going through a difficult time, please reach out for help. " +
  "You're not alone. You can contact the National Mental Health Crisis Hotline " +
  "(Philippines): 0966-818-1006 or text HOPE to 2919. " +
  "For immediate danger, please call emergency services (911).";

// ── Layer 1: Blocklist ───────────────────────────────────────────────────────

function checkBlocklist(text: string): ModerationResult {
  const normalized = normalizeText(text);

  for (const { pattern, reason, category } of BLOCKED_PATTERNS) {
    if (pattern.test(text) || pattern.test(normalized)) {
      if (category === "crisis") {
        return { status: "blocked", reason: CRISIS_MESSAGE };
      }
      return { status: "blocked", reason };
    }
  }

  return { status: "safe" };
}

// ── Layer 2: AI Moderation ───────────────────────────────────────────────────

async function checkWithAI(text: string): Promise<ModerationResult> {
  try {
    const response = await fetch(`${API_URL}/api/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      // Fail open — don't block the user if AI is down
      return { status: "safe" };
    }

    const data = await response.json();
    return {
      status: data.status || "safe",
      reason: data.reason || undefined,
    };
  } catch {
    // Fail open — network error, AI unavailable
    return { status: "safe" };
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Moderates a message through two layers:
 * 1. Client-side blocklist (instant)
 * 2. AI-based backend check (~1-2s)
 *
 * Returns the first non-safe result, or safe if both pass.
 */
export async function moderateMessage(text: string): Promise<ModerationResult> {
  if (!text || !text.trim()) {
    return { status: "safe" };
  }

  // Layer 1: Blocklist (instant)
  const blocklistResult = checkBlocklist(text);
  if (blocklistResult.status !== "safe") {
    return blocklistResult;
  }

  // Layer 2: AI moderation
  const aiResult = await checkWithAI(text);
  return aiResult;
}

/**
 * Quick client-side check (no API call).
 * Used for real-time input validation while typing.
 */
export function quickModerationCheck(text: string): ModerationResult {
  if (!text || !text.trim()) {
    return { status: "safe" };
  }
  return checkBlocklist(text);
}
