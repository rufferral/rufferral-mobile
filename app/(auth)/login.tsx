import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image } from "react-native";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) { setError("Please enter your email and password."); return; }
    setLoading(true); setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setLoading(false);
    if (authError) setError(authError.message);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: Colors.brand }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: "center", marginBottom: 48 }}>
          <Image source={require("../../assets/logo-white.png")} style={{ width: 180, height: 54 }} resizeMode="contain" />
        </View>
        <View style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.18)", padding: 24 }}>
          <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700", textAlign: "center", marginBottom: 4 }}>Welcome back</Text>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, textAlign: "center", marginBottom: 28 }}>Sign in to track your pet's referrals</Text>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Email</Text>
          <TextInput value={email} onChangeText={v => { setEmail(v); setError(null); }} placeholder="you@example.com" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="email-address" autoCapitalize="none" style={{ borderBottomWidth: 1.5, borderBottomColor: "rgba(255,255,255,0.25)", color: "#fff", fontSize: 16, paddingVertical: 10, marginBottom: 20 }} />
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Password</Text>
          <TextInput value={password} onChangeText={v => { setPassword(v); setError(null); }} placeholder="••••••••" placeholderTextColor="rgba(255,255,255,0.3)" secureTextEntry style={{ borderBottomWidth: 1.5, borderBottomColor: "rgba(255,255,255,0.25)", color: "#fff", fontSize: 16, paddingVertical: 10, marginBottom: 28 }} />
          {error && <Text style={{ color: "#ff6b6b", fontSize: 13, textAlign: "center", marginBottom: 16 }}>{error}</Text>}
          <TouchableOpacity onPress={() => void handleLogin()} disabled={loading} style={{ backgroundColor: "#fff", borderRadius: 999, paddingVertical: 14, alignItems: "center", opacity: loading ? 0.6 : 1 }}>
            {loading ? <ActivityIndicator color={Colors.brand} /> : <Text style={{ color: Colors.brand, fontSize: 15, fontWeight: "700" }}>Sign in →</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
