import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Animated, Easing } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";
import { PetGridTile, PetGridData } from "@/components/PetGridTile";
import { profileCompletion } from "@/lib/profileCompletion";

type PetRow = { id: string; name: string | null; species: string | null; breed: string | null; date_of_birth: string | null; photo_url: string | null; };
type ReferralRow = { id: string; status: string | null; pet_id: string | null; };

const ACTIVE_EXCLUDE = ["completed", "declined"];

// Fades + slides a child in on mount and whenever `trigger` changes (e.g. screen re-focus).
function FadeInView({ delay = 0, trigger, style, children }: { delay?: number; trigger?: number; style?: any; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(12);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 450, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 450, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [trigger]);
  return <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

export default function PetsScreen() {
  const c = Colors.light;
  const router = useRouter();
  const [focusTick, setFocusTick] = useState(0);
  useFocusEffect(useCallback(() => { setFocusTick(t => t + 1); }, []));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pets, setPets] = useState<PetGridData[]>([]);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: petData } = await supabase.from("pets").select("*").eq("owner_id", user.id).order("created_at", { ascending: true });
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

    setPets(petRows.map(p => ({ ...p, activeCount: activeByPet[p.id] ?? 0, completedCount: completedByPet[p.id] ?? 0, completion: profileCompletion(p) })));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="#ffffff" /></SafeAreaView>;

  // Build a flat list of grid items: pet tiles plus a trailing "Add a pet" tile.
  type GridItem = { kind: "pet"; pet: PetGridData } | { kind: "add" };
  const items: GridItem[] = [...pets.map(p => ({ kind: "pet" as const, pet: p })), { kind: "add" as const }];
  const rows: GridItem[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));

  const AddTile = () => (
    <TouchableOpacity onPress={() => router.push("/pet/new")} activeOpacity={0.8}
      style={{ flex: 1, minHeight: 180, borderRadius: 16, borderWidth: 1.5, borderColor: c.border, borderStyle: "dashed", backgroundColor: c.card, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 34, color: c.subtext, fontWeight: "300", marginBottom: 4 }}>+</Text>
      <Text style={{ fontSize: 14, color: c.subtext, fontWeight: "600" }}>Add a pet</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 110 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: c.text, marginBottom: 20 }}>My Pets</Text>
        <View style={{ gap: 14 }}>
          {rows.map((row, idx) => (
            <View key={idx} style={{ flexDirection: "row", gap: 14 }}>
              {row.map((item, i) => {
                const seq = idx * 2 + i; // left-to-right, top-to-bottom order
                return (
                  <FadeInView key={item.kind === "pet" ? item.pet.id : "add-tile"} delay={seq * 120} trigger={focusTick} style={{ flex: 1 }}>
                    {item.kind === "pet" ? <PetGridTile pet={item.pet} /> : <AddTile />}
                  </FadeInView>
                );
              })}
              {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
