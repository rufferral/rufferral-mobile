import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Share, Animated, Easing } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";
import { SuburbAutocomplete, Suburb } from "@/components/SuburbAutocomplete";

const c = Colors.light;

type ProfileRow = {
  full_name: string | null; email: string | null; phone: string | null;
  suburb: string | null; state: string | null; postcode: string | null; country: string | null;
};

const fieldLabel = { fontSize: 11, fontWeight: "700" as const, color: c.subtext, textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 3 };
const fieldValue = { fontSize: 15, color: c.text };
const cardStyle = { backgroundColor: c.card, borderRadius: 12, borderWidth: 0.75, borderColor: c.border, padding: 16, marginBottom: 16 } as const;
const sectionLabel = { fontSize: 13, fontWeight: "700" as const, color: c.subtext, textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 12 };
const inputBox = { backgroundColor: c.cardInner, borderRadius: 8, borderWidth: 0.75, borderColor: c.border, paddingHorizontal: 12, paddingVertical: 10, color: c.text, fontSize: 15 } as const;
const readonlyBox = { backgroundColor: c.bg, borderRadius: 8, borderWidth: 0.75, borderColor: c.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 } as const;

// Defined at module level (NOT inside the screen) so it isn't recreated each render,
// which would dismiss the keyboard on every keystroke.
function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={fieldLabel}>{label}</Text>
      <Text style={fieldValue}>{value || "—"}</Text>
    </View>
  );
}

function EditTextField({ label, value, onChange, placeholder, keyboardType, error }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  keyboardType?: "default" | "numeric" | "phone-pad"; error?: string;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={fieldLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={c.muted} keyboardType={keyboardType ?? "default"} style={inputBox} />
      {error ? <Text style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{error}</Text> : null}
    </View>
  );
}

function AutofilledField({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={fieldLabel}>{label}</Text>
      <View style={readonlyBox}><Text style={{ color: value ? c.text : c.muted, fontSize: 15 }}>{value || "Auto-filled from suburb"}</Text></View>
    </View>
  );
}

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

