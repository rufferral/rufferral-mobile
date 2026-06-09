#!/bin/bash
# Run this from inside your rufferral-mobile folder

# ── package.json ─────────────────────────────────────────────────────────────
cat > package.json << 'EOF'
{
  "name": "rufferral-mobile",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "build:ios": "eas build --platform ios",
    "build:android": "eas build --platform android"
  },
  "dependencies": {
    "@expo/vector-icons": "^14.0.0",
    "@react-native-async-storage/async-storage": "1.23.1",
    "@supabase/supabase-js": "^2.39.0",
    "expo": "~51.0.0",
    "expo-constants": "~16.0.0",
    "expo-font": "~12.0.0",
    "expo-image-picker": "~15.0.0",
    "expo-linking": "~6.3.0",
    "expo-notifications": "~0.28.0",
    "expo-router": "~3.5.0",
    "expo-secure-store": "~13.0.0",
    "expo-splash-screen": "~0.27.0",
    "expo-status-bar": "~1.12.0",
    "nativewind": "^4.0.1",
    "react": "18.2.0",
    "react-native": "0.74.1",
    "react-native-safe-area-context": "4.10.1",
    "react-native-screens": "3.31.1",
    "react-native-url-polyfill": "^2.0.0"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@types/react": "~18.2.0",
    "tailwindcss": "^3.4.0",
    "typescript": "~5.3.0"
  }
}
EOF

# ── app.json ──────────────────────────────────────────────────────────────────
cat > app.json << 'EOF'
{
  "expo": {
    "name": "Rufferral",
    "slug": "rufferral",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "rufferral",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0e6e56"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.rufferral.app",
      "buildNumber": "1",
      "infoPlist": {
        "NSPhotoLibraryUsageDescription": "Used to upload your pet's profile photo.",
        "NSCameraUsageDescription": "Used to take your pet's profile photo."
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0e6e56"
      },
      "package": "com.rufferral.app",
      "versionCode": 1
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      ["expo-notifications", { "icon": "./assets/notification-icon.png", "color": "#0e6e56" }],
      ["expo-image-picker", { "photosPermission": "Used to upload your pet's profile photo." }]
    ],
    "experiments": { "typedRoutes": true }
  }
}
EOF

# ── babel.config.js ───────────────────────────────────────────────────────────
cat > babel.config.js << 'EOF'
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }]],
    plugins: ["nativewind/babel"],
  };
};
EOF

# ── tailwind.config.js ────────────────────────────────────────────────────────
cat > tailwind.config.js << 'EOF'
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#0e6e56", dark: "#0a5a45", light: "#e1f5ee" },
      },
    },
  },
  plugins: [],
};
EOF

