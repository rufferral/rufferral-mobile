import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { Colors } from "@/constants/colors";
import { HomeIcon, PetsIcon, ReferralsIcon, AccountIcon } from "@/components/TabIcons";

const ICON_SIZE = 37; // enlarged ~25% from 30

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.navActive,
        tabBarInactiveTintColor: Colors.navInactive,
        tabBarStyle: {
          backgroundColor: Colors.brand,
          borderTopWidth: 0,
          height: Platform.OS === "ios" ? 96 : 76,
          paddingHorizontal: 40,
          paddingTop: 16,
          paddingBottom: Platform.OS === "ios" ? 30 : 16,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 12,
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
