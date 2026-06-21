import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Linking } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";
import { PetCard, PetCardData, CardReferral } from "@/components/PetCard";
import { registerForPushNotifications } from "@/lib/notifications";
import { useAppReady } from "@/context/AppReadyContext";
import { EventLike, activeStepIndex } from "@/lib/referralProgress";
import { VetConnectModal } from "@/components/VetConnectModal";

type PetEmbed = { id: string; name: string | null; species: string | null; breed: string | null; date_of_birth: string | null; photo_url: string | null; };
type ReferralRow = { id: string; status: string | null; speciality_needed: string | null; created_at: string; pet_id: string | null; pets: PetEmbed | PetEmbed[] | null; };
type PracticeInfo = { name: string | null; vet_name: string | null; address: string | null; suburb: string | null; state: string | null; postcode: string | null; phone: string | null; website: string | null; };

function petEmbed(r: ReferralRow): PetEmbed | null {
  if (!r.pets) return null;
  return Array.isArray(r.pets) ? (r.pets[0] ?? null) : r.pets;
}

const ACTIVE_EXCLUDE = ["completed", "declined"];
const BOOKING_EVENTS = ["appointment_booked", "appointment_rescheduled"];

// Format an Australian phone number nicely, stripping +61 country code → local 0X format.
function formatAUPhone(raw: string | null): string {
  if (!raw) return "";
  let digits = raw.replace(/[^\d+]/g, "");
  // Strip +61 / 0061 country code and restore leading 0.
  if (digits.startsWith("+61")) digits = "0" + digits.slice(3);
  else if (digits.startsWith("0061")) digits = "0" + digits.slice(4);
  else if (digits.startsWith("61") && digits.length === 11) digits = "0" + digits.slice(2);
  digits = digits.replace(/\D/g, "");
  // Mobile: 04XX XXX XXX
  if (/^04\d{8}$/.test(digits)) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  // 13/1300/1800: 1300 XXX XXX / 1800 XXX XXX
  if (/^1(300|800)\d{6}$/.test(digits)) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  if (/^13\d{4}$/.test(digits)) return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
  // Landline with area code: 0X XXXX XXXX
  if (/^0[2378]\d{8}$/.test(digits)) return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
  // 8-digit local landline without area code: XXXX XXXX
  if (/^\d{8}$/.test(digits)) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  // Fallback: return cleaned original.
  return raw.trim();
}

// Clean a URL for display only (strip scheme + trailing slash). Does not change the actual link.
function formatWebsiteDisplay(url: string | null): string {
  if (!url) return "";
  return url.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" }); } catch { return "—"; }
}