# ── tsconfig.json ─────────────────────────────────────────────────────────────
cat > tsconfig.json << 'EOF'
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": { "@/*": ["./*"] }
  }
}
EOF

# ── eas.json ──────────────────────────────────────────────────────────────────
cat > eas.json << 'EOF'
{
  "cli": { "version": ">= 10.0.0" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal", "ios": { "simulator": true } },
    "preview": { "distribution": "internal" },
    "production": { "autoIncrement": true }
  }
}
EOF

# ── global.css ────────────────────────────────────────────────────────────────
cat > global.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;
EOF

# ── .env ──────────────────────────────────────────────────────────────────────
cat > .env << 'EOF'
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EOF

# ── constants/colors.ts ───────────────────────────────────────────────────────
cat > constants/colors.ts << 'EOF'
export const Colors = {
  brand: "#0e6e56",
  status: {
    sent:       { bg: "#f59e0b", text: "#ffffff" },
    accepted:   { bg: "#3b82f6", text: "#ffffff" },
    seen:       { bg: "#3b82f6", text: "#ffffff" },
    treatment:  { bg: "#8b5cf6", text: "#ffffff" },
    consulting: { bg: "#8b5cf6", text: "#ffffff" },
    completed:  { bg: "#10b981", text: "#ffffff" },
    declined:   { bg: "#ef4444", text: "#ffffff" },
    default:    { bg: "#94a3b8", text: "#ffffff" },
  },
  light: {
    bg: "#e8edf1", card: "#ffffff", cardInner: "#f8fafb",
    border: "#e2e8f0", text: "#1e293b", subtext: "#64748b", muted: "#94a3b8",
  },
  dark: {
    bg: "#000000", card: "#1c1c1e", cardInner: "#000000",
    border: "#38383a", text: "#ffffff", subtext: "#8e8e93", muted: "#636366",
  },
} as const;
EOF

# ── lib/supabase.ts ───────────────────────────────────────────────────────────
cat > lib/supabase.ts << 'EOF'
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
EOF

# ── lib/notifications.ts ──────────────────────────────────────────────────────
cat > lib/notifications.ts << 'EOF'
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "./supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("referral-updates", {
      name: "Referral Updates",
      importance: Notifications.AndroidImportance.MAX,
      lightColor: "#0e6e56",
    });
  }
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  await supabase.from("profiles").update({ push_token: token }).eq("id", userId);
  return token;
}
EOF

# ── components/StatusBadge.tsx ────────────────────────────────────────────────
cat > components/StatusBadge.tsx << 'EOF'
import { View, Text } from "react-native";
import { Colors } from "@/constants/colors";

type Props = { status: string | null | undefined };

function getStatusColour(status: string | null | undefined) {
  const s = (status ?? "").trim().toLowerCase();
  switch (s) {
    case "sent":                         return Colors.status.sent;
    case "accepted": case "seen":        return Colors.status.accepted;
    case "consulting": case "treatment": return Colors.status.treatment;
    case "completed":                    return Colors.status.completed;
    case "declined":                     return Colors.status.declined;
    default:                             return Colors.status.default;
  }
}

function getStatusLabel(status: string | null | undefined): string {
  const s = (status ?? "").trim().toLowerCase();
  if (s === "sent") return "Received";
  if (s === "seen") return "Accepted";
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function StatusBadge({ status }: Props) {
  const { bg, text } = getStatusColour(status);
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: text, fontSize: 12, fontWeight: "700" }}>{getStatusLabel(status)}</Text>
    </View>
  );
}
EOF

# ── app/_layout.tsx ───────────────────────────────────────────────────────────
cat > app/_layout.tsx << 'EOF'
import "../global.css";
import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

SplashScreen.preventAutoHideAsync();

function useAuthGuard(session: Session | null, loading: boolean) {
  const router = useRouter();
  const segments = useSegments();
  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!session && !inAuthGroup) router.replace("/(auth)/login");
    else if (session && inAuthGroup) router.replace("/(tabs)");
  }, [session, loading, segments]);
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      SplashScreen.hideAsync();
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useAuthGuard(session, loading);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="referral/[id]" options={{ headerShown: true, title: "Referral Tracker", headerBackTitle: "Back", headerTintColor: "#0e6e56" }} />
        <Stack.Screen name="pet/[id]" options={{ headerShown: true, title: "Pet Profile", headerBackTitle: "Back", headerTintColor: "#0e6e56" }} />
      </Stack>
    </>
  );
}
EOF

# ── app/global.css (duplicate at app level for expo-router) ───────────────────
cp global.css app/global.css 2>/dev/null || true

# ── app/(auth)/_layout.tsx ────────────────────────────────────────────────────
cat > "app/(auth)/_layout.tsx" << 'EOF'
import { Stack } from "expo-router";
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
EOF

# ── app/(auth)/login.tsx ──────────────────────────────────────────────────────
cat > "app/(auth)/login.tsx" << 'EOF'
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
EOF

# ── app/(tabs)/_layout.tsx ────────────────────────────────────────────────────
cat > "app/(tabs)/_layout.tsx" << 'EOF'
import { Tabs } from "expo-router";
import { useColorScheme } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";

export default function TabLayout() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const c = dark ? Colors.dark : Colors.light;
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: Colors.brand, tabBarInactiveTintColor: c.muted, tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border, borderTopWidth: 1 }, tabBarLabelStyle: { fontSize: 11, fontWeight: "600" } }}>
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="pets" options={{ title: "My Pets", tabBarIcon: ({ color, size }) => <Ionicons name="paw-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="referrals" options={{ title: "Referrals", tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}
EOF

# ── app/(tabs)/index.tsx ──────────────────────────────────────────────────────
cat > "app/(tabs)/index.tsx" << 'EOF'
import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, RefreshControl, useColorScheme, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";
import { StatusBadge } from "@/components/StatusBadge";
import { registerForPushNotifications } from "@/lib/notifications";

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
EOF

# ── app/(tabs)/pets.tsx ───────────────────────────────────────────────────────
cat > "app/(tabs)/pets.tsx" << 'EOF'
import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, RefreshControl, useColorScheme, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";

type PetRow = { id: string; name: string | null; species: string | null; breed: string | null; date_of_birth: string | null; photo_url: string | null; };

function calcAgeShort(dob: string): string {
  const parts = dob.trim().split("T")[0].split("-");
  if (parts.length < 3) return "—";
  const birth = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();
  if (today.getDate() < birth.getDate()) months--;
  if (months < 0) { years--; months += 12; }
  return years === 0 ? `${months}m` : `${years}y ${months}m`;
}

export default function PetsScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const c = dark ? Colors.dark : Colors.light;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pets, setPets] = useState<PetRow[]>([]);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("pets").select("id, name, species, breed, date_of_birth, photo_url").eq("owner_id", user.id).order("created_at", { ascending: true });
    setPets((data ?? []) as PetRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: dark ? Colors.dark.bg : Colors.light.bg, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={Colors.brand} /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand} />}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: c.text, marginBottom: 20 }}>My Pets</Text>
        {pets.length === 0 ? (
          <Text style={{ color: c.subtext, textAlign: "center", marginTop: 40 }}>No pets yet. Your pets appear automatically when your vet submits a referral.</Text>
        ) : pets.map(pet => (
          <TouchableOpacity key={pet.id} onPress={() => router.push(`/pet/${pet.id}`)} style={{ backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 14 }}>
            {pet.photo_url ? <Image source={{ uri: pet.photo_url }} style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: c.border }} /> : <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.cardInner, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 28 }}>🐾</Text></View>}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: c.text }}>{pet.name ?? "—"}</Text>
              <Text style={{ fontSize: 13, color: c.subtext, marginTop: 2 }}>{[pet.species, pet.breed].filter(Boolean).join(" · ") || "—"}</Text>
              {pet.date_of_birth && <Text style={{ fontSize: 13, color: c.subtext, marginTop: 1 }}>Age: {calcAgeShort(pet.date_of_birth)}</Text>}
            </View>
            <Text style={{ color: Colors.brand, fontWeight: "600", fontSize: 18 }}>→</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
EOF

# ── app/(tabs)/referrals.tsx ──────────────────────────────────────────────────
cat > "app/(tabs)/referrals.tsx" << 'EOF'
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
EOF

# ── app/(tabs)/account.tsx ────────────────────────────────────────────────────
cat > "app/(tabs)/account.tsx" << 'EOF'
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
EOF

# ── placeholder screens for drill-down routes ─────────────────────────────────
cat > "app/referral/[id].tsx" << 'EOF'
import { View, Text, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";

export default function ReferralTrackerScreen() {
  const dark = useColorScheme() === "dark";
  const c = dark ? Colors.dark : Colors.light;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: c.text, fontSize: 16 }}>Referral Tracker — coming soon</Text>
    </SafeAreaView>
  );
}
EOF

cat > "app/pet/[id].tsx" << 'EOF'
import { View, Text, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";

export default function PetProfileScreen() {
  const dark = useColorScheme() === "dark";
  const c = dark ? Colors.dark : Colors.light;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: c.text, fontSize: 16 }}>Pet Profile — coming soon</Text>
    </SafeAreaView>
  );
}
EOF

echo ""
echo "✅ All files created. Now run:"
echo "   npm install"
echo "   npx expo start"
