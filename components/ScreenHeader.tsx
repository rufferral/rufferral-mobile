import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PAGE_BG = "#0c5b45";
const PILL = "#0e6e56";

export function ScreenHeader({ title }: { title: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ backgroundColor: PAGE_BG, paddingTop: insets.top, zIndex: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 12 }}>
      <View style={{ height: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 }}>
        {/* Back pill — absolutely positioned left so title stays centered */}
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.8}
          style={{ position: "absolute", left: 12, flexDirection: "row", alignItems: "center", backgroundColor: PILL, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 }}
        >
          <Text style={{ color: "#ffffff", fontSize: 17, fontWeight: "600", marginRight: 4 }}>‹</Text>
          <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "600" }}>Back</Text>
        </TouchableOpacity>

        <Text style={{ color: "#ffffff", fontSize: 17, fontWeight: "700" }}>{title}</Text>
      </View>
    </View>
  );
}
