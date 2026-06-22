import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Linking,
  LayoutAnimation,
  Platform,
  UIManager,
  StyleSheet,
  Animated,
  Easing,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { ScreenHeader } from "@/components/ScreenHeader";

const GREEN = "#0e6e56";
const PAGE_BG = "#0c5b45";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Journey config (ported verbatim from web) ──────────────────────────────
const JOURNEY_STEPS = [
  "Referral Submitted",
  "Specialist Reviewing",
  "Referral Accepted",
  "Consult Booked",
  "Under Treatment",
  "Outcome Report Sent",
  "Completed",
] as const;

const OWNER_EVENT_TYPES = new Set([
  "referral_sent", "referral_accepted", "referral_declined", "appointment_booked",
  "appointment_rescheduled", "surgery_booked", "referral_completed", "outcome_report",
  "consultation_logged", "procedure_logged", "surgery_logged", "followup_booked",
  "procedure_scheduled", "surgery_scheduled", "note_added",
]);

// ── Types ──────────────────────────────────────────────────────────────────
type PetEmbed = { id?: string | null; name?: string | null; species?: string | null; breed?: string | null; sex?: string | null; photo_url?: string | null; age?: string | null; weight_kg?: number | null; };
type SpecialistClinicEmbed = { name?: string | null; phone?: string | null; email?: string | null; suburb?: string | null; state?: string | null; postcode?: string | null; address?: string | null; };
type SpecialistEmbed = { clinic_name?: string | null; suburb?: string | null; state?: string | null; postcode?: string | null; address?: string | null; phone?: string | null; email?: string | null; specialist_clinics?: SpecialistClinicEmbed | SpecialistClinicEmbed[] | null; };
type ProfileEmbed = { full_name?: string | null; email?: string | null; phone?: string | null; };
type PracticeEmbed = { name?: string | null; suburb?: string | null; state?: string | null; phone?: string | null; };

type ReferralRow = Record<string, unknown> & {
  id: string; status: string | null; created_at: string; accepted_at?: string | null;
  owner_email: string | null; speciality_needed: string | null; urgency: string | null;
  pets?: PetEmbed | PetEmbed[] | null;
  specialists?: SpecialistEmbed | SpecialistEmbed[] | null;
  profiles?: ProfileEmbed | ProfileEmbed[] | null;
  practices?: PracticeEmbed | PracticeEmbed[] | null;
};

type ReferralEventRow = { id?: string; event_type: string | null; event_description: string | null; created_at: string | null; };

// ── Helpers (ported verbatim from web) ─────────────────────────────────────
function unwrapOne<T>(v: T | T[] | null | undefined): T | null { if (v == null) return null; return Array.isArray(v) ? (v[0] ?? null) : v; }
function hasOutcomeReportEvent(events: Pick<ReferralEventRow, "event_type">[]): boolean { return events.some((e) => e.event_type === "outcome_report"); }

function activeStepIndex(status: string | null | undefined, events: Pick<ReferralEventRow, "event_type" | "created_at">[]): number {
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

function formatSubmitted(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }); } catch { return "—"; }
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
    let time = d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true });
    time = time.replace(/\s*([ap]m)\b/i, (_, ap: string) => ap.toLowerCase()).replace(/\s+/g, "");
    return `${date} · ${time}`;
  } catch { return "—"; }
}

function formatUpdateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })} · ${d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}`;
  } catch { return "—"; }
}

function urgencyColors(urgency: string | null | undefined): { bg: string; border: string; text: string } {
  const key = urgency?.trim().toLowerCase() ?? "";
  if (key === "emergency") return { border: "#f5a3a3", bg: "#5c2020", text: "#fecaca" };
  if (key === "urgent") return { border: "#f5d08a", bg: "#5c3d10", text: "#fde68a" };
  if (key === "routine") return { border: "#6ee7b7", bg: "#0a3d2e", text: "#a7f3d0" };
  if (key === "when available" || key === "when_available") return { border: "#93c5fd", bg: "#0c2744", text: "#bfdbfe" };
  return { border: "rgba(255,255,255,0.25)", bg: "rgba(255,255,255,0.1)", text: "rgba(255,255,255,0.9)" };
}

const APPT_NOTES_SEP = " — ";
const ARROW_SEP = " → ";

function formatAppointmentBookedDateTimeLabel(datetimePart: string): string | null {
  const trimmed = datetimePart.trim(); if (!trimmed) return null;
  const d = new Date(trimmed); if (Number.isNaN(d.getTime())) return null;
  let timePart = d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true });
  timePart = timePart.replace(/\s*([ap]m)\b/i, (_, ap: string) => ap.toLowerCase()).replace(/\s+/g, "");
  return `${timePart} · ${d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}`;
}

function parseAppointmentBookedForDisplay(desc: string | null | undefined): { line2: string | null; notes: string | null } {
  const raw = (desc ?? "").trim(); if (!raw) return { line2: null, notes: null };
  const m = raw.match(/^appointment\s+booked\s+for\s+/i);
  const rest = m ? raw.slice(m[0].length).trim() : raw; if (!rest) return { line2: null, notes: null };
  let datetimePart = rest; let notesPart = "";
  const sepIdx = rest.indexOf(APPT_NOTES_SEP);
  if (sepIdx !== -1) { datetimePart = rest.slice(0, sepIdx).trim(); notesPart = rest.slice(sepIdx + APPT_NOTES_SEP.length).trim(); }
  const formatted = formatAppointmentBookedDateTimeLabel(datetimePart);
  return formatted ? { line2: formatted, notes: notesPart || null } : { line2: rest, notes: null };
}

function parseAppointmentRescheduledForDisplay(desc: string | null | undefined): { line2: string | null; notes: string | null } {
  const raw = (desc ?? "").trim(); if (!raw) return { line2: null, notes: null };
  const m = raw.match(/^appointment\s+rescheduled\s+to\s+/i);
  const rest = m ? raw.slice(m[0].length).trim() : raw; if (!rest) return { line2: null, notes: null };
  const parts = rest.split(APPT_NOTES_SEP);
  if (parts.length >= 2) { const t = parts[0]?.trim() ?? ""; const d = parts[1]?.trim() ?? ""; const n = parts.length > 2 ? parts.slice(2).join(APPT_NOTES_SEP).trim() : ""; if (t && d) return { line2: `${t} · ${d}`, notes: n || null }; }
  return { line2: rest, notes: null };
}

function parsePerformedNameOnly(desc: string | null | undefined): string { const raw = (desc ?? "").trim(); const i = raw.indexOf(" performed on "); return i === -1 ? raw : raw.slice(0, i).trim() || raw; }
function parseArrowSegment(desc: string | null | undefined): string { const raw = (desc ?? "").trim(); const arrow = raw.indexOf(ARROW_SEP); if (arrow === -1) return raw; const after = raw.slice(arrow + ARROW_SEP.length).trim(); const em = after.indexOf(APPT_NOTES_SEP); return em === -1 ? after : after.slice(0, em).trim(); }
function parseScheduledNameFromDesc(desc: string | null | undefined): string { const m = (desc ?? "").trim().match(/^(.+?)\s+scheduled\s+→/i); return m?.[1]?.trim() ?? ""; }
function parseDateFromTimeDateSegment(seg: string): string { const parts = seg.split(" · "); return parts.length >= 2 ? parts.slice(1).join(" · ").trim() : seg.trim(); }

function specialistClinicPhoneEmail(specialist: SpecialistEmbed | null) {
  const clinic = unwrapOne(specialist?.specialist_clinics ?? null);
  return { phone: specialist?.phone?.trim() || clinic?.phone?.trim() || "", email: specialist?.email?.trim() || clinic?.email?.trim() || "" };
}

function specialistClinicAddressAndLocation(specialist: SpecialistEmbed | null) {
  const c = unwrapOne(specialist?.specialist_clinics ?? null);
  const address = c?.address?.trim() || specialist?.address?.trim() || "";
  const suburb = specialist?.suburb?.trim() || c?.suburb?.trim() || "";
  const state = specialist?.state?.trim() || c?.state?.trim() || "";
  const postcode = specialist?.postcode?.trim() || c?.postcode?.trim() || "";
  return { address, locLine: [suburb, state, postcode].filter(Boolean).join(", ") };
}

function ownerEventCopy(ev: ReferralEventRow, specialityNeeded: string | null, petName?: string): string {
  const spec = (specialityNeeded ?? "").trim() || "the";
  switch (ev.event_type) {
    case "referral_sent": return `Referral submitted to ${spec} specialist`;
    case "referral_accepted": return "Specialist has accepted this referral";
    case "referral_declined": return "Referral was declined → your vet will be in touch";
    case "appointment_booked": return "Appointment has been booked";
    case "appointment_rescheduled": return "Appointment rescheduled";
    case "surgery_booked": return "Surgery has been scheduled";
    case "referral_completed": return `${petName ?? "Your pet"}'s case has been completed`;
    case "outcome_report": return "Outcome report received → your vet has been notified";
    case "consultation_logged": return "Initial consultation completed";
    case "procedure_logged": return `Procedure completed → ${parsePerformedNameOnly(ev.event_description)}`;
    case "surgery_logged": return `Surgery completed → ${parsePerformedNameOnly(ev.event_description)}`;
    case "followup_booked": return `Follow up consult scheduled → ${parseArrowSegment(ev.event_description)}`;
    case "procedure_scheduled": { const name = parseScheduledNameFromDesc(ev.event_description); const seg = parseArrowSegment(ev.event_description); const dateLine = parseDateFromTimeDateSegment(seg); return name ? `Procedure scheduled → ${name} on ${dateLine}` : `Procedure scheduled → ${dateLine}`; }
    case "surgery_scheduled": { const name = parseScheduledNameFromDesc(ev.event_description); const seg = parseArrowSegment(ev.event_description); const dateLine = parseDateFromTimeDateSegment(seg); return name ? `Surgery scheduled → ${name} on ${dateLine}` : `Surgery scheduled → ${dateLine}`; }
    default: return ev.event_description?.trim() || ev.event_type || "Update";
  }
}

