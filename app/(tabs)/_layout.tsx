import { Tabs } from "expo-router";
import { Colors } from "@/constants/colors";
import { HomeIcon, PetsIcon, ReferralsIcon, AccountIcon } from "@/components/TabIcons";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: "#ffffff", tabBarInactiveTintColor: "rgba(255,255,255,0.55)", tabBarStyle: { backgroundColor: Colors.brand, borderTopColor: "rgba(255,255,255,0.15)", borderTopWidth: 1 }, tabBarLabelStyle: { fontSize: 11, fontWeight: "600" } }}>
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color, size }) => <HomeIcon color={color} size={size} /> }} />
      <Tabs.Screen name="pets" options={{ title: "My Pets", tabBarIcon: ({ color, size }) => <PetsIcon color={color} size={size} /> }} />
      <Tabs.Screen name="referrals" options={{ title: "Referrals", tabBarIcon: ({ color, size }) => <ReferralsIcon color={color} size={size} /> }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: ({ color, size }) => <AccountIcon color={color} size={size} /> }} />
    </Tabs>
  );
}
