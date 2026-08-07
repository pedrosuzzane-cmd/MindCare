/**
 * Legacy entry point for the local reflection engine.
 * Re-exports the smart structured engine (Layers 1–2) so existing imports
 * keep working while screens migrate to the structured 4-section reflection.
 */
export {
  generateLocalReflection,
  getActiveReflection,
  getReflectionSummary,
  getReflectionStatusLabel,
  detectThemes,
} from "./reflection/engine";

export type {
  LocalReflection,
  ReflectionSections,
  ReflectionInput,
} from "./reflection/engine";
