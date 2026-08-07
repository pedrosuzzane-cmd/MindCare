/**
 * Legacy entry point for the local reflection engine.
 * Re-exports the structured engine (topic detection → emotion analysis →
 * context-aware generation) and the local safety scanner (risk detection) so
 * existing imports keep working while screens migrate.
 */
export {
  generateLocalReflection,
  getActiveReflection,
  getReflectionSummary,
  getReflectionStatusLabel,
  detectThemes,
  getTopicLabel,
  detectTopics,
  detectRisk,
  isHighRisk,
  isModerateOrHigher,
} from "@/services/reflection/reflectionEngine";

export type {
  LocalReflection,
  ReflectionSections,
  ReflectionInput,
  RiskResult,
  JournalRiskLevel,
} from "@/services/reflection/reflectionEngine";