function stepSubDetail(stepIndex: number, referral: ReferralRow, events: ReferralEventRow[], specialist: SpecialistEmbed | null): string | null {
  switch (stepIndex) {
    case 1: {
      const clinicName = specialist?.clinic_name?.trim();
      const { locLine } = specialistClinicAddressAndLocation(specialist);
      if (clinicName && locLine) return `${clinicName} · ${locLine}`;
      return clinicName || null;
    }
    case 2: {
      const clinicName = specialist?.clinic_name?.trim();
      const acceptedAt = typeof referral.accepted_at === "string" ? referral.accepted_at : null;
      const parts = [clinicName, acceptedAt ? formatDateTime(acceptedAt) : null].filter(Boolean);
      return parts.length > 0 ? parts.join(" · ") : null;
    }
    case 3: {
      const apptEv = [...events].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
        .find(e => e.event_type === "appointment_booked" || e.event_type === "appointment_rescheduled");
      if (!apptEv) return null;
      const parsed = apptEv.event_type === "appointment_booked"
        ? parseAppointmentBookedForDisplay(apptEv.event_description)
        : parseAppointmentRescheduledForDisplay(apptEv.event_description);
      return parsed.line2 || null;
    }
    case 4: {
      const treatmentEv = [...events].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
        .find(e => e.event_type === "consultation_logged" || e.event_type === "procedure_logged" || e.event_type === "surgery_logged");
      if (!treatmentEv) return null;
      if (treatmentEv.event_type === "consultation_logged") return "Initial consultation completed";
      if (treatmentEv.event_type === "procedure_logged") return `Procedure: ${parsePerformedNameOnly(treatmentEv.event_description)}`;
      if (treatmentEv.event_type === "surgery_logged") return `Surgery: ${parsePerformedNameOnly(treatmentEv.event_description)}`;
      return null;
    }
    default: return null;
  }
}

