// Green theme — applied app-wide (light/dark switching retired for now).
// Both `light` and `dark` intentionally point to the same green palette so
// existing screens using `dark ? Colors.dark : Colors.light` render green either way.
const green = {
  bg:        "#0c5b45", // page background (deepest green)
  card:      "#0e6e56", // cards + nav bar (brand green)
  cardInner: "#0c5b45", // nested tiles / inner surfaces
  border:    "#92bdb3", // card outlines
  text:      "#ffffff", // headings / primary text
  subtext:   "#92bdb3", // labels + secondary text
  muted:     "#92bdb3", // tertiary text
};

export const Colors = {
  brand: "#0e6e56",
  // Nav bar tints
  navActive: "#ffffff",
  navInactive: "#92bdb3",
  status: {
    sent:       { bg: "#f59e0b", text: "#ffffff" },
    accepted:   { bg: "#3b82f6", text: "#ffffff" },
    seen:       { bg: "#3b82f6", text: "#ffffff" },
    treatment:  { bg: "#8b5cf6", text: "#ffffff" },
    consulting: { bg: "#8b5cf6", text: "#ffffff" },
    completed:  { bg: "#10b981", text: "#ffffff" },
    declined:   { bg: "#ef4444", text: "#ffffff" },
    default:    { bg: "#94a3b8", text: "#ffffff" },
  },
  light: { ...green },
  dark: { ...green },
} as const;
