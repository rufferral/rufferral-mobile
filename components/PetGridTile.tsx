import { View, Text, Image, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/colors";
import { completionColor } from "@/lib/profileCompletion";

export type PetGridData = {
  id: string;
  name: string | null;
  species: string | null;
  breed: string | null;
  date_of_birth?: string | null;
  photo_url: string | null;
  activeCount?: number; // number of active referrals
  completedCount?: number; // number of completed referrals
  completion?: number; // profile completion 0-100
};

export function PetGridTile({ pet }: { pet: PetGridData }) {
  const router = useRouter();
  const c = Colors.light;
  const active = pet.activeCount ?? 0;
  const completed = pet.completedCount ?? 0;
  const completion = pet.completion ?? 100;
  const showCompletion = completion < 100;

  return (
    <TouchableOpacity
      onPress={() => router.push(`/pet/${pet.id}`)}
      activeOpacity={0.85}
      style={{ flex: 1, backgroundColor: c.card, borderRadius: 16, borderWidth: 0.75, borderColor: c.border, padding: 12, alignItems: "center" }}
    >
      {/* Status badges top-left */}
      {(active > 0 || completed > 0 || showCompletion) ? (
        <View style={{ position: "absolute", top: 16, left: 16, zIndex: 2, alignItems: "flex-start", gap: 4 }}>
          {active > 0 ? (
            <View style={{ backgroundColor: "#ffffff", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: "#0c5b45", fontSize: 11, fontWeight: "700" }}>{active} active referral{active > 1 ? "s" : ""}</Text>
            </View>
          ) : null}
          {completed > 0 ? (
            <View style={{ backgroundColor: "#ffffff", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: "#0c5b45", fontSize: 11, fontWeight: "700" }}>{completed} completed referral{completed > 1 ? "s" : ""}</Text>
            </View>
          ) : null}
          {showCompletion ? (
            <View style={{ backgroundColor: completionColor(completion), borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: "#ffffff", fontSize: 11, fontWeight: "700" }}>Profile {completion}% complete</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {pet.photo_url ? (
        <Image source={{ uri: pet.photo_url }} style={{ width: "100%", aspectRatio: 1, borderRadius: 12, marginBottom: 10 }} />
      ) : (
        <View style={{ width: "100%", aspectRatio: 1, borderRadius: 12, marginBottom: 10, backgroundColor: c.cardInner, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 44 }}>🐾</Text>
        </View>
      )}

      <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "700", color: c.text, alignSelf: "stretch", textAlign: "center" }}>{pet.name ?? "—"}</Text>
    </TouchableOpacity>
  );
}
