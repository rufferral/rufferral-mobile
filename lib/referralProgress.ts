// Shared referral-journey logic, used by the referral tracker and pet/home status cards.

export const JOURNEY_STEPS = [
  "Referral Submitted",
  "Specialist Reviewing",
  "Referral Accepted",
  "Consult Booked",
  "Under Treatment",
  "Outcome Report Sent",
  "Completed",
] as const;

export type EventLike = { event_type: string | null; created_at: string | null };

function hasOutcomeReportEvent(events: Pick<EventLike, "event_type">[]): boolean {
  return events.some((e) => e.event_type === "outcome_report");
}

export function activeStepIndex(status: string | null | undefined, events: EventLike[]): number {
  const s = (status ?? "").trim().toLowerCase();
  if (s === "completed") return 6;
  if (hasOutcomeReportEvent(events)) {
    const latestOutcome = events
      .filter(e => e.event_type === "outcome_report")
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0];
    const hasPostOutcomeAction = latestOutcome && events.some(e =>
      ["surgery_scheduled", "procedure_scheduled", "followup_booked", "surgery_logged", "procedure_logged"].includes(e.event_type ?? "") &&
      new Date(e.created_at ?? 0) > new Date(latestOutcome.created_at ?? 0)
    );
    return hasPostOutcomeAction ? 4 : 5;
  }
  switch (s) {
    case "sent": case "declined": return 1;
    case "accepted": return 2;
    case "seen": return 3;
    case "consulting": case "treatment": return 4;
    default: return 0;
  }
}

export function progressPercent(activeIdx: number): number {
  return Math.round((Math.min(activeIdx, JOURNEY_STEPS.length - 1) / (JOURNEY_STEPS.length - 1)) * 100);
}

export function getOwnerStatusHeadline(status: string | null | undefined, activeIdx: number, journeyComplete: boolean): { headline: string; color: string } {
  const s = (status ?? "").trim().toLowerCase();
  if (s === "completed" || journeyComplete) return { headline: "Case completed", color: "#10b981" };
  if (s === "declined") return { headline: "Referral declined", color: "#ef4444" };
  const headlines: Record<number, { headline: string; color: string }> = {
    0: { headline: "Referral submitted", color: "#f59e0b" },
    1: { headline: "Awaiting specialist review", color: "#f59e0b" },
    2: { headline: "Referral accepted", color: "#3b82f6" },
    3: { headline: "Appointment booked", color: "#3b82f6" },
    4: { headline: "Under treatment", color: "#8b5cf6" },
    5: { headline: "Outcome report sent", color: "#8b5cf6" },
    6: { headline: "Case completed", color: "#10b981" },
  };
  return headlines[activeIdx] ?? { headline: "In progress", color: "#f59e0b" };
}
