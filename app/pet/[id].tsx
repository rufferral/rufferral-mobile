import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Linking,
  useColorScheme,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";
import { StatusBadge } from "@/components/StatusBadge";

// ── Types (ported from web) ────────────────────────────────────────────────
type PetRow = {
  id: string; name: string | null; species: string | null; breed: string | null;
  sex: string | null; age: string | null; weight_kg: number | null; date_of_birth: string | null;
  photo_url: string | null; owner_id: string | null; microchip_number: string | null;
  food_brand: string | null; food_type: string | null; food_amount_grams: number | null;
  feeding_frequency: number | null; treats: string | null; supplements: string | null;
  food_sensitivities: string | null; exercise_duration_mins: number | null;
  exercise_types: string | null; living_situation: string | null; backyard_access: boolean | null;
  other_pets: string | null; temperament: string | null; training_level: string | null;
  known_allergies: string | null; chronic_conditions: string | null;
  vaccination_status: string | null; last_vaccinated: string | null; desexed_date: string | null;
  acquisition_source: string | null; insurance_provider: string | null;
};

type ReferralRow = {
  id: string; status: string | null; speciality_needed: string | null;
  urgency: string | null; created_at: string; preferred_clinic: string | null;
};

type PrescriptionRow = {
  id: string; medication_name: string; dosage: string | null; frequency: string | null;
  prescribed_by_type: string | null; prescribed_by_name: string | null;
  start_date: string | null; end_date: string | null; repeats_total: number | null;
  repeats_remaining: number | null; status: string | null; purchase_url: string | null;
  purchase_product_name: string | null; purchase_image_url: string | null;
  purchase_price: string | null; notes: string | null;
};

type PracticeInfo = {
  name: string | null; suburb: string | null; state: string | null;
  postcode: string | null; phone: string | null; email: string | null;
  address: string | null; vet_name: string | null;
};

// ── Helpers (ported verbatim) ──────────────────────────────────────────────
function calculateAge(dob: string): string {
  const raw = dob?.trim().split("T")[0]; if (!raw) return "—";
  const parts = raw.split("-"); if (parts.length < 3) return "—";
  const y = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1, d = parseInt(parts[2], 10);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return "—";
  const birth = new Date(y, m, d), today = new Date();
  birth.setHours(0, 0, 0, 0); today.setHours(0, 0, 0, 0);
  if (birth > today) return "0 months";
  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();
  const days = today.getDate() - birth.getDate();
  if (days < 0) months--;
  if (months < 0) { years--; months += 12; }
  if (years < 0) return "—";
  if (years === 0) return `${months} month${months === 1 ? "" : "s"}`;
  return `${years} year${years === 1 ? "" : "s"} ${months} month${months === 1 ? "" : "s"}`;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }); } catch { return "—"; }
}

// Split "1 year 3 months" into ["1 year", "3 months"]; "3 months" stays one line.
function ageLines(age: string): string[] {
  const m = age.match(/^(\d+\s+years?)\s+(\d+\s+months?)$/);
  if (m) return [m[1], m[2]];
  return [age];
}

// ── Small presentational helpers ───────────────────────────────────────────
function Field({ label, value, c }: { label: string; value: string | null | undefined; c: typeof Colors.light }) {
  const display = value && value.trim() ? value : "—";
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 12, fontWeight: "600", color: c.subtext, marginBottom: 3 }}>{label}</Text>
      <Text style={{ fontSize: 15, color: c.text, lineHeight: 20 }}>{display}</Text>
    </View>
  );
}

