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
