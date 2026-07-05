import { supabase } from "@/lib/supabase";

// A single normalized event on the pet's lifetime timeline.
export type TimelineEventKind =
  | "weight" | "symptom" | "condition" | "vaccination" | "medication" | "referral" | "birth";

export type TimelineEvent = {
  id: string;                 // unique across kinds: `${kind}:${rowId}`
  kind: TimelineEventKind;
  date: string;               // ISO timestamp used for sorting/display
  title: string;              // primary line, e.g. "Weight recorded"
  subtitle?: string | null;   // secondary line, e.g. "5.2 kg"
  photoUrls?: string[];       // optional images (symptoms)
  source?: string | null;     // provenance: owner / clinic_verified / device / import
  referralId?: string;        // for referral events: the referral id (navigation)
  progressPercent?: number;   // for referral events: 0-100 journey progress
  progressColor?: string;     // for referral events: status color
  statusLabel?: string;       // for referral events: human status headline
};

// Referral journey steps (mirrors the referral tracker).
const JOURNEY_STEPS_COUNT = 7; // Submitted → Reviewing → Accepted → Booked → Treatment → Outcome → Completed

function referralStepIndex(status: string | null | undefined, hasOutcome: boolean): number {
  const s = (status ?? "").trim().toLowerCase();
  if (s === "completed") return 6;
  if (hasOutcome) return 5;
  switch (s) {
    case "sent": case "declined": return 1;
    case "accepted": return 2;
    case "seen": return 3;
    case "consulting": case "treatment": return 4;
    default: return 0;
  }
}

function referralStatusColor(status: string | null | undefined, idx: number): string {
  const s = (status ?? "").trim().toLowerCase();
  if (s === "declined") return "#ef4444";      // red
  if (idx >= 6) return "#10b981";              // completed green
  if (idx >= 3) return "#8b5cf6";              // in-consult/treatment purple
  return "#f59e0b";                            // in-progress amber
}

function referralStatusLabel(status: string | null | undefined, idx: number): string {
  const s = (status ?? "").trim().toLowerCase();
  if (s === "declined") return "Declined";
  const labels = ["Submitted", "Awaiting review", "Accepted", "Consult booked", "Under treatment", "Outcome sent", "Completed"];
  return labels[idx] ?? "In progress";
}

// Visual metadata per kind (icon glyph + accent color). Kept here so the
// component and any legend stay in sync.
export const KIND_META: Record<TimelineEventKind, { label: string; color: string; glyph: string }> = {
  birth:       { label: "Born",        color: "#ffffff", glyph: "★" },
  weight:      { label: "Weight",      color: "#10b981", glyph: "⚖" },
  symptom:     { label: "Symptom",     color: "#f59e0b", glyph: "✦" },
  condition:   { label: "Diagnosis",   color: "#ef4444", glyph: "✚" },
  vaccination: { label: "Vaccination", color: "#3b82f6", glyph: "⛨" },
  medication:  { label: "Medication",  color: "#06b6d4", glyph: "℞" },
  referral:    { label: "Referral",    color: "#8b5cf6", glyph: "➜" },
};

function iso(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  return v;
}

/**
 * Fetch every event type for a pet, normalize into TimelineEvent[], and return
 * merged newest-first. This is a READ-ONLY aggregation over the existing event
 * tables — the specialized capture tools remain the source of truth.
 */
