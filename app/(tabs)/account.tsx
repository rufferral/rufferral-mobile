import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";

type ProfileRow = {
  full_name: string | null; email: string | null; phone: string | null;
  suburb: string | null; state: string | null; postcode: string | null; country: string | null;
};

export default function AccountScreen() {
  const c = Colors.light; // single green theme
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("profiles").select("full_name, email, phone, suburb, state, postcode, country").eq("id", user.id).maybeSingle();
    setProfile(data as ProfileRow | null);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleSignOut = () => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: async () => { await supabase.auth.signOut(); } },
    ]);
  };

  const handleChangePassword = () => {
    const email = profile?.email;
    if (!email) { Alert.alert("Change password", "No email on file for this account."); return; }
    Alert.alert("Change password", `We'll send a password reset link to ${email}.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Send link", onPress: async () => {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        Alert.alert(error ? "Something went wrong" : "Check your email", error ? error.message : "A password reset link is on its way.");
      } },
    ]);
  };

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="#ffffff" /></SafeAreaView>;

  const fieldLabel = { fontSize: 11, fontWeight: "700" as const, color: c.subtext, textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 3 };
  const fieldValue = { fontSize: 15, color: c.text };
  const cardStyle = { backgroundColor: c.card, borderRadius: 12, borderWidth: 0.75, borderColor: c.border, padding: 16, marginBottom: 16 } as const;
  const sectionLabel = { fontSize: 13, fontWeight: "700" as const, color: c.subtext, textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 12 };

  const Field = ({ label, value }: { label: string; value: string }) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={fieldLabel}>{label}</Text>
      <Text style={fieldValue}>{value || "—"}</Text>
    </View>
  );

  // State vs Territory label — Australian territories
  const TERRITORIES = ["ACT", "NT", "JBT", "Australian Capital Territory", "Northern Territory"];
  const stateLabel = profile?.state && TERRITORIES.includes(profile.state.trim()) ? "Territory" : "State";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: c.text, marginBottom: 20 }}>Account</Text>

        {/* Personal Details */}
        <View style={cardStyle}>
          <Text style={sectionLabel}>Personal Details</Text>
          <Field label="Full name" value={profile?.full_name ?? ""} />
          <Field label="Email" value={profile?.email ?? ""} />
          <Field label="Phone" value={profile?.phone ?? ""} />
          <View style={{ flexDirection: "row", gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Field label="Suburb / City" value={profile?.suburb ?? ""} />
              <Field label="Postcode" value={profile?.postcode ?? ""} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={stateLabel} value={profile?.state ?? ""} />
              <Field label="Country" value={profile?.country ?? ""} />
            </View>
          </View>
        </View>

        {/* Security */}
        <View style={cardStyle}>
          <Text style={sectionLabel}>Security</Text>
          <TouchableOpacity onPress={handleChangePassword} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 0.75, borderBottomColor: c.border }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: c.text }}>Change password</Text>
            <Text style={{ fontSize: 16, color: c.subtext }}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSignOut} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#ef4444" }}>Log out</Text>
            <Text style={{ fontSize: 16, color: c.subtext }}>›</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
