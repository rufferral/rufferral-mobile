import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, RefreshControl, useColorScheme, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";

type PetRow = { id: string; name: string | null; species: string | null; breed: string | null; date_of_birth: string | null; photo_url: string | null; };

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

export default function PetsScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const c = dark ? Colors.dark : Colors.light;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pets, setPets] = useState<PetRow[]>([]);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("pets").select("id, name, species, breed, date_of_birth, photo_url").eq("owner_id", user.id).order("created_at", { ascending: true });
    setPets((data ?? []) as PetRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: dark ? Colors.dark.bg : Colors.light.bg, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={Colors.brand} /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand} />}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: c.text, marginBottom: 20 }}>My Pets</Text>
        {pets.length === 0 ? (
          <Text style={{ color: c.subtext, textAlign: "center", marginTop: 40 }}>No pets yet. Your pets appear automatically when your vet submits a referral.</Text>
        ) : pets.map(pet => (
          <TouchableOpacity key={pet.id} onPress={() => router.push(`/pet/${pet.id}`)} style={{ backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 14 }}>
            {pet.photo_url ? <Image source={{ uri: pet.photo_url }} style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: c.border }} /> : <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.cardInner, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 28 }}>🐾</Text></View>}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: c.text }}>{pet.name ?? "—"}</Text>
              <Text style={{ fontSize: 13, color: c.subtext, marginTop: 2 }}>{[pet.species, pet.breed].filter(Boolean).join(" · ") || "—"}</Text>
              {pet.date_of_birth && <Text style={{ fontSize: 13, color: c.subtext, marginTop: 1 }}>Age: {calcAgeShort(pet.date_of_birth)}</Text>}
            </View>
            <Text style={{ color: Colors.brand, fontWeight: "600", fontSize: 18 }}>→</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
