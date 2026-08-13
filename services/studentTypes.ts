/**
 * Student Management & Support — shared types and display metadata.
 *
 * Lifecycle and support statuses are administrative metadata stored on the
 * student's `users/{uid}` document. They describe academic status and
 * authorized support workflows only — never clinical diagnoses.
 */

export type LifecycleStatus =
  | "active"
  | "on_leave"
  | "transferred"
  | "graduated"
  | "inactive"
  | "restricted"
  | "archived";

export type SupportStatus =
  | "no_action"
  | "monitor"
  | "outreach_recommended"
  | "contact_initiated"
  | "support_offered"
  | "follow_up_scheduled"
  | "resolved"
  | "closed";

export type SupportActionType =
  | "send_wellness_checkin"
  | "guidance_consultation"
  | "schedule_follow_up"
  | "provide_resources"
  | "monitor_only"
  | "contact_recommended"
  | "resolved"
  | "no_action";

export const DEFAULT_LIFECYCLE_STATUS: LifecycleStatus = "active";
export const DEFAULT_SUPPORT_STATUS: SupportStatus = "no_action";

export const LIFECYCLE_STATUSES: LifecycleStatus[] = [
  "active",
  "on_leave",
  "transferred",
  "graduated",
  "inactive",
  "restricted",
  "archived",
];

export const LIFECYCLE_LABELS: Record<LifecycleStatus, string> = {
  active: "Active",
  on_leave: "On Leave",
  transferred: "Transferred",
  graduated: "Graduated",
  inactive: "Inactive",
  restricted: "Restricted",
  archived: "Archived",
};

export const LIFECYCLE_COLORS: Record<LifecycleStatus, string> = {
  active: "#16A34A",
  on_leave: "#D97706",
  transferred: "#0891B2",
  graduated: "#7C3AED",
  inactive: "#64748B",
  restricted: "#DB2777",
  archived: "#94A3B8",
};

export const SUPPORT_STATUSES: SupportStatus[] = [
  "no_action",
  "monitor",
  "outreach_recommended",
  "contact_initiated",
  "support_offered",
  "follow_up_scheduled",
  "resolved",
  "closed",
];

export const SUPPORT_LABELS: Record<SupportStatus, string> = {
  no_action: "No Active Support",
  monitor: "Monitor",
  outreach_recommended: "Outreach Recommended",
  contact_initiated: "Contact Initiated",
  support_offered: "Support Offered",
  follow_up_scheduled: "Follow-up Scheduled",
  resolved: "Resolved",
  closed: "Closed",
};

export const SUPPORT_COLORS: Record<SupportStatus, string> = {
  no_action: "#64748B",
  monitor: "#0891B2",
  outreach_recommended: "#DB2777",
  contact_initiated: "#D97706",
  support_offered: "#7C3AED",
  follow_up_scheduled: "#2563EB",
  resolved: "#16A34A",
  closed: "#94A3B8",
};

export const SUPPORT_ACTIONS: SupportActionType[] = [
  "send_wellness_checkin",
  "guidance_consultation",
  "schedule_follow_up",
  "provide_resources",
  "monitor_only",
  "contact_recommended",
  "resolved",
  "no_action",
];

export const SUPPORT_ACTION_LABELS: Record<SupportActionType, string> = {
  send_wellness_checkin: "Contacted",
  guidance_consultation: "Referred to guidance/counseling",
  schedule_follow_up: "Schedule follow-up",
  provide_resources: "Provide wellness resources",
  monitor_only: "Continue monitoring",
  contact_recommended: "Contact recommended",
  resolved: "Resolved",
  no_action: "No action",
};

/** Support statuses considered "active" (i.e. a workflow is underway). */
export const ACTIVE_SUPPORT_STATUSES: SupportStatus[] = [
  "monitor",
  "outreach_recommended",
  "contact_initiated",
  "support_offered",
  "follow_up_scheduled",
];
