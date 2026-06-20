import { useState, useCallback, useRef, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, ActivityIndicator, Alert } from "react-native";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";

const c = Colors.light;

type PracticeSuggestion = {
  id: string; name: string; suburb: string | null; state: string | null; postcode: string | null;
  distanceKm?: number;
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function VetConnectModal({
  visible, onClose, userId, connectedPracticeId, onChanged,
}: {
  visible: boolean;
  onClose: () => void;
  userId: string | null;
  connectedPracticeId: string | null;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PracticeSuggestion[]>([]);
  const [nearest, setNearest] = useState<PracticeSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingNearest, setLoadingNearest] = useState(false);
  const [noLocation, setNoLocation] = useState(false);
  const [working, setWorking] = useState(false);
  const [ownerCountry, setOwnerCountry] = useState<string | null>(null);
  const [mode, setMode] = useState<"choose" | "nearest" | "search">("choose");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On open: load owner location + country, compute nearest 5 (country-filtered).
  useEffect(() => {
    if (!visible || !userId) return;
    setQuery(""); setResults([]); setNoLocation(false); setMode("choose");
    let cancelled = false;
    (async () => {
      setLoadingNearest(true);
      const { data: profile } = await supabase
        .from("profiles").select("lat, lng, country").eq("id", userId).maybeSingle();
      const prof = profile as { lat?: number | null; lng?: number | null; country?: string | null } | null;
      if (cancelled) return;
      setOwnerCountry(prof?.country ?? null);
      if (prof?.lat == null || prof?.lng == null) {
        setNoLocation(true); setNearest([]); setLoadingNearest(false); return;
      }
      let pq = supabase.from("practices")
        .select("id, name, suburb, state, postcode, lat, lng")
        .not("lat", "is", null).not("lng", "is", null);
      if (prof.country) pq = pq.eq("country", prof.country);
      const { data: practices } = await pq;
      if (cancelled) return;
      const rows = (practices as (PracticeSuggestion & { lat: number; lng: number })[]) ?? [];
      const withDist = rows
        .map(p => ({ ...p, distanceKm: haversineKm(prof.lat!, prof.lng!, p.lat, p.lng) }))
        .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
        .slice(0, 5);
      setNearest(withDist);
      setLoadingNearest(false);
    })();
    return () => { cancelled = true; };
  }, [visible, userId]);

  const runSearch = useCallback(async (q: string, country: string | null) => {
    if (q.trim().length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    let sq = supabase.from("practices")
      .select("id, name, suburb, state, postcode")
      .ilike("name", `%${q.trim()}%`);
    if (country) sq = sq.eq("country", country);
    const { data } = await sq.order("name", { ascending: true }).limit(50);
    const seen = new Set<string>();
    const unique = ((data as PracticeSuggestion[]) ?? []).filter((p) => {
      const k = p.name.trim().toLowerCase();
      if (seen.has(k)) return false; seen.add(k); return true;
    }).slice(0, 8);
    setResults(unique);
    setSearching(false);
  }, []);

  const onChangeQuery = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runSearch(text, ownerCountry), 250);
  };

  const cleanPostcode = (pc: string | null) => {
    if (pc == null) return "";
    // Postcodes sometimes arrive as numeric (e.g. "3805.0"); strip any trailing decimal.
    const s = String(pc).trim();
    const n = s.replace(/\.0+$/, "");
    return n;
  };

  const locationLine = (p: PracticeSuggestion) =>
    [p.suburb, p.state, cleanPostcode(p.postcode)].filter(Boolean).join(" ");

  const doConnect = async (p: PracticeSuggestion) => {
    if (!userId) return;
    setWorking(true);
    await supabase.from("practice_owner_consents")
      .update({ consent_given: false })
      .eq("owner_id", userId).eq("consent_given", true).neq("practice_id", p.id);
    const { error } = await supabase.from("practice_owner_consents").upsert({
      owner_id: userId, practice_id: p.id, consent_given: true, consent_given_at: new Date().toISOString(),
    }, { onConflict: "owner_id,practice_id" });
    setWorking(false);
    if (error) { Alert.alert("Couldn't connect", error.message); return; }
    onChanged(); onClose();
  };

  const confirmConnect = (p: PracticeSuggestion) => {
    Alert.alert(
      "Connect to this practice?",
      `${p.name} will be able to see your pet's details and medical information. You can disconnect at any time.`,
      [{ text: "Cancel", style: "cancel" }, { text: "Connect", onPress: () => void doConnect(p) }],
    );
  };

  const doDisconnect = async () => {
    if (!userId || !connectedPracticeId) return;
    setWorking(true);
    const { error } = await supabase.from("practice_owner_consents")
      .update({ consent_given: false })
      .eq("owner_id", userId).eq("practice_id", connectedPracticeId);
    setWorking(false);
    if (error) { Alert.alert("Couldn't disconnect", error.message); return; }
    onChanged(); onClose();
  };

  const confirmDisconnect = () => {
    Alert.alert(
      "Disconnect your vet?",
      "This practice will no longer be able to see your pet's details. You can reconnect any time.",
      [{ text: "Cancel", style: "cancel" }, { text: "Disconnect", style: "destructive", onPress: () => void doDisconnect() }],
    );
  };

  const showingSearch = query.trim().length >= 2;
  const renderRow = (p: PracticeSuggestion, showDist: boolean) => (
    <TouchableOpacity key={p.id} disabled={working} onPress={() => confirmConnect(p)}
      style={{ paddingVertical: 14, paddingHorizontal: 16, borderTopWidth: 0.75, borderTopColor: c.border, backgroundColor: p.id === connectedPracticeId ? c.cardInner : "transparent" }}>
      <Text style={{ fontSize: 15, color: c.text, fontWeight: "600" }}>{p.name}</Text>
      {locationLine(p) ? <Text style={{ fontSize: 13, color: c.subtext, marginTop: 2 }}>{locationLine(p)}</Text> : null}
      {showDist && p.distanceKm != null ? <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>{p.distanceKm < 1 ? "<1 km away" : `${Math.round(p.distanceKm)} km away`}</Text> : null}
      {p.id === connectedPracticeId ? <Text style={{ fontSize: 12, color: Colors.brand, marginTop: 2, fontWeight: "700" }}>Currently connected</Text> : null}
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 }}>
        <View style={{ backgroundColor: c.card, borderRadius: 16, borderWidth: 0.75, borderColor: c.border, overflow: "hidden", maxHeight: "80%" }}>
          <View style={{ height: 52, justifyContent: "center", paddingHorizontal: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: c.subtext, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "center" }}>My Vet Clinic</Text>
            {mode !== "choose" ? (
              <TouchableOpacity onPress={() => { setMode("choose"); setQuery(""); setResults([]); }} style={{ position: "absolute", left: 16, top: 0, bottom: 0, justifyContent: "center" }}>
                <Text style={{ color: c.subtext, fontSize: 15 }}>‹ Back</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={onClose} style={{ position: "absolute", right: 16, top: 0, bottom: 0, justifyContent: "center" }}>
              <Text style={{ color: c.subtext, fontSize: 15 }}>Close</Text>
            </TouchableOpacity>
          </View>

          {mode === "choose" ? (
            <View style={{ padding: 16, paddingTop: 8 }}>
              <TouchableOpacity onPress={() => setMode("nearest")}
                style={{ backgroundColor: c.cardInner, borderRadius: 12, borderWidth: 0.75, borderColor: c.border, padding: 16, marginBottom: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: c.text }}>Find a clinic near me</Text>
                <Text style={{ fontSize: 13, color: c.subtext, marginTop: 3 }}>See clinics closest to your saved location</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMode("search")}
                style={{ backgroundColor: c.cardInner, borderRadius: 12, borderWidth: 0.75, borderColor: c.border, padding: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: c.text }}>Search by name</Text>
                <Text style={{ fontSize: 13, color: c.subtext, marginTop: 3 }}>Start typing to find a clinic by name</Text>
              </TouchableOpacity>
            </View>
          ) : mode === "search" ? (
            <>
              <TextInput
                value={query}
                onChangeText={onChangeQuery}
                placeholder="Start typing a clinic name…"
                placeholderTextColor={c.muted}
                autoFocus
                style={{ backgroundColor: c.cardInner, borderRadius: 8, borderWidth: 0.75, borderColor: c.border, marginHorizontal: 16, marginTop: 8, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 10, color: c.text, fontSize: 15 }}
              />
              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 360 }}>
                {!showingSearch ? (
                  <Text style={{ color: c.muted, fontSize: 14, paddingHorizontal: 16, paddingVertical: 12 }}>Type at least 2 letters to search.</Text>
                ) : searching ? (
                  <View style={{ padding: 20, alignItems: "center" }}><ActivityIndicator color={Colors.brand} /></View>
                ) : results.length === 0 ? (
                  <Text style={{ color: c.muted, fontSize: 14, paddingHorizontal: 16, paddingVertical: 12 }}>No clinics found.</Text>
                ) : results.map((p) => renderRow(p, false))}
              </ScrollView>
            </>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 400 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: c.subtext, textTransform: "uppercase", letterSpacing: 0.6, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>Nearest to me</Text>
              {loadingNearest ? (
                <View style={{ padding: 20, alignItems: "center" }}><ActivityIndicator color={Colors.brand} /></View>
              ) : noLocation ? (
                <Text style={{ color: c.muted, fontSize: 14, paddingHorizontal: 16, paddingVertical: 12 }}>Add your suburb and postcode in Account to see nearby clinics, or go back and search by name.</Text>
              ) : nearest.length === 0 ? (
                <Text style={{ color: c.muted, fontSize: 14, paddingHorizontal: 16, paddingVertical: 12 }}>No nearby clinics found. Go back and try searching by name.</Text>
              ) : nearest.map((p) => renderRow(p, true))}
            </ScrollView>
          )}

          {connectedPracticeId ? (
            <TouchableOpacity onPress={confirmDisconnect} disabled={working}
              style={{ margin: 16, marginTop: 12, paddingVertical: 12, borderRadius: 999, borderWidth: 0.75, borderColor: c.border, alignItems: "center" }}>
              <Text style={{ color: c.subtext, fontSize: 14, fontWeight: "600" }}>Disconnect current vet</Text>
            </TouchableOpacity>
          ) : null}

          {working ? (
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.2)", justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator color={Colors.brand} />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
