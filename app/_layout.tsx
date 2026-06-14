import "../global.css";
import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import AnimatedSplash from "@/components/AnimatedSplash";
import { AppReadyProvider, useAppReady } from "@/context/AppReadyContext";

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

function RootContent() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [splashDone, setSplashDone] = useState(false);
  const { dashboardReady } = useAppReady();

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

  // Splash may fade once auth is resolved. If a session exists, also wait for
  // the dashboard's data to be ready so we reveal a finished screen.
  const appReady = !loading && (!session || dashboardReady);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="referral/[id]" options={{ headerShown: true, title: "Referral Tracker", headerBackTitle: "Back", headerTintColor: "#0e6e56" }} />
        <Stack.Screen name="pet/[id]" options={{ headerShown: true, title: "Pet Profile", headerBackTitle: "Back", headerTintColor: "#0e6e56" }} />
      </Stack>
      {!splashDone && (
        <AnimatedSplash appReady={appReady} onFinish={() => setSplashDone(true)} />
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <AppReadyProvider>
      <RootContent />
    </AppReadyProvider>
  );
}
