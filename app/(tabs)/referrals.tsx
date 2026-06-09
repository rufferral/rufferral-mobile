import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, RefreshControl, useColorScheme, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";
import { StatusBadge } from "@/components/StatusBadge";

type PetEmbed = { id: string; name: string | null; photo_url: string | null; };
type ReferralRow = { id: string; status: string | null; speciality_needed: string | null; created_at: string; pets: PetEmbed | PetEmbed[] | null; };

function petFromReferral(r: ReferralRow): PetEmbed | null {
  if (!r.pets) return null;
  return Array.isArray(r.pets) ? (r.pets[0] ?? null) : r.pets;
}

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }); } catch { return "—"; }
}

export default function ReferralsScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const c = dark ? Colors.dark : Colors.light;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("referrals").select("id, status, speciality_needed, created_at, pets(id, name, photo_url)").ilike("owner_email", user.email ?? "").order("created_at", { ascending: false });
    setReferrals((data ?? []) as ReferralRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const active = referrals.filter(r => !["completed", "declined"].includes((r.status ?? "").toLowerCase()));
  const past = referrals.filter(r => ["completed", "declined"].includes((r.status ?? "").toLowerCase()));

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={Colors.brand} /></SafeAreaView>;

  const ReferralCard = ({ row }: { row: ReferralRow }) => {
    const pet = petFromReferral(row);
    return (
      <TouchableOpacity onPress={() => router.push(`/referral/${row.id}`)} style={{ backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12 }}>
        {pet?.photo_url ? <Image source={{ uri: pet.photo_url }} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.border }} /> : <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.cardInner, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 20 }}>🐾</Text></View>}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: c.text }}>{pet?.name ?? "—"} — {row.speciality_needed ?? "Specialist"}</Text>
          <Text style={{ fontSize: 12, color: c.subtext, marginTop: 2 }}>{formatDate(row.created_at)}</Text>
        </View>
        <StatusBadge status={row.status} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand} />}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: c.text, marginBottom: 20 }}>Referrals</Text>
        {referrals.length === 0 ? (
          <Text style={{ color: c.subtext, textAlign: "center", marginTop: 40 }}>No referrals yet.</Text>
        ) : (
          <>
            {active.length > 0 && <View style={{ marginBottom: 24 }}><Text style={{ fontSize: 13, fontWeight: "700", color: c.subtext, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12 }}>Active ({active.length})</Text>{active.map(r => <ReferralCard key={r.id} row={r} />)}</View>}
            {past.length > 0 && <View><Text style={{ fontSize: 13, fontWeight: "700", color: c.subtext, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12 }}>History</Text>{past.map(r => <ReferralCard key={r.id} row={r} />)}</View>}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
