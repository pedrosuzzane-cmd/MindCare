/**
 * Privacy-preserving analytics thresholds for the MindCare admin dashboard.
 *
 * Aggregate statistics are only shown for groups that meet the minimum
 * population size (MIN_ANALYTICS_GROUP_SIZE). Smaller groups are suppressed to
 * avoid re-identification of individual students, and never exposed to other
 * roles.
 */

export const MIN_ANALYTICS_GROUP_SIZE = 5;

export const SUPPRESSED_DATA_MESSAGE =
  "Data suppressed — group size is below the minimum required for privacy-preserving analytics.";

export const SUPPRESSED_GROUP_LABEL = "Data suppressed";

/**
 * Returns true when an aggregate group is too small to display safely.
 * Used for departments, year levels, and other breakdowns.
 */
export function isGroupSuppressed(groupSize: number): boolean {
  return groupSize < MIN_ANALYTICS_GROUP_SIZE;
}

/** Human-readable label for suppressed aggregate metrics. */
export function suppressedValueLabel(): string {
  return SUPPRESSED_GROUP_LABEL;
}
