import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View, useWindowDimensions } from "react-native";
import LottieView from "lottie-react-native";

const BRAND_GREEN = "#0e6e56";
const HOLD_MS = 500;
const FADE_MS = 900;
const SAFETY_MS = 8000;

// --- Watermark patch dial ---
// A small green rectangle covering the SVGator badge (bottom-right of logo).
// Adjust these if the patch doesn't sit exactly over the watermark:
//   PATCH_W / PATCH_H  = size of the cover (fraction of logo size)
//   PATCH_RIGHT        = distance from logo's right edge (fraction of logo size)
//   PATCH_BOTTOM       = distance from logo's vertical center (fraction of logo size)
const LOGO = 0.6;          // logo size (fraction of screen width)
const PATCH_W = 0.22;
const PATCH_H = 0.07;
const PATCH_RIGHT = 0.04;
const PATCH_BOTTOM = 0.16;
// ---

type Props = {
  appReady: boolean;
  onFinish: () => void;
};

export default function AnimatedSplash({ appReady, onFinish }: Props) {
  const { width } = useWindowDimensions();
  const opacity = useRef(new Animated.Value(1)).current;
  const hasFaded = useRef(false);
  const [animationDone, setAnimationDone] = useState(false);

  const startFade = () => {
    if (hasFaded.current) return;
    hasFaded.current = true;
    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onFinish();
    });
  };

  const handleAnimationFinish = () => setAnimationDone(true);

  useEffect(() => {
    if (animationDone && appReady) {
      const t = setTimeout(startFade, HOLD_MS);
      return () => clearTimeout(t);
    }
  }, [animationDone, appReady]);

  useEffect(() => {
    const t = setTimeout(startFade, SAFETY_MS);
    return () => clearTimeout(t);
  }, []);

  const logoSize = width * LOGO;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.container, { opacity }]}
      pointerEvents="none"
    >
      <View style={{ width: logoSize, height: logoSize, alignItems: "center", justifyContent: "center" }}>
        <LottieView
          source={require("../assets/rufferral-logo_01.json")}
          autoPlay
          loop={false}
          resizeMode="contain"
          onAnimationFinish={handleAnimationFinish}
          style={{ width: logoSize, height: logoSize }}
        />
        {/* Green patch covering the SVGator watermark */}
        <View
          style={{
            position: "absolute",
            backgroundColor: BRAND_GREEN,
            width: logoSize * PATCH_W,
            height: logoSize * PATCH_H,
            right: logoSize * PATCH_RIGHT,
            top: logoSize / 2 + logoSize * PATCH_BOTTOM,
          }}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: BRAND_GREEN,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
});
