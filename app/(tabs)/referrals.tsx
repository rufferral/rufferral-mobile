import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Animated, Easing } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";
import { PetCard, PetCardData, CardReferral } from "@/components/PetCard";
import { EventLike } from "@/lib/referralProgress";

type PetEmbed = { id: string; name: string | null; species: string | null; breed: string | null; date_of_birth: string | null; photo_url: string | null; };
type ReferralRow = { id: string; status: string | null; speciality_needed: string | null; created_at: string; pet_id: string | null; pets: PetEmbed | PetEmbed[] | null; };

function petEmbed(r: ReferralRow): PetEmbed | null {
  if (!r.pets) return null;
  return Array.isArray(r.pets) ? (r.pets[0] ?? null) : r.pets;
}

const PAST = ["completed", "declined"];

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

export default function ReferralsScreen() {
  const c = Colors.light;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activePets, setActivePets] = useState<PetCardData[]>([]);
  const [focusTick, setFocusTick] = useState(0);
  useFocusEffect(useCallback(() => { setFocusTick(t => t + 1); }, []));
  const [historyPets, setHistoryPets] = useState<PetCardData[]>([]);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: refData } = await supabase
      .from("referrals")
      .select("id, status, speciality_needed, created_at, pet_id, pets(id, name, species, breed, date_of_birth, photo_url)")
      .ilike("owner_email", user.email ?? "")
      .order("created_at", { ascending: false });
    const allRefs = (refData ?? []) as ReferralRow[];

    const refIds = allRefs.map(r => r.id);
    const eventsByRef: Record<string, EventLike[]> = {};
    const lastUpdateByRef: Record<string, string | null> = {};
    if (refIds.length > 0) {
      const { data: evData } = await supabase
        .from("referral_events")
        .select("referral_id, event_type, created_at")
        .in("referral_id", refIds)
        .order("created_at", { ascending: false });
      for (const ev of (evData ?? []) as { referral_id: string; event_type: string | null; created_at: string | null }[]) {
        (eventsByRef[ev.referral_id] ??= []).push({ event_type: ev.event_type, created_at: ev.created_at });
        if (!(ev.referral_id in lastUpdateByRef)) lastUpdateByRef[ev.referral_id] = ev.created_at;
      }
    }

    const buildGroup = (predicate: (r: ReferralRow) => boolean): PetCardData[] => {
      const map = new Map<string, PetCardData>();
      for (const r of allRefs) {
        if (!predicate(r)) continue;
        const pe = petEmbed(r);
        const pid = pe?.id ?? r.pet_id;
        if (!pid || !pe) continue;
        if (!map.has(pid)) map.set(pid, { id: pid, name: pe.name, species: pe.species, breed: pe.breed, date_of_birth: pe.date_of_birth, photo_url: pe.photo_url, referrals: [] });
        const cardRef: CardReferral = {
          id: r.id, status: r.status, speciality_needed: r.speciality_needed, created_at: r.created_at,
          events: eventsByRef[r.id] ?? [], lastUpdate: lastUpdateByRef[r.id] ?? null,
        };
        map.get(pid)!.referrals!.push(cardRef);
      }
      return Array.from(map.values());
    };

    setActivePets(buildGroup(r => !PAST.includes((r.status ?? "").toLowerCase())));
    setHistoryPets(buildGroup(r => PAST.includes((r.status ?? "").toLowerCase())));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="#ffffff" /></SafeAreaView>;

  const sectionLabel = { fontSize: 13, fontWeight: "700" as const, color: c.subtext, letterSpacing: 0.8, textTransform: "uppercase" as const, marginBottom: 12 };
  const hasAny = activePets.length > 0 || historyPets.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 110 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: c.text, marginBottom: 20 }}>Referrals</Text>

        {!hasAny ? (
          <Text style={{ color: c.subtext, textAlign: "center", marginTop: 40 }}>No referrals yet.</Text>
        ) : (
          <>
            {activePets.length > 0 ? (
              <View style={{ marginBottom: 24 }}>
                <Text style={sectionLabel}>Active ({activePets.reduce((n, p) => n + (p.referrals?.length ?? 0), 0)})</Text>
                {activePets.map((pet, i) => (
                  <FadeInView key={pet.id} delay={i * 110} trigger={focusTick}>
                    <PetCard pet={pet} />
                  </FadeInView>
                ))}
              </View>
            ) : null}
            {historyPets.length > 0 ? (
              <View>
                <Text style={sectionLabel}>History</Text>
                {historyPets.map((pet, i) => (
                  <FadeInView key={pet.id} delay={(activePets.length + i) * 110} trigger={focusTick}>
                    <PetCard pet={pet} />
                  </FadeInView>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
