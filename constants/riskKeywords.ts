/**
 * Risk keyword banks used by the local safety scanner.
 *
 * IMPORTANT (mental wellness product guidance): we do NOT block or censor
 * these words. Students must be free to express difficult thoughts honestly.
 * These phrases are only used to (a) show supportive, compassionate guidance
 * and (b) flag the entry via METADATA (riskLevel / riskScore / riskKeywords)
 * so it can be followed up per institutional policy. Journal text is never
 * exposed to admins.
 */

export const HIGH_RISK_KEYWORDS: string[] = [
  "suicide",
  "kill myself",
  "end my life",
  "self harm",
  "self-harm",
  "cut myself",
  "overdose",
  "hang myself",
  "jump off",
  "no reason to live",
  "better off dead",
  "want to die",
  "die tonight",
  "kill me",
  "commit suicide",
  "end it all",
];

export const MODERATE_RISK_KEYWORDS: string[] = [
  "hopeless",
  "worthless",
  "empty",
  "alone forever",
  "can't go on",
  "cant go on",
  "give up",
  "nothing matters",
  "no one cares",
  "lost all hope",
  "hate myself",
  "nobody understands",
  "don't want to talk",
  "dont want to talk",
  "no one understands",
];