export default function AccountScreen() {
  const [loading, setLoading] = useState(true);
  const [focusTick, setFocusTick] = useState(0);
  useFocusEffect(useCallback(() => { setFocusTick(t => t + 1); }, []));
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fFullName, setFFullName] = useState("");
  const [fPhone, setFPhone] = useState("");
  const [fSuburb, setFSuburb] = useState("");
  const [fPostcode, setFPostcode] = useState("");
  const [fState, setFState] = useState("");
  const [fCountry, setFCountry] = useState("");
  const [nameError, setNameError] = useState("");

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("profiles").select("full_name, email, phone, suburb, state, postcode, country").eq("id", user.id).maybeSingle();
    setProfile(data as ProfileRow | null);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const startEdit = () => {
    setFFullName(profile?.full_name ?? "");
    setFPhone(profile?.phone ?? "");
    setFSuburb(profile?.suburb ?? "");
    setFPostcode(profile?.postcode ?? "");
    setFState(profile?.state ?? "");
    setFCountry(profile?.country ?? "Australia");
    setNameError("");
    setEditing(true);
  };
  const cancelEdit = () => { setEditing(false); setNameError(""); };

  const onSuburbSelect = (s: Suburb) => {
    setFSuburb(s.name);
    setFPostcode(s.postcode);
    setFState(s.state);
    if (s.country) setFCountry(s.country);
  };

  const savePersonal = async () => {
    const trimmedName = fFullName.trim();
    if (!trimmedName) { setNameError("This field is required."); return; }
    setNameError("");
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const fields = {
      full_name: trimmedName,
      phone: fPhone.trim() || null,
      suburb: fSuburb.trim() || null,
      postcode: fPostcode.trim() || null,
      state: fState.trim() || null,
      country: fCountry.trim() || null,
    };
    const { error } = await supabase.from("profiles").update(fields).eq("id", user.id);
    if (error) { setSaving(false); Alert.alert("Couldn't save", error.message); return; }

    setProfile(prev => prev ? { ...prev, ...fields } as ProfileRow : prev);

    // Geocode the new address so nearby-clinic suggestions work (server-side Edge Function).
    if (fields.suburb || fields.postcode) {
      try {
        await supabase.functions.invoke("geocode-owner", {
          body: { suburb: fields.suburb, state: fields.state, postcode: fields.postcode, country: fields.country },
        });
      } catch {
        // best-effort; profile still saved
      }
    }

    setSaving(false);
    setEditing(false);
  };

  const handleShareApp = async () => {
    try {
      await Share.share({
        message: "I'm using Rufferral to stay updated on my pet's vet referrals and care. Check it out: https://rufferral.com",
      });
    } catch {
      // user dismissed or share failed — no action needed
    }
  };

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

  const TERRITORIES = ["ACT", "NT", "JBT", "Australian Capital Territory", "Northern Territory"];
  const stateSrc = (editing ? fState : profile?.state) ?? "";
  const stateLabel = stateSrc && TERRITORIES.includes(stateSrc.trim()) ? "Territory" : "State";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 110 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: c.text, marginBottom: 20 }}>Account</Text>

        {/* Personal Details */}
        <FadeInView delay={0} trigger={focusTick}>
        <View style={[cardStyle, { marginBottom: 10 }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={[sectionLabel, { marginBottom: 0 }]}>Personal Details</Text>
            {editing ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity onPress={cancelEdit} disabled={saving} style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 0.75, borderColor: c.border }}>
                  <Text style={{ color: c.subtext, fontSize: 13, fontWeight: "600" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => void savePersonal()} disabled={saving} style={{ paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999, backgroundColor: Colors.brand }}>
                  <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>{saving ? "Saving…" : "Save"}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={startEdit} style={{ paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999, borderWidth: 0.75, borderColor: c.border }}>
                <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          {editing ? (
            <>
              <EditTextField label="Full name" value={fFullName} onChange={setFFullName} placeholder="Your name" error={nameError} />
              <ReadField label="Email" value={profile?.email ?? ""} />
              <EditTextField label="Phone" value={fPhone} onChange={setFPhone} placeholder="Phone number" keyboardType="phone-pad" />
              <SuburbAutocomplete
                value={fSuburb}
                state={fState || null}
                country={fCountry || "Australia"}
                onValueChange={setFSuburb}
                onSelect={onSuburbSelect}
                labelStyle={fieldLabel}
                inputStyle={inputBox}
              />
              <View style={{ flexDirection: "row", gap: 16 }}>
                <View style={{ flex: 1 }}><AutofilledField label="Postcode" value={fPostcode} /></View>
                <View style={{ flex: 1 }}><AutofilledField label={stateLabel} value={fState} /></View>
              </View>
              <ReadField label="Country" value={fCountry} />
              <Text style={{ fontSize: 12, color: c.muted, marginTop: 2, fontStyle: "italic" }}>Pick your suburb to auto-fill postcode and state. This helps us suggest nearby vet practices.</Text>
            </>
          ) : (
            <>
              <ReadField label="Full name" value={profile?.full_name ?? ""} />
              <ReadField label="Email" value={profile?.email ?? ""} />
              <ReadField label="Phone" value={profile?.phone ?? ""} />
              <View style={{ flexDirection: "row", gap: 16 }}>
                <View style={{ flex: 1 }}>
                  <ReadField label="Suburb / City" value={profile?.suburb ?? ""} />
                  <ReadField label="Postcode" value={profile?.postcode ?? ""} />
                </View>
                <View style={{ flex: 1 }}>
                  <ReadField label={stateLabel} value={profile?.state ?? ""} />
                  <ReadField label="Country" value={profile?.country ?? ""} />
                </View>
              </View>
            </>
          )}
        </View>
        </FadeInView>

        {/* Account actions — 2-column buttons */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
          <FadeInView delay={150} trigger={focusTick} style={{ flex: 1 }}>
            <TouchableOpacity onPress={handleChangePassword} style={{ backgroundColor: c.card, borderRadius: 12, borderWidth: 0.75, borderColor: c.border, paddingVertical: 16, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: c.text }}>Change password</Text>
            </TouchableOpacity>
          </FadeInView>
          <FadeInView delay={250} trigger={focusTick} style={{ flex: 1 }}>
            <TouchableOpacity onPress={handleSignOut} style={{ backgroundColor: c.card, borderRadius: 12, borderWidth: 0.75, borderColor: c.border, paddingVertical: 16, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#ef4444" }}>Log out</Text>
            </TouchableOpacity>
          </FadeInView>
        </View>

        {/* Share Rufferral */}
        <FadeInView delay={400} trigger={focusTick}>
        <View style={cardStyle}>
          <Text style={sectionLabel}>Paw it forward</Text>
          <Text style={{ fontSize: 14, color: c.subtext, marginBottom: 14, lineHeight: 20 }}>
            Know someone who loves their pet as much as you do? Sharing Rufferral lets them stay in the loop with their pet's care.
          </Text>
          <TouchableOpacity onPress={handleShareApp} style={{ backgroundColor: "#10b981", borderRadius: 999, paddingVertical: 14, alignItems: "center" }}>
            <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "700" }}>Share Rufferral</Text>
          </TouchableOpacity>
        </View>
        </FadeInView>

      </ScrollView>
    </SafeAreaView>
  );
}
