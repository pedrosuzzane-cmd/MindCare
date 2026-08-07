/**
 * Local risk detection for the MindCare safety scanner.
 *
 * Runs entirely on-device (no API call). Scans the student's journal text for
 * high- and moderate-risk phrasing, then produces a `RiskResult` that is:
 *  - stored as METADATA on the journal entry (riskLevel / riskScore /
 *    riskDetected / riskKeywords), and
 *  - used to route the saved-journal response toward support or crisis
 *    guidance instead of a casual reflection.
 *
 * Journal text itself is never exposed to admins.
 */

import {
  HIGH_RISK_KEYWORDS,
  MODERATE_RISK_KEYWORDS,
} from "@/constants/riskKeywords";
import { matchKeywords } from "./keywordAnalyzer";

export type JournalRiskLevel = "low" | "moderate" | "high";

export interface RiskResult {
  riskLevel: JournalRiskLevel;
  riskScore: number; // weighted sum of matched keywords
  riskDetected: boolean;
  riskKeywords: string[]; // matched phrases (deduped, high first)
}

// Weights chosen so the documented example holds:
// "want to die" (high) + "hopeless" (moderate) => riskScore 18, riskLevel high.
const HIGH_RISK_WEIGHT = 15;
const MODERATE_RISK_WEIGHT = 3;

const HIGH_RISK_THRESHOLD = 15;
const MODERATE_RISK_THRESHOLD = 3;

/**
 * Detect the risk level of a journal entry's text.
 * Falls back to "low" for empty input.
 */
export function detectRisk(text: string): RiskResult {
  const highMatches = matchKeywords(text, HIGH_RISK_KEYWORDS);
  const moderateMatches = matchKeywords(text, MODERATE_RISK_KEYWORDS);

  const riskScore =
    highMatches.length * HIGH_RISK_WEIGHT +
    moderateMatches.length * MODERATE_RISK_WEIGHT;

  if (riskScore >= HIGH_RISK_THRESHOLD || highMatches.length > 0) {
    return {
      riskLevel: "high",
      riskScore,
      riskDetected: true,
      riskKeywords: [...highMatches, ...moderateMatches],
    };
  }

  if (riskScore >= MODERATE_RISK_THRESHOLD || moderateMatches.length > 0) {
    return {
      riskLevel: "moderate",
      riskScore,
      riskDetected: true,
      riskKeywords: [...highMatches, ...moderateMatches],
    };
  }

  return {
    riskLevel: "low",
    riskScore: 0,
    riskDetected: false,
    riskKeywords: [],
  };
}

export function isHighRisk(risk: Pick<RiskResult, "riskLevel">): boolean {
  return risk.riskLevel === "high";
}

export function isModerateOrHigher(
  risk: Pick<RiskResult, "riskLevel">,
): boolean {
  return risk.riskLevel === "moderate" || risk.riskLevel === "high";
}