export async function loadPetTimeline(petId: string, dateOfBirth?: string | null): Promise<TimelineEvent[]> {
  const [weights, symptoms, conditions, vaccinations, medications, referrals] = await Promise.all([
    supabase.from("pet_weights").select("id, weight_kg, recorded_at, source").eq("pet_id", petId),
    supabase.from("pet_observations").select("id, display_text, notes, photo_urls, observed_at, source").eq("pet_id", petId).eq("kind", "symptom"),
    supabase.from("pet_conditions").select("id, display_text, category, status, onset_at, recorded_at, source").eq("pet_id", petId),
    supabase.from("pet_vaccinations").select("id, display_text, product, administered_at, recorded_at, source").eq("pet_id", petId),
    supabase.from("pet_medications").select("id, display_text, dose_value, dose_unit, started_at, recorded_at, source").eq("pet_id", petId),
    supabase.from("referrals").select("id, status, speciality_needed, created_at").eq("pet_id", petId),
  ]);

  // Fetch referral events (to compute journey progress) for this pet's referrals.
  const refRows = (referrals.data ?? []) as any[];
  const refIds = refRows.map(r => r.id);
  const outcomeByRef: Record<string, boolean> = {};
  if (refIds.length > 0) {
    const { data: evData } = await supabase
      .from("referral_events")
      .select("referral_id, event_type")
      .in("referral_id", refIds);
    for (const ev of (evData ?? []) as any[]) {
      if (ev.event_type === "outcome_report") outcomeByRef[ev.referral_id] = true;
    }
  }

  const events: TimelineEvent[] = [];

  for (const w of (weights.data ?? []) as any[]) {
    const date = iso(w.recorded_at);
    const kgNum = w.weight_kg != null ? Number(w.weight_kg) : null;
    const kgLabel = kgNum != null && Number.isFinite(kgNum)
      ? `${parseFloat(kgNum.toFixed(2))} kg`   // preserves decimals (5.2), trims trailing zeros (5.20→5.2, 5.00→5)
      : null;
    if (date) events.push({ id: `weight:${w.id}`, kind: "weight", date, title: "Weight recorded", subtitle: kgLabel, source: w.source });
  }

  for (const s of (symptoms.data ?? []) as any[]) {
    const date = iso(s.observed_at);
    if (date) events.push({ id: `symptom:${s.id}`, kind: "symptom", date, title: s.display_text ?? "Symptom", subtitle: s.notes ?? null, photoUrls: Array.isArray(s.photo_urls) ? s.photo_urls : [], source: s.source });
  }

  for (const cnd of (conditions.data ?? []) as any[]) {
    const date = iso(cnd.onset_at) ?? iso(cnd.recorded_at);
    const isAllergy = cnd.category === "allergy";
    if (date) events.push({ id: `condition:${cnd.id}`, kind: "condition", date, title: isAllergy ? "Allergy" : "Diagnosis", subtitle: cnd.display_text ?? null, source: cnd.source });
  }

  for (const v of (vaccinations.data ?? []) as any[]) {
    const date = iso(v.administered_at) ?? iso(v.recorded_at);
    const label = v.display_text ?? "Vaccination";
    const sub = v.product ? `${label} · ${v.product}` : label;
    if (date) events.push({ id: `vaccination:${v.id}`, kind: "vaccination", date, title: "Vaccination", subtitle: sub, source: v.source });
  }

  for (const m of (medications.data ?? []) as any[]) {
    const date = iso(m.started_at) ?? iso(m.recorded_at);
    const dose = m.dose_value != null ? ` · ${m.dose_value}${m.dose_unit ? " " + m.dose_unit : ""}` : "";
    if (date) events.push({ id: `medication:${m.id}`, kind: "medication", date, title: m.display_text ?? "Medication", subtitle: dose ? dose.replace(" · ", "") : null, source: m.source });
  }

  for (const r of refRows) {
    const date = iso(r.created_at);
    const idx = referralStepIndex(r.status, !!outcomeByRef[r.id]);
    const pct = Math.round((Math.min(idx, JOURNEY_STEPS_COUNT - 1) / (JOURNEY_STEPS_COUNT - 1)) * 100);
    const color = referralStatusColor(r.status, idx);
    const label = referralStatusLabel(r.status, idx);
    const spec = r.speciality_needed ? `${r.speciality_needed}` : "Referral";
    if (date) events.push({
      id: `referral:${r.id}`, kind: "referral", date,
      title: "Referral", subtitle: spec,
      referralId: r.id, progressPercent: pct, progressColor: color, statusLabel: label,
    });
  }

  // Birth anchor at the very start of the timeline (oldest).
  const dob = iso(dateOfBirth ?? null);
  if (dob) events.push({ id: "birth:pet", kind: "birth", date: dob, title: "Born", subtitle: null });

  // Newest first.
  events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return events;
}

// Group events by calendar day for date headers in the feed.
export function groupByDay(events: TimelineEvent[]): { day: string; label: string; items: TimelineEvent[] }[] {
  const groups: Record<string, TimelineEvent[]> = {};
  for (const e of events) {
    const day = e.date.split("T")[0];
    (groups[day] ??= []).push(e);
  }
  return Object.keys(groups)
    .sort((a, b) => (a < b ? 1 : -1))
    .map(day => {
      let label = day;
      try {
        label = new Date(day).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
      } catch { /* keep ISO */ }
      return { day, label, items: groups[day] };
    });
}
