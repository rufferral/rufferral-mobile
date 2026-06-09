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
