export const Colors = {
  brand: "#0e6e56",
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
  light: {
    bg: "#e8edf1", card: "#ffffff", cardInner: "#f8fafb",
    border: "#e2e8f0", text: "#1e293b", subtext: "#64748b", muted: "#94a3b8",
  },
  dark: {
    bg: "#000000", card: "#1c1c1e", cardInner: "#000000",
    border: "#38383a", text: "#ffffff", subtext: "#8e8e93", muted: "#636366",
  },
} as const;
