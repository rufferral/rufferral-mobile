import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, RefreshControl, useColorScheme, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";
import { StatusBadge } from "@/components/StatusBadge";
import { registerForPushNotifications } from "@/lib/notifications";
import { useAppReady } from "@/context/AppReadyContext";

type PetEmbed = { id: string; name: string | null; species: string | null; breed: string | null; photo_url: string | null; };
type ReferralRow = { id: string; status: string | null; speciality_needed: string | null; created_at: string; pets: PetEmbed | PetEmbed[] | null; };

function petFromReferral(r: ReferralRow): PetEmbed | null {
  if (!r.pets) return null;
  return Array.isArray(r.pets) ? (r.pets[0] ?? null) : r.pets;
}

export default function HomeScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const c = dark ? Colors.dark : Colors.light;
  const { setDashboardReady } = useAppReady();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();
    const p = profile as { full_name?: string | null; email?: string | null } | null;
    const name = p?.full_name?.trim() ?? p?.email?.trim() ?? "";
    setFirstName(name.split(" ")[0] ?? "there");
    const { data: refData } = await supabase.from("referrals").select("id, status, speciality_needed, created_at, pets(id, name, species, breed, photo_url)").ilike("owner_email", user.email ?? "").order("created_at", { ascending: false }).limit(5);
    setReferrals((refData ?? []) as ReferralRow[]);
    await registerForPushNotifications(user.id);
    setLoading(false);
    setDashboardReady(true);
  }, []);

  useEffect(() => { void load(); }, [load]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);
  const active = referrals.filter(r => !["completed", "declined"].includes((r.status ?? "").toLowerCase()));

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={Colors.brand} /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand} />}>
        <Text style={{ fontSize: 24, fontWeight: "700", color: c.text, marginBottom: 4 }}>Welcome back, {firstName} 👋</Text>
        <Text style={{ fontSize: 14, color: c.subtext, marginBottom: 24 }}>{active.length > 0 ? `${active.length} active referral${active.length > 1 ? "s" : ""}` : "No active referrals"}</Text>
        {active.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: c.subtext, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12 }}>Active Referrals</Text>
            {active.map(ref => {
              const pet = petFromReferral(ref);
              return (
                <TouchableOpacity key={ref.id} onPress={() => router.push(`/referral/${ref.id}`)} style={{ backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12 }}>
                  {pet?.photo_url ? <Image source={{ uri: pet.photo_url }} style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: c.border }} /> : <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.cardInner, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 22 }}>🐾</Text></View>}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: c.text }}>{pet?.name ?? "—"}</Text>
                    <Text style={{ fontSize: 13, color: c.subtext, marginTop: 2 }}>{ref.speciality_needed ?? "Specialist"} referral</Text>
                  </View>
                  <StatusBadge status={ref.status} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        <View style={{ gap: 10 }}>
          <TouchableOpacity onPress={() => router.push("/(tabs)/pets")} style={{ backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: c.text }}>🐾  My Pets</Text>
            <Text style={{ color: c.subtext }}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/(tabs)/referrals")} style={{ backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: c.text }}>📋  All Referrals</Text>
            <Text style={{ color: c.subtext }}>→</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
