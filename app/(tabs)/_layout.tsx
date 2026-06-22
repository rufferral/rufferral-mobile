import { Tabs } from "expo-router";
import { Platform, Animated } from "react-native";
import { useEffect, useRef } from "react";
import { Colors } from "@/constants/colors";
import { HomeIcon, PetsIcon, ReferralsIcon, AccountIcon } from "@/components/TabIcons";
import { useAppReady } from "@/context/AppReadyContext";

const ICON_SIZE = 37; // enlarged ~25% from 30
const BAR_HEIGHT = Platform.OS === "ios" ? 96 : 76;
// Extra height that hangs below the screen edge, so an upward overshoot during the
// spring never reveals the page beneath the bar.
const OVERSHOOT_BUFFER = 60;

export default function TabLayout() {
  const { splashDone } = useAppReady();
  // The bar's bottom extends OVERSHOOT_BUFFER px below the screen (hidden), so an upward
  // overshoot during the spring never reveals the page beneath. Rest position is translateY 0.
  const translateY = useRef(new Animated.Value(BAR_HEIGHT + 40)).current;
  const hasSlid = useRef(false);

  useEffect(() => {
    if (splashDone && !hasSlid.current) {
      hasSlid.current = true;
      // Wait for the dashboard card sequence to finish (~1.1s), then spring the bar up
      // with a subtle overshoot-and-settle (Apple-style) rather than a flat ease.
      Animated.sequence([
        Animated.delay(1150),
        Animated.spring(translateY, {
          toValue: 0,
          speed: 5,
          bounciness: 5,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [splashDone]);

  return (
    <Tabs
      sceneContainerStyle={{ backgroundColor: Colors.light.bg }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.navActive,
        tabBarInactiveTintColor: Colors.navInactive,
        tabBarStyle: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: -OVERSHOOT_BUFFER,
          backgroundColor: Colors.brand,
          borderTopWidth: 0,
          height: BAR_HEIGHT + OVERSHOOT_BUFFER,
          paddingHorizontal: 40,
          paddingTop: 16,
          paddingBottom: (Platform.OS === "ios" ? 30 : 16) + OVERSHOOT_BUFFER,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 12,
          transform: [{ translateY }],
        },
        tabBarItemStyle: {
          marginHorizontal: 2,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarIconStyle: { marginBottom: 6 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color }) => <HomeIcon color={color} size={ICON_SIZE} /> }} />
      <Tabs.Screen name="pets" options={{ title: "My Pets", tabBarIcon: ({ color }) => <PetsIcon color={color} size={ICON_SIZE} /> }} />
      <Tabs.Screen name="referrals" options={{ title: "Referrals", tabBarIcon: ({ color }) => <ReferralsIcon color={color} size={ICON_SIZE} /> }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: ({ color }) => <AccountIcon color={color} size={ICON_SIZE} /> }} />
    </Tabs>
  );
}