export default function PetProfileScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const petId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const c = dark ? Colors.dark : Colors.light;

  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing">("loading");
  const [pet, setPet] = useState<PetRow | null>(null);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>([]);
  const [practice, setPractice] = useState<PracticeInfo | null>(null);

  const loadData = useCallback(async () => {
    if (!petId) { setLoadState("missing"); return; }
    const { data: { user } } = await supabase.auth.getUser();

    const { data: petData, error } = await supabase.from("pets").select("*").eq("id", petId).maybeSingle();
    if (error || !petData) { setLoadState("missing"); return; }
    setPet(petData as PetRow);

    const { data: refData } = await supabase.from("referrals")
      .select("id, status, speciality_needed, urgency, created_at, preferred_clinic")
      .eq("pet_id", petId).order("created_at", { ascending: false });
    setReferrals((refData ?? []) as ReferralRow[]);

    const { data: rxData } = await supabase.from("prescriptions")
      .select("id, medication_name, dosage, frequency, prescribed_by_type, prescribed_by_name, start_date, end_date, repeats_total, repeats_remaining, status, purchase_url, purchase_product_name, purchase_image_url, purchase_price, notes")
      .eq("pet_id", petId).order("created_at", { ascending: false });
    setPrescriptions((rxData ?? []) as PrescriptionRow[]);

    const { data: latestReferral } = await supabase.from("referrals")
      .select("practice_id, referring_vet_id").eq("owner_email", user?.email ?? "")
      .not("practice_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const lr = latestReferral as { practice_id?: string | null; referring_vet_id?: string | null } | null;
    if (lr?.practice_id) {
      const { data: practiceRow } = await supabase.from("practices").select("name, suburb, state, postcode, phone, email, address").eq("id", lr.practice_id).maybeSingle();
      const { data: vetRow } = await supabase.from("profiles").select("full_name").eq("id", lr.referring_vet_id ?? "").maybeSingle();
      if (practiceRow) {
        const pr = practiceRow as { name?: string | null; suburb?: string | null; state?: string | null; postcode?: string | null; phone?: string | null; email?: string | null; address?: string | null; };
        const vr = vetRow as { full_name?: string | null } | null;
        setPractice({ name: pr.name ?? null, suburb: pr.suburb ?? null, state: pr.state ?? null, postcode: pr.postcode ?? null, phone: pr.phone ?? null, email: pr.email ?? null, address: pr.address ?? null, vet_name: vr?.full_name ?? null });
      }
    }

    setLoadState("ready");
  }, [petId]);

  useEffect(() => { void loadData(); }, [loadData]);

  if (loadState === "loading") {
    return <SafeAreaView style={[styles.center, { backgroundColor: c.bg }]}><ActivityIndicator color={Colors.brand} /></SafeAreaView>;
  }
  if (loadState === "missing" || !pet) {
    return <SafeAreaView style={[styles.center, { backgroundColor: c.bg }]}><Text style={{ color: c.text, fontSize: 16 }}>Pet not found.</Text></SafeAreaView>;
  }

  const dobStr = pet.date_of_birth ?? "";
  const ageDisplay = dobStr ? calculateAge(dobStr) : pet.age ?? "—";
  const activeReferrals = referrals.filter(r => !["completed", "declined"].includes((r.status ?? "").toLowerCase()));
  const pastReferrals = referrals.filter(r => ["completed", "declined"].includes((r.status ?? "").toLowerCase()));
  const activePrescriptions = prescriptions.filter(rx => (rx.status ?? "").toLowerCase() === "active");
  const pastPrescriptions = prescriptions.filter(rx => (rx.status ?? "").toLowerCase() !== "active");

  const card = { backgroundColor: c.card, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 18, marginBottom: 16 } as const;
  const sectionHeading = { fontSize: 13, fontWeight: "700" as const, textTransform: "uppercase" as const, letterSpacing: 0.6, color: c.subtext, marginBottom: 12 };
  const statTile = { flex: 1, backgroundColor: c.cardInner, borderRadius: 8, borderWidth: 1, borderColor: c.border, paddingVertical: 12, alignItems: "center" as const };
  const statHead = { fontSize: 11, fontWeight: "700" as const, textTransform: "uppercase" as const, letterSpacing: 0.4, color: c.muted, textAlign: "center" as const };
  const statVal = { marginTop: 6, fontSize: 14, fontWeight: "600" as const, color: c.text, textAlign: "center" as const };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

      {/* Pet header card */}
      <View style={[card, { alignItems: "center", paddingVertical: 24 }]}>
        {pet.photo_url ? (
          <Image source={{ uri: pet.photo_url }} style={{ width: 120, height: 120, borderRadius: 60, borderWidth: 1, borderColor: c.border }} />
        ) : (
          <View style={{ width: 120, height: 120, borderRadius: 60, borderWidth: 1, borderColor: c.border, backgroundColor: c.cardInner, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 48 }}>🐾</Text>
          </View>
        )}
        <Text style={{ fontSize: 26, fontWeight: "700", color: c.text, marginTop: 14 }}>{pet.name ?? "—"}</Text>
        <Text style={{ fontSize: 15, color: c.subtext, marginTop: 2 }}>{[pet.species, pet.breed].filter(Boolean).join(" · ") || "—"}</Text>

        {/* Stat tiles */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 16, alignSelf: "stretch" }}>
          <View style={statTile}><Text style={statHead}>Sex</Text><Text style={statVal}>{pet.sex || "—"}</Text></View>
          <View style={statTile}>
            <Text style={statHead}>Age</Text>
            {ageLines(ageDisplay).map((line, i) => (
              <Text key={i} style={[statVal, i > 0 ? { marginTop: 0 } : null]}>{line}</Text>
            ))}
          </View>
          <View style={statTile}><Text style={statHead}>Weight</Text><Text style={statVal}>{pet.weight_kg != null ? `${pet.weight_kg} kg` : "—"}</Text></View>
        </View>

        {/* Vet card + referral counts */}
        {practice?.name ? (
          <View style={{ alignSelf: "stretch", marginTop: 16, gap: 8 }}>
            <View style={{ backgroundColor: c.cardInner, borderRadius: 8, borderWidth: 1, borderColor: c.border, padding: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, color: c.muted, marginBottom: 8 }}>My Veterinarian</Text>
              <Text style={{ fontSize: 15, fontWeight: "600", color: c.text }}>{practice.name}</Text>
              {practice.vet_name ? <Text style={{ fontSize: 14, color: c.subtext, marginTop: 2 }}>{practice.vet_name}</Text> : null}
              {practice.address ? <Text style={{ fontSize: 14, color: c.subtext, marginTop: 4 }}>{practice.address}</Text> : null}
              {(practice.suburb || practice.state || practice.postcode) ? (
                <Text style={{ fontSize: 14, color: c.subtext }}>{[practice.suburb, practice.state, practice.postcode].filter(Boolean).join(", ")}</Text>
              ) : null}
              {practice.phone ? (
                <Text style={{ fontSize: 14, color: c.subtext, marginTop: 4 }}>
                  Phone: <Text style={{ color: c.text, textDecorationLine: "underline" }} onPress={() => Linking.openURL(`tel:${practice.phone!.replace(/\s/g, "")}`)}>{practice.phone}</Text>
                </Text>
              ) : null}
              {practice.email ? (
                <Text style={{ fontSize: 14, color: c.subtext }}>
                  Email: <Text style={{ color: c.text, textDecorationLine: "underline" }} onPress={() => Linking.openURL(`mailto:${practice.email}`)}>{practice.email}</Text>
                </Text>
              ) : null}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={statTile}><Text style={statHead}>Total{"\n"}Referrals</Text><Text style={[statVal, { fontSize: 18, fontWeight: "700" }]}>{referrals.length}</Text></View>
              <View style={statTile}><Text style={statHead}>Active{"\n"}Referrals</Text><Text style={[statVal, { fontSize: 18, fontWeight: "700" }]}>{activeReferrals.length}</Text></View>
              <View style={statTile}><Text style={statHead}>Last{"\n"}Referral</Text><Text style={[statVal, { fontSize: 13, fontWeight: "700" }]}>{referrals[0]?.created_at ? formatDate(referrals[0].created_at) : "—"}</Text></View>
            </View>
          </View>
        ) : null}
      </View>

      {/* Active Referrals */}
      <View style={card}>
        <Text style={sectionHeading}>{activeReferrals.length > 0 ? `Active Referrals (${activeReferrals.length})` : "Active Referrals"}</Text>
        {activeReferrals.length === 0 ? (
          <Text style={{ fontSize: 15, color: c.subtext }}>No active referrals</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {activeReferrals.map((ref) => (
              <View key={ref.id} style={{ backgroundColor: c.cardInner, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 14 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: c.text }}>{ref.speciality_needed ?? "Specialist"} referral</Text>
                    <Text style={{ fontSize: 13, color: c.subtext, marginTop: 2 }}>{ref.preferred_clinic ?? "—"} · {formatDate(ref.created_at)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <StatusBadge status={ref.status} />
                    <TouchableOpacity onPress={() => router.push(`/referral/${ref.id}`)}>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.brand }}>Track →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Referral History */}
      {pastReferrals.length > 0 ? (
        <View style={card}>
          <Text style={sectionHeading}>Referral History</Text>
          <View style={{ gap: 10 }}>
            {pastReferrals.map((ref) => (
              <View key={ref.id} style={{ backgroundColor: c.cardInner, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 14, opacity: dark ? 1 : 0.75 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: c.text }}>{ref.speciality_needed ?? "Specialist"} referral</Text>
                    <Text style={{ fontSize: 13, color: c.subtext, marginTop: 2 }}>{ref.preferred_clinic ?? "—"} · {formatDate(ref.created_at)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <StatusBadge status={ref.status} />
                    <TouchableOpacity onPress={() => router.push(`/referral/${ref.id}`)}>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.brand }}>View →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Pet Details */}
      <View style={card}>
        <Text style={sectionHeading}>Pet Details</Text>
        <View style={{ flexDirection: "row", gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Field label="Name" value={pet.name} c={c} />
            <Field label="Species" value={pet.species} c={c} />
            <Field label="Breed" value={pet.breed} c={c} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Sex" value={pet.sex} c={c} />
            <Field label="Date of birth" value={pet.date_of_birth ? formatDate(pet.date_of_birth) : null} c={c} />
            <Field label="Weight" value={pet.weight_kg != null ? `${pet.weight_kg} kg` : null} c={c} />
          </View>
        </View>
      </View>

      {/* Health & Medical */}
      <View style={card}>
        <Text style={sectionHeading}>Health & Medical</Text>
        <View style={{ flexDirection: "row", gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Field label="Microchip number" value={pet.microchip_number} c={c} />
            <Field label="Desexed date" value={pet.desexed_date ? formatDate(pet.desexed_date) : null} c={c} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Vaccination status" value={pet.vaccination_status} c={c} />
            <Field label="Last vaccinated" value={pet.last_vaccinated ? formatDate(pet.last_vaccinated) : null} c={c} />
          </View>
        </View>
        <Field label="Known allergies" value={pet.known_allergies} c={c} />
        <Field label="Chronic conditions / diagnoses" value={pet.chronic_conditions} c={c} />
      </View>

      {/* Nutrition & Diet */}
      <View style={card}>
        <Text style={sectionHeading}>Nutrition & Diet</Text>
        <View style={{ flexDirection: "row", gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Field label="Primary food brand" value={pet.food_brand} c={c} />
            <Field label="Food type" value={pet.food_type} c={c} />
            <Field label="Daily amount (grams)" value={pet.food_amount_grams != null ? `${pet.food_amount_grams} g` : null} c={c} />
            <Field label="Meals per day" value={pet.feeding_frequency != null ? String(pet.feeding_frequency) : null} c={c} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Treats / snacks" value={pet.treats} c={c} />
            <Field label="Supplements" value={pet.supplements} c={c} />
            <Field label="Food sensitivities" value={pet.food_sensitivities} c={c} />
          </View>
        </View>
      </View>

      {/* Lifestyle & Exercise */}
      <View style={card}>
        <Text style={sectionHeading}>Lifestyle & Exercise</Text>
        <Field label="Daily exercise (minutes)" value={pet.exercise_duration_mins != null ? `${pet.exercise_duration_mins} mins` : null} c={c} />
        <Field label="Exercise types" value={pet.exercise_types} c={c} />
        <Field label="Living situation" value={pet.living_situation} c={c} />
        <Field label="Backyard access" value={pet.backyard_access === true ? "Yes" : pet.backyard_access === false ? "No" : null} c={c} />
        <Field label="Training level" value={pet.training_level} c={c} />
        <Field label="Temperament" value={pet.temperament} c={c} />
        <Field label="Other pets in household" value={pet.other_pets} c={c} />
      </View>

      {/* Ownership */}
      <View style={card}>
        <Text style={sectionHeading}>Ownership</Text>
        <Field label="Acquisition source" value={pet.acquisition_source} c={c} />
        <Field label="Pet insurance provider" value={pet.insurance_provider} c={c} />
      </View>

      {/* Prescriptions */}
      <View style={card}>
        <Text style={sectionHeading}>Prescriptions</Text>
        {prescriptions.length === 0 ? (
          <Text style={{ fontSize: 15, color: c.subtext }}>No prescriptions on file</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {[...activePrescriptions, ...pastPrescriptions].map((rx) => {
              const isActive = (rx.status ?? "").toLowerCase() === "active";
              return (
                <View key={rx.id} style={{ backgroundColor: c.cardInner, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 14, opacity: isActive ? 1 : 0.6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: c.text }}>{rx.medication_name}</Text>
                    {isActive ? (
                      <View style={{ backgroundColor: "#10b981", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>Active</Text>
                      </View>
                    ) : (
                      <View style={{ backgroundColor: c.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: c.subtext }}>{rx.status ? rx.status.charAt(0).toUpperCase() + rx.status.slice(1) : "—"}</Text>
                      </View>
                    )}
                  </View>
                  {rx.dosage ? <Text style={{ fontSize: 13, color: c.subtext, marginTop: 3 }}>{rx.dosage}{rx.frequency ? ` · ${rx.frequency}` : ""}</Text> : null}
                  {rx.prescribed_by_name ? <Text style={{ fontSize: 13, color: c.muted, marginTop: 3 }}>Prescribed by {rx.prescribed_by_name}</Text> : null}
                  {(rx.start_date || rx.end_date) ? <Text style={{ fontSize: 13, color: c.muted, marginTop: 3 }}>{rx.start_date ? formatDate(rx.start_date) : "—"}{rx.end_date ? ` → ${formatDate(rx.end_date)}` : ""}</Text> : null}
                  {rx.repeats_remaining != null ? <Text style={{ fontSize: 13, color: c.muted, marginTop: 3 }}>{rx.repeats_remaining} repeat{rx.repeats_remaining === 1 ? "" : "s"} remaining</Text> : null}
                  {rx.notes ? <Text style={{ fontSize: 13, color: c.subtext, marginTop: 4, fontStyle: "italic" }}>{rx.notes}</Text> : null}
                  {isActive && rx.purchase_url ? (
                    <TouchableOpacity onPress={() => Linking.openURL(rx.purchase_url!)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: c.border, borderRadius: 8, padding: 8, marginTop: 12 }}>
                      {rx.purchase_image_url ? <Image source={{ uri: rx.purchase_image_url }} style={{ width: 44, height: 44, borderRadius: 4 }} resizeMode="contain" /> : null}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: c.text }}>{rx.purchase_product_name ?? rx.medication_name}</Text>
                        {rx.purchase_price ? <Text style={{ fontSize: 12, color: c.subtext, marginTop: 2 }}>Pet Circle Pharmacy · {rx.purchase_price}</Text> : null}
                      </View>
                      <View style={{ backgroundColor: Colors.brand, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
                        <Text style={{ fontSize: 12, fontWeight: "600", color: "#fff" }}>Buy →</Text>
                      </View>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
