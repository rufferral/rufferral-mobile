import Svg, { Path, Circle, Line, Polyline, Rect, G } from "react-native-svg";
import type { TimelineEventKind } from "@/lib/petTimeline";

// Per-icon visual scale tweaks (1 = default). Lets individual icons be nudged
// bigger/smaller on the circle without affecting the others.
const ICON_SCALE: Partial<Record<TimelineEventKind, number>> = {
  symptom: 0.85,      // 15% smaller
  weight: 0.85,       // 15% smaller
  referral: 1.15,     // 15% bigger
  vaccination: 1.15,  // 15% bigger
};

// Renders the event-type icon in a given color (default white), sized to `size`.
// All icons share a normalized 0 0 100 100 viewBox with a transparent bounding
// circle, so sizing, padding and stroke widths are visually consistent.
export function TimelineIcon({ kind, size = 16, color = "#ffffff" }: { kind: TimelineEventKind; size?: number; color?: string }) {
  const s = Math.round(size * (ICON_SCALE[kind] ?? 1));
  switch (kind) {
    case "weight":
      return (
        <Svg width={s} height={s} viewBox="0 0 100 100">
          <Path fill={color} d="M38.98,64.81l-5.98-9.82-3.67,3.47v5.38c0,1.31-.34,2.31-1.03,3.01-.69.7-1.48,1.05-2.37,1.05-1.04,0-1.86-.35-2.45-1.04s-.89-1.72-.89-3.07v-28.86c0-1.5.29-2.65.87-3.43.58-.79,1.4-1.18,2.48-1.18s1.87.36,2.48,1.07c.61.71.92,1.76.92,3.15v16.42l7.61-7.98c.94-.99,1.66-1.67,2.16-2.03.5-.36,1.1-.55,1.81-.55.84,0,1.55.27,2.11.81.56.54.84,1.21.84,2.02,0,.99-.92,2.31-2.75,3.97l-3.6,3.3,6.94,10.91c.51.81.88,1.43,1.1,1.85.22.42.33.82.33,1.2,0,1.07-.29,1.92-.88,2.54-.59.62-1.36.93-2.32.93-.83,0-1.46-.22-1.91-.67s-1.05-1.26-1.81-2.43Z" />
          <Path fill={color} d="M74.19,45.35v19.66c0,2.25-.24,4.18-.72,5.8-.48,1.62-1.25,2.96-2.31,4.02-1.06,1.06-2.44,1.84-4.15,2.36-1.71.51-3.84.77-6.39.77-2.33,0-4.41-.33-6.25-.98-1.83-.65-3.25-1.5-4.24-2.53-.99-1.03-1.49-2.1-1.49-3.19,0-.83.28-1.5.84-2.02.56-.52,1.24-.78,2.03-.78.99,0,1.86.44,2.6,1.31.36.45.74.9,1.13,1.35.39.45.82.84,1.29,1.17.47.32,1.04.56,1.7.72.66.16,1.42.24,2.28.24,1.75,0,3.11-.24,4.08-.73.97-.49,1.64-1.17,2.03-2.05.39-.88.62-1.81.68-2.81.07-1,.12-2.61.15-4.82-1.04,1.45-2.24,2.56-3.61,3.32-1.36.76-2.99,1.14-4.87,1.14-2.27,0-4.24-.58-5.94-1.74-1.69-1.16-3-2.78-3.91-4.86-.91-2.08-1.36-4.49-1.36-7.22,0-2.03.28-3.87.83-5.5.55-1.64,1.34-3.02,2.37-4.14,1.02-1.12,2.21-1.97,3.55-2.54,1.34-.57,2.81-.86,4.41-.86,1.92,0,3.58.37,4.98,1.1,1.4.74,2.71,1.89,3.92,3.46v-.92c0-1.17.29-2.08.87-2.73.58-.64,1.32-.97,2.23-.97,1.31,0,2.17.43,2.6,1.28.43.85.64,2.08.64,3.68ZM54.58,53.93c0,2.74.6,4.82,1.8,6.22,1.2,1.41,2.75,2.11,4.65,2.11,1.12,0,2.19-.3,3.19-.91,1-.6,1.81-1.51,2.44-2.73.63-1.22.94-2.69.94-4.43,0-2.76-.61-4.91-1.82-6.45-1.21-1.54-2.81-2.31-4.8-2.31s-3.48.74-4.65,2.21c-1.17,1.47-1.75,3.56-1.75,6.27Z" />
        </Svg>
      );
    case "symptom":
      return (
        <Svg width={s} height={s} viewBox="0 0 100 100">
          <Circle cx="44.09" cy="45.09" r="16.72" fill="none" stroke={color} strokeWidth={7.76} strokeMiterlimit={10} />
          <Line x1="55.77" y1="57.26" x2="70.15" y2="71.63" fill="none" stroke={color} strokeWidth={7.76} strokeLinecap="round" strokeMiterlimit={10} />
        </Svg>
      );
    case "condition":
      return (
        <Svg width={s} height={s} viewBox="0 0 100 100">
          <Polyline points="28.61 53.14 42.43 66.96 71.39 38.01" fill="none" stroke={color} strokeWidth={7.76} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case "vaccination":
      return (
        <Svg width={s} height={s} viewBox="0 0 100 100">
          <G>
            <Line x1="44.6" y1="49.28" x2="57.46" y2="49.28" fill={color} stroke={color} strokeWidth={2.76} strokeLinecap="round" strokeLinejoin="round" />
            <Line x1="51.03" y1="55.71" x2="51.03" y2="42.85" fill={color} stroke={color} strokeWidth={2.76} strokeLinecap="round" strokeLinejoin="round" />
          </G>
          <Path d="M32.39,36.63c-.27,1.81-.41,3.66-.41,5.55,0,14.03,7.77,26.16,19.06,31.95,11.29-5.79,19.06-17.92,19.06-31.95,0-1.86-.14-3.69-.4-5.47-5.37-3.7-11.8-5.85-18.71-5.85s-13.25,2.12-18.6,5.78Z" fill="none" stroke={color} strokeWidth={7.76} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case "medication":
      return (
        <Svg width={s} height={s} viewBox="0 0 100 100">
          <Rect x="34.81" y="41.2" width="30.38" height="30.38" fill="none" stroke={color} strokeWidth={7.76} strokeLinecap="round" strokeLinejoin="round" />
          <Rect x="39.89" y="28.31" width="20.21" height="11.28" fill={color} stroke={color} strokeWidth={7.76} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case "referral":
      return (
        <Svg width={s} height={s} viewBox="0 0 100 100">
          <Path fill={color} d="M58.53,43.86h0c-1.91-1.91-5.01-1.91-6.92,0l-1.62,1.62-1.62-1.62c-1.91-1.91-5.01-1.91-6.92,0h0c-1.91,1.91-1.91,5.01,0,6.92l1.62,1.62,6.92,6.92,6.92-6.92,1.62-1.62c1.91-1.91,1.91-5.01,0-6.92Z" />
          <G>
            <Path d="M50,71.58c-.08,0-.16,0-.23,0" fill="none" stroke={color} strokeWidth={6.49} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M39.4,68.81c-6.58-3.71-11.03-10.77-11.03-18.86,0-10.02,6.81-18.45,16.05-20.91" fill="none" stroke={color} strokeWidth={6.49} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0.49 10.84" />
            <Path d="M49.77,28.32c.08,0,.16,0,.23,0" fill="none" stroke={color} strokeWidth={6.49} strokeLinecap="round" strokeLinejoin="round" />
          </G>
          <Path d="M51.51,28.32c11.11,0,20.12,9.69,20.12,21.63s-9.01,21.63-20.12,21.63" fill="none" stroke={color} strokeWidth={6.26} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    default:
      return null; // birth (and any future kinds) fall back to the text glyph
  }
}

// Which kinds have a custom SVG icon (others use the KIND_META text glyph).
export const HAS_SVG_ICON: Record<string, boolean> = {
  weight: true, symptom: true, condition: true, vaccination: true, medication: true, referral: true,
};
