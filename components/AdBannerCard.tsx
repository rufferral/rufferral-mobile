import { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, useWindowDimensions, Animated, Easing, PanResponder, Linking } from "react-native";
import { Colors } from "@/constants/colors";

const c = Colors.light;
const AUTO_ADVANCE_MS = 5000;
const BANNER_HEIGHT = 112; // three stacked lines (title, subtitle, CTA), compact

// Mock advertisements for the concept. Swap these for real ad data later.
type Ad = { id: string; title: string; subtitle: string; cta: string; bg: string; accent: string; url?: string };
const ADS: Ad[] = [
  { id: "ad1", title: "PetCo Wellness Plans", subtitle: "Unlimited vet visits from $29/mo", cta: "Learn more", bg: "#1f6f8b", accent: "#7fd1e6" },
  { id: "ad2", title: "FreshBowl Pet Food", subtitle: "Vet-formulated meals, delivered", cta: "Get 40% off", bg: "#7a4f9c", accent: "#d6b6f0" },
  { id: "ad3", title: "PawSafe Insurance", subtitle: "Cover unexpected vet bills today", cta: "Get a quote", bg: "#b5642f", accent: "#f3c79b" },
];

const sectionLabel = { fontSize: 13, fontWeight: "700" as const, textTransform: "uppercase" as const, letterSpacing: 0.6, color: c.muted };

export function AdBannerCard({ onInteractingChange }: { onInteractingChange?: (active: boolean) => void }) {
  const { width } = useWindowDimensions();
  // Full-width banner: screen width minus only the page padding (20 each side).
  const slideWidth = width - 40;
  const ads = ADS;

  const translateX = useRef(new Animated.Value(0)).current;
  const indexRef = useRef(0);
  const [index, setIndex] = useState(0);
  const [restartTick, setRestartTick] = useState(0);

  const goTo = useCallback((i: number) => {
    const clamped = (i + ads.length) % ads.length;
    const dir = clamped >= indexRef.current ? 1 : -1;
    indexRef.current = clamped;
    setIndex(clamped);
    const target = -clamped * slideWidth;
    const overshoot = target - dir * 12;
    Animated.sequence([
      Animated.timing(translateX, { toValue: overshoot, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateX, { toValue: target, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [ads.length, slideWidth, translateX]);

  useEffect(() => {
    const timer = setInterval(() => goTo(indexRef.current + 1), AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [goTo, restartTick]);

  useEffect(() => { translateX.setValue(-indexRef.current * slideWidth); }, [slideWidth, translateX]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => onInteractingChange?.(true),
      onPanResponderMove: (_, g) => translateX.setValue(-indexRef.current * slideWidth + g.dx),
      onPanResponderRelease: (_, g) => {
        onInteractingChange?.(false);
        const past = Math.abs(g.dx) > slideWidth / 2;
        const flick = Math.abs(g.vx) > 0.4;
        if (past || flick) goTo(indexRef.current + (g.dx < 0 ? 1 : -1));
        else goTo(indexRef.current);
        setRestartTick(t => t + 1);
      },
      onPanResponderTerminate: () => onInteractingChange?.(false),
    })
  ).current;

  return (
    <View>
      <Text style={[sectionLabel, { marginBottom: 10 }]}>Sponsored</Text>
      <View style={{ borderRadius: 12, overflow: "hidden" }} {...panResponder.panHandlers}>
        <Animated.View style={{ flexDirection: "row", width: slideWidth * ads.length, transform: [{ translateX }] }}>
          {ads.map(ad => (
            <View key={ad.id} style={{ width: slideWidth }}>
              <View style={{ height: BANNER_HEIGHT, backgroundColor: ad.bg, padding: 16, justifyContent: "center" }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>{ad.title}</Text>
                <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", marginTop: 4 }}>{ad.subtitle}</Text>
                <TouchableOpacity
                  onPress={() => ad.url ? Linking.openURL(ad.url) : undefined}
                  style={{ alignSelf: "flex-start", backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7, marginTop: 12 }}
                >
                  <Text style={{ color: ad.bg, fontSize: 14, fontWeight: "700" }}>{ad.cta}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </Animated.View>
      </View>
      {/* Page dots — all the same size; current is white, others muted green */}
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10 }}>
        {ads.map((_, i) => (
          <View key={i} style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: i === index ? c.text : c.muted, opacity: i === index ? 1 : 0.6 }} />
        ))}
      </View>
    </View>
  );
}