export default function HomeScreen() {
  const router = useRouter();
  const c = Colors.light;
  const { setDashboardReady } = useAppReady();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [activeCount, setActiveCount] = useState(0);
  const [awaitingCount, setAwaitingCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [urgentPet, setUrgentPet] = useState<PetCardData | null>(null);
  const [practice, setPractice] = useState<PracticeInfo | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [connectedPracticeId, setConnectedPracticeId] = useState<string | null>(null);
  const [editingVet, setEditingVet] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();
    const p = profile as { full_name?: string | null; email?: string | null } | null;
    const name = p?.full_name?.trim() ?? p?.email?.trim() ?? "";
    setFirstName(name.split(" ")[0] ?? "there");

    const { data: refData } = await supabase
      .from("referrals")
      .select("id, status, speciality_needed, created_at, pet_id, pets(id, name, species, breed, date_of_birth, photo_url)")
      .ilike("owner_email", user.email ?? "")
      .order("created_at", { ascending: false });
    const allRefs = (refData ?? []) as ReferralRow[];
    const activeRefs = allRefs.filter(r => !ACTIVE_EXCLUDE.includes((r.status ?? "").toLowerCase()));
    setActiveCount(activeRefs.length);

    const refIds = activeRefs.map(r => r.id);
    const eventsByRef: Record<string, EventLike[]> = {};
    const lastUpdateByRef: Record<string, string | null> = {};
    let overallLatest: string | null = null;
    if (refIds.length > 0) {
      const { data: evData } = await supabase
        .from("referral_events")
        .select("referral_id, event_type, created_at")
        .in("referral_id", refIds)
        .order("created_at", { ascending: false });
      for (const ev of (evData ?? []) as { referral_id: string; event_type: string | null; created_at: string | null }[]) {
        (eventsByRef[ev.referral_id] ??= []).push({ event_type: ev.event_type, created_at: ev.created_at });
        if (!(ev.referral_id in lastUpdateByRef)) lastUpdateByRef[ev.referral_id] = ev.created_at;
        if (!overallLatest && ev.created_at) overallLatest = ev.created_at;
      }
    }
    setLastUpdate(overallLatest);

    // Awaiting action proxy: latest event is a booking type.
    let awaiting = 0;
    for (const r of activeRefs) {
      const evs = eventsByRef[r.id] ?? [];
      if (evs.length > 0 && BOOKING_EVENTS.includes(evs[0].event_type ?? "")) awaiting++;
    }
    setAwaitingCount(awaiting);

    // Most-urgent referral: awaiting-action first, else furthest-along, else most recent.
    const scored = activeRefs.map(r => {
      const evs = eventsByRef[r.id] ?? [];
      const isAwaiting = evs.length > 0 && BOOKING_EVENTS.includes(evs[0].event_type ?? "");
      return { r, isAwaiting, step: activeStepIndex(r.status, evs), evs };
    });
    scored.sort((a, b) => {
      if (a.isAwaiting !== b.isAwaiting) return a.isAwaiting ? -1 : 1;
      if (a.step !== b.step) return b.step - a.step;
      return new Date(b.r.created_at).getTime() - new Date(a.r.created_at).getTime();
    });
    const top = scored[0];
    if (top) {
      const pe = petEmbed(top.r);
      const pid = pe?.id ?? top.r.pet_id;
      if (pe && pid) {
        const cardRef: CardReferral = {
          id: top.r.id, status: top.r.status, speciality_needed: top.r.speciality_needed, created_at: top.r.created_at,
          events: top.evs, lastUpdate: lastUpdateByRef[top.r.id] ?? null,
        };
        setUrgentPet({ id: pid, name: pe.name, species: pe.species, breed: pe.breed, date_of_birth: pe.date_of_birth, photo_url: pe.photo_url, referrals: [cardRef] });
      } else setUrgentPet(null);
    } else setUrgentPet(null);

    // Vet practice: prefer the consent-connected practice; fall back to most recent referral's practice.
    let resolvedPracticeId: string | null = null;
    let resolvedVetId: string | null = null;

    const { data: consent } = await supabase
      .from("practice_owner_consents")
      .select("practice_id")
      .eq("owner_id", user.id)
      .eq("consent_given", true)
      .order("consent_given_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const consentRow = consent as { practice_id?: string | null } | null;

    if (consentRow?.practice_id) {
      resolvedPracticeId = consentRow.practice_id;
      setConnectedPracticeId(consentRow.practice_id);
    } else {
      setConnectedPracticeId(null);
      const { data: latestPractice } = await supabase.from("referrals").select("practice_id, referring_vet_id").ilike("owner_email", user.email ?? "").not("practice_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const lp = latestPractice as { practice_id?: string | null; referring_vet_id?: string | null } | null;
      if (lp?.practice_id) { resolvedPracticeId = lp.practice_id; resolvedVetId = lp.referring_vet_id ?? null; }
    }

    if (resolvedPracticeId) {
      const { data: practiceRow } = await supabase.from("practices").select("name, address, suburb, state, postcode, phone, website").eq("id", resolvedPracticeId).maybeSingle();
      const { data: vetRow } = resolvedVetId
        ? await supabase.from("profiles").select("full_name").eq("id", resolvedVetId).maybeSingle()
        : { data: null };
      if (practiceRow) {
        const pr = practiceRow as Record<string, string | null>;
        const vr = vetRow as { full_name?: string | null } | null;
        setPractice({ name: pr.name, vet_name: vr?.full_name ?? null, address: pr.address, suburb: pr.suburb, state: pr.state, postcode: pr.postcode, phone: pr.phone, website: pr.website });
      }
    } else {
      setPractice(null);
    }

    await registerForPushNotifications(user.id);
    setLoading(false);
    setDashboardReady(true);
  }, []);

  useEffect(() => { void load(); }, [load]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="#ffffff" /></SafeAreaView>;

  const Tile = ({ label, value, accent }: { label: string; value: string; accent?: string }) => (
    <View style={{ flex: 1, backgroundColor: c.card, borderRadius: 16, borderWidth: 0.75, borderColor: c.border, paddingVertical: 16, paddingHorizontal: 12, alignItems: "center" }}>
      <Text style={{ fontSize: 24, fontWeight: "800", color: accent ?? c.text }}>{value}</Text>
      <Text style={{ fontSize: 11, fontWeight: "700", color: c.subtext, textTransform: "uppercase", letterSpacing: 0.4, textAlign: "center", marginTop: 4 }}>{label}</Text>
    </View>
  );

  const sectionLabel = { fontSize: 13, fontWeight: "700" as const, color: c.subtext, letterSpacing: 0.8, textTransform: "uppercase" as const, marginBottom: 12 };
  const linkRow = { backgroundColor: c.card, borderRadius: 12, borderWidth: 0.75, borderColor: c.border, padding: 16, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />}>
        <Text style={{ fontSize: 24, fontWeight: "700", color: c.text, marginBottom: 4 }}>Welcome back, {firstName} 👋</Text>
        <Text style={{ fontSize: 14, color: c.subtext, marginBottom: 20 }}>{activeCount > 0 ? `${activeCount} active referral${activeCount > 1 ? "s" : ""}` : "No active referrals"}</Text>

        {/* Summary tiles */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 24 }}>
          <Tile label="Active Referrals" value={String(activeCount)} />
          <Tile label="Awaiting You" value={String(awaitingCount)} accent={awaitingCount > 0 ? "#f59e0b" : undefined} />
          <Tile label={"Last\nUpdate"} value={formatDate(lastUpdate)} />
        </View>

        {/* Most urgent referral */}
        {urgentPet ? (
          <View style={{ marginBottom: 12 }}>
            <Text style={sectionLabel}>Latest Update</Text>
            <PetCard pet={urgentPet} />
          </View>
        ) : (
          <View style={{ marginBottom: 12, backgroundColor: c.card, borderRadius: 16, borderWidth: 0.75, borderColor: c.border, padding: 20, alignItems: "center" }}>
            <Text style={{ fontSize: 15, color: c.subtext, textAlign: "center" }}>You're all caught up — no referrals need your attention right now.</Text>
          </View>
        )}

        {/* Quick links */}
        <View style={{ gap: 10 }}>
          <TouchableOpacity onPress={() => router.push("/(tabs)/referrals")} style={linkRow}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: c.text }}>View all referrals</Text>
            <Text style={{ color: c.subtext, fontSize: 18 }}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/(tabs)/pets")} style={linkRow}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: c.text }}>My pets</Text>
            <Text style={{ color: c.subtext, fontSize: 18 }}>→</Text>
          </TouchableOpacity>
        </View>

        {/* My Vet Clinic */}
        <View style={{ marginTop: 24 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text style={[sectionLabel, { marginBottom: 0 }]}>My Vet Clinic</Text>
            <TouchableOpacity onPress={() => setEditingVet(true)} style={{ paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999, borderWidth: 0.75, borderColor: c.border }}>
              <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>{connectedPracticeId ? "Edit" : "Connect"}</Text>
            </TouchableOpacity>
          </View>
          {practice?.name ? (
            <View style={{ backgroundColor: c.card, borderRadius: 12, borderWidth: 0.75, borderColor: c.border, padding: 16 }}>
              {practice.name ? <Text style={{ fontSize: 17, fontWeight: "700", color: c.text }}>{practice.name}</Text> : null}
              {practice.vet_name ? <Text style={{ fontSize: 14, color: c.subtext, marginTop: 2 }}>{practice.vet_name}</Text> : null}
              {(practice.address || practice.suburb) ? (
                <Text style={{ fontSize: 14, color: c.subtext, marginTop: 6 }}>
                  {practice.address && practice.address.trim()
                    ? practice.address.trim()
                    : [practice.suburb, practice.state, practice.postcode].filter(Boolean).join(" ")}
                </Text>
              ) : null}
              {practice.phone ? (
                <Text style={{ fontSize: 14, color: c.subtext, marginTop: 4 }}>
                  Phone: <Text style={{ color: c.text, textDecorationLine: "underline" }} onPress={() => Linking.openURL(`tel:${practice.phone!.replace(/\s/g, "")}`)}>{formatAUPhone(practice.phone)}</Text>
                </Text>
              ) : null}
              {practice.website ? (
                <Text style={{ fontSize: 14, color: c.subtext, marginTop: 4 }}>
                  Website: <Text style={{ color: c.text, textDecorationLine: "underline" }} onPress={() => Linking.openURL(practice.website!.startsWith("http") ? practice.website! : `https://${practice.website}`)}>{formatWebsiteDisplay(practice.website)}</Text>
                </Text>
              ) : null}
              {!connectedPracticeId ? (
                <Text style={{ fontSize: 12, color: c.muted, marginTop: 8, fontStyle: "italic" }}>From your most recent referral. Tap Connect to choose your clinic.</Text>
              ) : null}
            </View>
          ) : (
            <View style={{ backgroundColor: c.card, borderRadius: 12, borderWidth: 0.75, borderColor: c.border, padding: 16 }}>
              <Text style={{ fontSize: 14, color: c.subtext }}>You haven't connected a vet clinic yet. Tap Connect to search and link your clinic so they can support your pet's care.</Text>
            </View>
          )}
        </View>
      </ScrollView>
      <VetConnectModal
        visible={editingVet}
        onClose={() => setEditingVet(false)}
        userId={userId}
        connectedPracticeId={connectedPracticeId}
        onChanged={() => void load()}
      />
    </SafeAreaView>
  );
}
