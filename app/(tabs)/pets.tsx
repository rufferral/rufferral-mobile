import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";
import { PetGridTile, PetGridData } from "@/components/PetGridTile";

type PetRow = { id: string; name: string | null; species: string | null; breed: string | null; date_of_birth: string | null; photo_url: string | null; };
type ReferralRow = { id: string; status: string | null; pet_id: string | null; };

const ACTIVE_EXCLUDE = ["completed", "declined"];

export default function PetsScreen() {
  const c = Colors.light;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pets, setPets] = useState<PetGridData[]>([]);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: petData } = await supabase.from("pets").select("id, name, species, breed, date_of_birth, photo_url").eq("owner_id", user.id).order("created_at", { ascending: true });
    const petRows = (petData ?? []) as PetRow[];

    const { data: refData } = await supabase.from("referrals").select("id, status, pet_id").ilike("owner_email", user.email ?? "");
    const allRefs = (refData ?? []) as ReferralRow[];

    const activeByPet: Record<string, number> = {};
    const completedByPet: Record<string, number> = {};
    for (const r of allRefs) {
      if (!r.pet_id) continue;
      const s = (r.status ?? "").toLowerCase();
      if (s === "completed") completedByPet[r.pet_id] = (completedByPet[r.pet_id] ?? 0) + 1;
      else if (!ACTIVE_EXCLUDE.includes(s)) activeByPet[r.pet_id] = (activeByPet[r.pet_id] ?? 0) + 1;
    }

    setPets(petRows.map(p => ({ ...p, activeCount: activeByPet[p.id] ?? 0, completedCount: completedByPet[p.id] ?? 0 })));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="#ffffff" /></SafeAreaView>;

  // Build rows of 2 for the grid.
  const rows: PetGridData[][] = [];
  for (let i = 0; i < pets.length; i += 2) rows.push(pets.slice(i, i + 2));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: c.text, marginBottom: 20 }}>My Pets</Text>
        {pets.length === 0 ? (
          <Text style={{ color: c.subtext, textAlign: "center", marginTop: 40 }}>No pets yet. Your pets appear automatically when your vet submits a referral.</Text>
        ) : (
          <View style={{ gap: 14 }}>
            {rows.map((row, idx) => (
              <View key={idx} style={{ flexDirection: "row", gap: 14 }}>
                {row.map(pet => <PetGridTile key={pet.id} pet={pet} />)}
                {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
