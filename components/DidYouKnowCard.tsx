import { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, useWindowDimensions, Animated, Easing, PanResponder } from "react-native";
import { Colors } from "@/constants/colors";
import { DID_YOU_KNOW_FACTS } from "@/lib/didYouKnowFacts";

const c = Colors.light;
const AUTO_ADVANCE_MS = 7000;   // time each fact is shown before auto-advancing

const sectionLabel = { fontSize: 11, fontWeight: "700" as const, textTransform: "uppercase" as const, letterSpacing: 0.5, color: c.muted, marginBottom: 10 };

export function DidYouKnowCard({ onInteractingChange }: { onInteractingChange?: (active: boolean) => void }) {
  const { width } = useWindowDimensions();
  // Slide width = screen width - page padding (20 each side) - card padding (16 each side)
  const slideWidth = width - 40 - 32;
  const facts = DID_YOU_KNOW_FACTS;

  const translateX = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current; // 0→1 timer fill for the current slide
  const indexRef = useRef(0);
  const [index, setIndex] = useState(0);
  const [restartTick, setRestartTick] = useState(0); // bumps on manual release to restart the timer
  const pausedUntil = useRef(0);

  // Animate to a slide.
  // mode "auto"   → long pronounced ease-in-out with a subtle overshoot (used by auto-advance).
  // mode "manual" → a clean, quick fluid glide to fit, no overshoot (used after a manual swipe).
  const goTo = useCallback((i: number, mode: "auto" | "manual" = "auto") => {
    const clamped = (i + facts.length) % facts.length;
    const dir = clamped >= indexRef.current ? 1 : -1;
    indexRef.current = clamped;
    setIndex(clamped);
    const target = -clamped * slideWidth;
    if (mode === "auto") {
      const overshoot = target - dir * 14; // 14px past the resting point
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: overshoot,
          duration: 720,                       // longer = slower, more drawn-out
          easing: Easing.inOut(Easing.poly(5)), // strong, extended ease at both ends
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: target,
          duration: 260,
          easing: Easing.out(Easing.cubic),    // gentle settle back from the overshoot
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Manual: glide to fit with the same subtle overshoot as auto-play, just a touch quicker.
      const overshoot = target - dir * 14;
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: overshoot,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: target,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [facts.length, slideWidth, translateX]);

  // Drive auto-advance from a progress bar that fills over AUTO_ADVANCE_MS, restarting per slide.
  useEffect(() => {
    let cancelled = false;
    progress.setValue(0);
    const run = () => {
      if (cancelled) return;
      // If paused (recent manual swipe), hold the bar empty and retry shortly.
      if (Date.now() < pausedUntil.current) {
        progress.setValue(0);
        setTimeout(run, 250);
        return;
      }
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: AUTO_ADVANCE_MS,
        easing: Easing.linear,
        useNativeDriver: false, // width animation
      }).start(({ finished }) => {
        if (finished && !cancelled && Date.now() >= pausedUntil.current) {
          goTo(indexRef.current + 1);
        }
      });
    };
    run();
    return () => { cancelled = true; progress.stopAnimation(); };
  }, [index, restartTick, goTo, progress]); // restarts each slide change and on manual release

  // Keep position correct if the slide width changes (e.g. rotation).
  useEffect(() => {
    translateX.setValue(-indexRef.current * slideWidth);
  }, [slideWidth, translateX]);

  // Manual drag: lock the parent scroll on touch, follow the finger, then glide to fit on release.
  const panResponder = useRef(
    PanResponder.create({
      // Claim the touch immediately so the parent ScrollView is locked while the finger is on the card.
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        onInteractingChange?.(true); // lock parent vertical scroll
      },
      onPanResponderMove: (_, g) => {
        translateX.setValue(-indexRef.current * slideWidth + g.dx);
      },
      onPanResponderRelease: (_, g) => {
        onInteractingChange?.(false); // unlock parent scroll
        const draggedPastHalf = Math.abs(g.dx) > slideWidth / 2;
        const flicked = Math.abs(g.vx) > 0.4;
        if (draggedPastHalf || flicked) {
          goTo(indexRef.current + (g.dx < 0 ? 1 : -1), "manual");
        } else {
          goTo(indexRef.current, "manual"); // snap back to current, fluid
        }
        // Timer + 6s interval restart immediately for the new slide (no pause).
        pausedUntil.current = 0;
        setRestartTick(t => t + 1);
      },
      onPanResponderTerminate: () => {
        onInteractingChange?.(false); // ensure we unlock if the gesture is interrupted
      },
    })
  ).current;

  return (
    <View style={{ backgroundColor: c.card, borderRadius: 16, borderWidth: 0.75, borderColor: c.border, padding: 16, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
        <Text style={[sectionLabel, { marginBottom: 0 }]}>Did you know?</Text>
        <View style={{ flex: 1, height: 3, borderRadius: 999, backgroundColor: c.cardInner, marginLeft: 12, overflow: "hidden" }}>
          <Animated.View style={{ height: "100%", borderRadius: 999, backgroundColor: c.muted, width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }} />
        </View>
      </View>
      <View style={{ width: slideWidth, overflow: "hidden" }} {...panResponder.panHandlers}>
        <Animated.View style={{ flexDirection: "row", width: slideWidth * facts.length, transform: [{ translateX }] }}>
          {facts.map((item, i) => (
            <View key={i} style={{ width: slideWidth, paddingRight: 2 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: c.text, lineHeight: 21 }}>{item.a}</Text>
              <Text style={{ fontSize: 14, color: c.subtext, lineHeight: 20, marginTop: 4 }}>{item.b}</Text>
            </View>
          ))}
        </Animated.View>
      </View>
    </View>
  );
}
