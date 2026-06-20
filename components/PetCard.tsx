import { View, Text, Image, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { StatusBadge } from "@/components/StatusBadge";
import { activeStepIndex, progressPercent, getOwnerStatusHeadline, EventLike } from "@/lib/referralProgress";

export type CardReferral = {
  id: string;
  status: string | null;
  speciality_needed: string | null;
  created_at: string;
  events: EventLike[];
  lastUpdate: string | null; // latest referral_events timestamp
};

export type PetCardData = {
  id: string;
  name: string | null;
  species: string | null;
  breed: string | null;
  date_of_birth?: string | null;
  photo_url: string | null;
  referrals?: CardReferral[]; // active referrals for this pet
};

function calcAgeShort(dob: string): string {
  const parts = dob.trim().split("T")[0].split("-");
  if (parts.length < 3) return "—";
  const birth = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();
  if (today.getDate() < birth.getDate()) months--;
  if (months < 0) { years--; months += 12; }
  return years === 0 ? `${months}m` : `${years}y ${months}m`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }); } catch { return "—"; }
}

export function PetCard({ pet }: { pet: PetCardData }) {
  const router = useRouter();
  const c = Colors.light;
  const refs = pet.referrals ?? [];

  // Progress bar reflects the furthest-along active referral.
  const stepIdxs = refs.map(r => activeStepIndex(r.status, r.events));
  const maxIdx = stepIdxs.length ? Math.max(...stepIdxs) : 0;
  const pct = refs.length ? progressPercent(maxIdx) : 0;
  const barColor = refs.length ? getOwnerStatusHeadline(refs[0].status, maxIdx, false).color : c.border;

  return (
    <View style={{ backgroundColor: c.card, borderRadius: 12, borderWidth: 0.75, borderColor: c.border, padding: 16, marginBottom: 12 }}>

      {/* Top row — pet info + Profile pill */}
      <TouchableOpacity onPress={() => router.push(`/pet/${pet.id}`)} activeOpacity={0.85} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        {pet.photo_url ? (
          <Image source={{ uri: pet.photo_url }} style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 0.75, borderColor: c.border }} />
        ) : (
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.cardInner, borderWidth: 0.75, borderColor: c.border, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 28 }}>🐾</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: "700", color: c.text }}>{pet.name ?? "—"}</Text>
          <Text style={{ fontSize: 13, color: c.subtext, marginTop: 2 }}>{[pet.species, pet.breed].filter(Boolean).join(" · ") || "—"}</Text>
          {pet.date_of_birth ? <Text style={{ fontSize: 13, color: c.subtext, marginTop: 1 }}>Age: {calcAgeShort(pet.date_of_birth)}</Text> : null}
        </View>
        <View style={{ alignSelf: "flex-end", backgroundColor: c.bg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "700" }}>Profile</Text>
          <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "700" }}>→</Text>
        </View>
      </TouchableOpacity>

      {/* Divider */}
      <View style={{ height: 0.75, backgroundColor: c.border, marginVertical: 14 }} />

      {/* Referral status label + progress bar */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: c.text, textTransform: "uppercase", letterSpacing: 0.6 }}>Referral Status</Text>
        <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
          <View style={{ height: "100%", borderRadius: 3, width: `${pct}%`, backgroundColor: barColor }} />
        </View>
      </View>

      {/* Status box(es) */}
      {refs.length === 0 ? (
        <View style={{ backgroundColor: c.cardInner, borderRadius: 12, padding: 16 }}>
          <Text style={{ fontSize: 15, color: c.text }}>No current referrals</Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {refs.map(ref => (
            <View key={ref.id} style={{ backgroundColor: c.cardInner, borderRadius: 12, padding: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: c.text }}>{ref.speciality_needed ?? "Specialist"} referral</Text>
                  <Text style={{ fontSize: 13, color: c.subtext, marginTop: 3 }}>Last update:{"\n"}{formatDate(ref.lastUpdate ?? ref.created_at)}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 8 }}>
                  <StatusBadge status={ref.status} />
                  <TouchableOpacity onPress={() => router.push(`/referral/${ref.id}`)}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#ffffff" }}>View referral →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
