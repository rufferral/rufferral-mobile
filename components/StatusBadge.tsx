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
