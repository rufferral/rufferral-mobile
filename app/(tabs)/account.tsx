import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, useColorScheme, ActivityIndicator, Switch, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";

type ProfileRow = { full_name: string | null; email: string | null; phone: string | null; suburb: string | null; state: string | null; dark_mode: boolean | null; };

export default function AccountScreen() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const c = dark ? Colors.dark : Colors.light;
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data } = await supabase.from("profiles").select("full_name, email, phone, suburb, state, dark_mode").eq("id", user.id).maybeSingle();
    const p = data as ProfileRow | null;
    setProfile(p);
    setDarkMode(p?.dark_mode === true);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggleDarkMode = async (value: boolean) => {
    setDarkMode(value);
    if (userId) await supabase.from("profiles").update({ dark_mode: value }).eq("id", userId);
  };

  const handleSignOut = () => {
    Alert.alert("Sign out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: async () => { await supabase.auth.signOut(); } },
    ]);
  };

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={Colors.brand} /></SafeAreaView>;

  const Row = ({ label, value }: { label: string; value: string }) => (
    <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: c.subtext, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>{label}</Text>
      <Text style={{ fontSize: 15, color: c.text }}>{value || "—"}</Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: c.text, marginBottom: 20 }}>Account</Text>
        <View style={{ backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: c.subtext, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Personal Details</Text>
          <Row label="Full name" value={profile?.full_name ?? ""} />
          <Row label="Email" value={profile?.email ?? ""} />
          <Row label="Phone" value={profile?.phone ?? ""} />
          <Row label="Location" value={[profile?.suburb, profile?.state].filter(Boolean).join(", ")} />
        </View>
        <View style={{ backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: c.subtext, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>Appearance</Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Text style={{ fontSize: 15, fontWeight: "600", color: c.text }}>Dark mode</Text>
              <Text style={{ fontSize: 13, color: c.subtext, marginTop: 2 }}>Switch interface theme</Text>
            </View>
            <Switch value={darkMode} onValueChange={v => void toggleDarkMode(v)} trackColor={{ false: c.border, true: Colors.brand }} thumbColor="#fff" />
          </View>
        </View>
        <TouchableOpacity onPress={handleSignOut} style={{ backgroundColor: dark ? "#2d0a0a" : "#fef2f2", borderRadius: 12, borderWidth: 1, borderColor: dark ? "#7f1d1d" : "#fecaca", padding: 16, alignItems: "center" }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: "#ef4444" }}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