function getOwnerStatusHeadline(status: string | null | undefined, activeIdx: number, journeyComplete: boolean): { headline: string; color: string } {
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

// ── Small presentational helpers ───────────────────────────────────────────
const W = (o: number) => `rgba(255,255,255,${o})`;

// Fades + slides a child in on mount, after an optional delay. Used to stagger cards.
function FadeInView({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 500, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, color: W(0.45), marginBottom: 2 }}>{children}</Text>;
}

// ── Status summary card ────────────────────────────────────────────────────
function StatusSummaryCard({ referral, events, activeIdx, journeyComplete, specialist }: {
  referral: ReferralRow; events: ReferralEventRow[]; activeIdx: number; journeyComplete: boolean; specialist: SpecialistEmbed | null;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const { headline, color } = getOwnerStatusHeadline(referral.status, activeIdx, journeyComplete);

  const ownerEvents = useMemo(() => events.filter(e => e.event_type && OWNER_EVENT_TYPES.has(e.event_type)), [events]);
  const mostRecent = ownerEvents[0] ?? null;
  const progressPercent = Math.round((Math.min(activeIdx, JOURNEY_STEPS.length - 1) / (JOURNEY_STEPS.length - 1)) * 100);

  // Animate the progress bar from 0 to its target width on mount.
  const progressAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: progressPercent,
      duration: 1500,
      delay: 650,
      easing: Easing.inOut(Easing.poly(4)),
      useNativeDriver: false, // width can't use the native driver
    }).start();
  }, [progressPercent]);
  const animatedWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  const stepTimestamps: (string | null)[] = JOURNEY_STEPS.map((_, stepIdx) => {
    if (stepIdx > activeIdx) return null;
    const eventTypeMap: Record<number, string[]> = {
      0: ["referral_sent"], 1: ["referral_sent"], 2: ["referral_accepted"],
      3: ["appointment_booked", "appointment_rescheduled"],
      4: ["consultation_logged", "procedure_logged", "surgery_logged", "treatment_began"],
      5: ["outcome_report"], 6: ["referral_completed"],
    };
    const types = eventTypeMap[stepIdx] ?? [];
    const match = [...events].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()).find(e => types.includes(e.event_type ?? ""));
    return match?.created_at ?? null;
  });

  const historySteps = JOURNEY_STEPS.map((label, stepIdx) => ({ label, stepIdx })).filter(({ stepIdx }) => stepIdx <= activeIdx).reverse();

  const toggleHistory = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setHistoryOpen(o => !o);
  };

  const petName = (unwrapOne(referral.pets ?? null) as PetEmbed | null)?.name?.trim() || "Your pet";

  return (
    <View style={styles.card}>
      <View style={{ padding: 18 }}>
        {/* Progress bar */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, color: W(0.4) }}>Progress</Text>
          {progressPercent === 100 ? <Text style={{ fontSize: 11, fontWeight: "600", color: W(0.4) }}>100%</Text> : null}
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: W(0.1), overflow: "hidden", marginBottom: 16 }}>
          <Animated.View style={{ height: "100%", borderRadius: 3, width: animatedWidth, backgroundColor: color }} />
        </View>

        {/* Headline */}
        <Text style={{ fontSize: 19, fontWeight: "700", color: "#fff", lineHeight: 24 }}>{headline}</Text>

        {/* Most recent update */}
        {mostRecent ? (
          <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: W(0.1) }}>
            <Text style={{ fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, color: W(0.4), marginBottom: 4 }}>Most recent update</Text>
            <Text style={{ fontSize: 15, fontWeight: "600", color: W(0.9), lineHeight: 20 }}>{ownerEventCopy(mostRecent, referral.speciality_needed, petName)}</Text>
            <Text style={{ fontSize: 12, color: W(0.45), marginTop: 2 }}>{formatUpdateTime(mostRecent.created_at)}</Text>
          </View>
        ) : null}
      </View>

      {/* Collapsible history */}
      {historySteps.length > 0 ? (
        <>
          <TouchableOpacity onPress={toggleHistory} activeOpacity={0.7}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: 1, borderTopColor: W(0.1) }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: W(0.8) }}>Journey history</Text>
            <Text style={{ fontSize: 14, color: W(0.5) }}>{historyOpen ? "▲" : "▼"}</Text>
          </TouchableOpacity>

          {historyOpen ? (
            <View style={{ paddingHorizontal: 18, paddingBottom: 18, paddingTop: 4 }}>
              {/* Continuous connector line running behind all circles.
                  top: aligns to centre of first circle (paddingTop 4 + half of 24 = 16)
                  bottom: stops at centre of last circle (paddingBottom 18 + half of 24 = 30) */}
              {historySteps.length > 1 ? (
                <View
                  pointerEvents="none"
                  style={{ position: "absolute", left: 18 + 12, top: 4 + 12, bottom: 18 + 12, width: 1, backgroundColor: W(0.2), transform: [{ translateX: -0.5 }] }}
                />
              ) : null}

              {historySteps.map(({ label, stepIdx }, idx) => {
                const isCurrent = stepIdx === activeIdx && !journeyComplete;
                const isCompleted = stepIdx < activeIdx || journeyComplete;
                const isMostRecent = idx === 0;
                const ts = stepTimestamps[stepIdx];
                const sub = stepSubDetail(stepIdx, referral, events, specialist);

                return (
                  <View key={stepIdx} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingBottom: idx === historySteps.length - 1 ? 0 : 18 }}>
                    {/* Timeline circle (sits on top of the continuous line) */}
                    <View style={{ width: 24, alignItems: "center" }}>
                      {isCompleted && isMostRecent ? (
                        <View style={{ height: 24, width: 24, borderRadius: 12, backgroundColor: "#10b981", alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900" }}>✓</Text>
                        </View>
                      ) : isCompleted || isCurrent ? (
                        <View style={{ height: 24, width: 24, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ color: GREEN, fontSize: 12, fontWeight: "900" }}>✓</Text>
                        </View>
                      ) : (
                        <View style={{ height: 24, width: 24, borderRadius: 12, borderWidth: 1, borderColor: W(0.25), backgroundColor: GREEN }} />
                      )}
                    </View>
                    {/* Content */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "600", lineHeight: 20, color: isMostRecent ? "#fff" : W(0.8) }}>{label}</Text>
                      {sub ? <Text style={{ fontSize: 13, lineHeight: 18, color: W(0.55), marginTop: 2 }}>{sub}</Text> : null}
                      {ts ? <Text style={{ fontSize: 12, color: W(0.35), marginTop: 2 }}>{formatUpdateTime(ts)}</Text> : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────
export default function ReferralTrackerScreen() {
  const params = useLocalSearchParams();
  const referralId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  const [loadState, setLoadState] = useState<"loading" | "ready" | "notfound">("loading");
  const [referral, setReferral] = useState<ReferralRow | null>(null);
  const [events, setEvents] = useState<ReferralEventRow[]>([]);

  const load = useCallback(async () => {
    if (!referralId) { setLoadState("notfound"); return; }
    setLoadState("loading");
    const { data: refData, error } = await supabase
      .from("referrals")
      .select(`*, pets(*), profiles!referring_vet_id(full_name, email, phone), practices(name, suburb, state, phone), specialists(clinic_name, suburb, state, postcode, address, phone, email, specialist_clinics(name, phone, email, suburb, state, postcode, address))`)
      .eq("id", referralId)
      .single();

    if (error || !refData) { setLoadState("notfound"); return; }
    setReferral(refData as ReferralRow);

    const { data: evData } = await supabase.from("referral_events").select("*").eq("referral_id", referralId).order("created_at", { ascending: false });
    setEvents((evData ?? []) as ReferralEventRow[]);
    setLoadState("ready");
  }, [referralId]);

  useEffect(() => { void load(); }, [load]);

  const pet = useMemo(() => unwrapOne(referral?.pets ?? null), [referral]);
  const specialist = useMemo(() => unwrapOne(referral?.specialists), [referral]);
  const vetProfile = useMemo(() => unwrapOne(referral?.profiles), [referral]);
  const practice = useMemo(() => unwrapOne(referral?.practices), [referral]);

  if (loadState === "loading") {
    return <View style={styles.center}><ActivityIndicator color="#fff" /></View>;
  }
  if (loadState === "notfound" || !referral) {
    return <View style={styles.center}><Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Referral not found</Text></View>;
  }

  const activeIdx = activeStepIndex(referral.status, events);
  const statusLower = (referral.status ?? "").trim().toLowerCase();
  const journeyComplete = statusLower === "completed";
  const showSpecialistCard = ["accepted", "seen", "consulting", "treatment", "completed"].includes(statusLower);

  const petName = pet?.name?.trim() || "Your pet";
  const urgencyLabel = referral.urgency?.trim() || "—";
  const uc = urgencyColors(referral.urgency);
  const { phone: clinicPhone, email: clinicEmail } = specialistClinicPhoneEmail(specialist);
  const { address: clinicAddress, locLine: clinicLocLine } = specialistClinicAddressAndLocation(specialist);

  return (
    <View style={{ flex: 1, backgroundColor: PAGE_BG }}>
      <ScreenHeader title="Referral Tracker" />
      <ScrollView style={{ flex: 1, backgroundColor: PAGE_BG }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Pet photo */}
      {pet?.photo_url ? (
        <View style={{ alignItems: "center", marginBottom: 16 }}>
          <Image source={{ uri: pet.photo_url }} style={{ width: 110, height: 110, borderRadius: 55, borderWidth: 1.5, borderColor: W(0.2) }} />
        </View>
      ) : null}
      <Text style={{ fontSize: 22, fontWeight: "700", color: "#fff", textAlign: "center", marginBottom: 4 }}>{petName}&apos;s Referral</Text>
      <Text style={{ fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, color: W(0.45), textAlign: "center", marginBottom: 20 }}>Submitted {formatSubmitted(referral.created_at)}</Text>

      <FadeInView delay={0}>
        <StatusSummaryCard referral={referral} events={events} activeIdx={activeIdx} journeyComplete={journeyComplete} specialist={specialist} />
      </FadeInView>

      {/* Referral details */}
      <FadeInView delay={2150}>
      <View style={[styles.card, { padding: 18, marginTop: 16 }]}>
        <Label>Referral details</Label>
        <View style={{ marginTop: 12, gap: 16 }}>
          <View>
            <Label>Pet</Label>
            <Text style={styles.value}>{[petName, pet?.species, pet?.breed].filter(Boolean).join(" · ")}</Text>
            {pet?.sex ? <Text style={styles.subValue}>{pet.sex}</Text> : null}
            {[pet?.age, pet?.weight_kg != null ? `${pet.weight_kg} kg` : null].filter(Boolean).length > 0 ?
              <Text style={styles.subValue}>{[pet?.age, pet?.weight_kg != null ? `${pet.weight_kg} kg` : null].filter(Boolean).join(" · ")}</Text> : null}
          </View>

          <View>
            <Label>Speciality</Label>
            <Text style={styles.value}>{referral.speciality_needed?.trim() || "—"}</Text>
            <View style={{ marginTop: 8 }}>
              <Label>Urgency</Label>
              <View style={{ alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: uc.border, backgroundColor: uc.bg }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: uc.text }}>{urgencyLabel}</Text>
              </View>
            </View>
          </View>

          <View>
            <Label>Referring veterinarian</Label>
            <Text style={styles.value}>{vetProfile?.full_name?.trim() || "—"}</Text>
            {practice?.name?.trim() ? <Text style={styles.subValue}>{practice.name.trim()}{practice.suburb ? ` · ${practice.suburb}` : ""}{practice.state ? `, ${practice.state}` : ""}</Text> : null}
            {practice?.phone?.trim() ? (
              <Text style={[styles.subValue, { marginTop: 4 }]}>
                Phone: <Text style={{ textDecorationLine: "underline" }} onPress={() => Linking.openURL(`tel:${practice.phone!.replace(/\s/g, "")}`)}>{practice.phone}</Text>
              </Text>
            ) : null}
          </View>

          {showSpecialistCard ? (
            <View style={{ borderTopWidth: 1, borderTopColor: W(0.1), paddingTop: 16, gap: 16 }}>
              <View>
                <Label>Specialist clinic</Label>
                <Text style={[styles.value, { fontWeight: "700" }]}>{specialist?.clinic_name?.trim() || "—"}</Text>
              </View>
              <View>
                <Label>Address</Label>
                {clinicAddress ? <Text style={styles.subValue}>{clinicAddress}</Text> : null}
                {clinicLocLine ? <Text style={styles.subValue}>{clinicLocLine}</Text> : null}
                {!clinicAddress && !clinicLocLine ? <Text style={styles.subValue}>—</Text> : null}
              </View>
              <View>
                <Label>Contact</Label>
                {clinicPhone ? (
                  <Text style={styles.subValue}>
                    Phone: <Text style={{ textDecorationLine: "underline" }} onPress={() => Linking.openURL(`tel:${clinicPhone.replace(/\s/g, "")}`)}>{clinicPhone}</Text>
                  </Text>
                ) : null}
                {clinicEmail ? (
                  <Text style={[styles.subValue, { marginTop: 2 }]}>
                    Email: <Text style={{ textDecorationLine: "underline" }} onPress={() => Linking.openURL(`mailto:${clinicEmail}`)}>{clinicEmail}</Text>
                  </Text>
                ) : null}
                {!clinicPhone && !clinicEmail ? <Text style={styles.subValue}>—</Text> : null}
              </View>
            </View>
          ) : null}
        </View>
      </View>
      </FadeInView>

      {/* Follow us on Facebook card */}
      <FadeInView delay={2550}>
      <View style={[styles.card, { padding: 18, marginTop: 16, alignItems: "center" }]}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff", marginBottom: 8, textAlign: "center" }}>Follow us on Facebook</Text>
        <Text style={{ fontSize: 14, lineHeight: 20, color: W(0.7), textAlign: "center", marginBottom: 20 }}>
          Join the Rufferral community for pet health tips, specialist insights and updates on new features.
        </Text>
        <TouchableOpacity
          onPress={() => Linking.openURL("https://www.facebook.com/rufferral/")}
          activeOpacity={0.85}
          style={{ width: "100%", backgroundColor: "#fff", borderRadius: 999, paddingVertical: 13, alignItems: "center" }}
        >
          <Text style={{ fontSize: 15, fontWeight: "700", color: GREEN }}>Follow Rufferral →</Text>
        </TouchableOpacity>
      </View>
      </FadeInView>

      {/* Rufferral wordmark */}
      <View style={{ alignItems: "center", marginTop: 24 }}>
        <Image source={require("../../assets/Rufferral_logo_white_v04.png")} style={{ width: 160, height: 48, resizeMode: "contain" }} />
      </View>

      {/* Copyright */}
      <Text style={{ marginTop: 24, fontSize: 12, fontWeight: "600", color: W(0.4), textAlign: "center" }}>
        © 2026 Rufferral · rufferral.com
      </Text>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: PAGE_BG, alignItems: "center", justifyContent: "center" },
  card: { borderRadius: 16, borderWidth: 0.75, borderColor: "#92bdb3", backgroundColor: GREEN, overflow: "hidden" },
  value: { fontSize: 15, fontWeight: "500", color: "#fff", lineHeight: 20 },
  subValue: { fontSize: 13, color: W(0.65), lineHeight: 18 },
});
