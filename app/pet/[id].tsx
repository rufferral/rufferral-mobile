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
