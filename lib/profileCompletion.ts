// Computes how complete a pet profile is, counting all identity + card fields equally.
// Used to show a "Profile X% complete" nudge until everything is filled in.

// Every field that counts toward completion. Keep this in sync with the editable
// fields on the add-pet form and the four pet-profile cards.
export const PROFILE_FIELDS = [
  // Identity
  "name", "species", "breed", "sex", "date_of_birth", "weight_kg", "photo_url",
  // Health & Medical
  "vaccination_status", "microchip_number", "desexed_date", "known_allergies",
  "chronic_conditions", "medication_name",
  // Nutrition & Diet
  "food_type", "food_brand", "food_amount_grams", "food_sensitivities",
  // Lifestyle & Exercise
  "living_situation", "backyard_access", "exercise_types", "exercise_duration_mins",
  "training_level", "temperament",
  // Ownership
  "acquisition_source", "insurance_provider", "notes",
] as const;

export type CompletionFields = Record<string, unknown>;

// A field counts as "filled" if it has a meaningful value (not null/empty/blank).
function isFilled(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return true; // 0 is a valid value (e.g. weight could be small)
  if (typeof value === "boolean") return true; // an explicit yes/no choice counts as filled
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

// Returns an integer 0–100 for how many profile fields are filled.
export function profileCompletion(pet: CompletionFields): number {
  const total = PROFILE_FIELDS.length;
  if (total === 0) return 100;
  let filled = 0;
  for (const field of PROFILE_FIELDS) {
    if (isFilled(pet[field])) filled++;
  }
  return Math.round((filled / total) * 100);
}

// Maps a completion percentage to a warm colour: solid red up to 50%, then
// red→orange→amber from 50%→100%. Stays in the warm band so white text is legible.
export function completionColor(percent: number): string {
  const p = Math.max(0, Math.min(100, percent));
  // Below 50%: stay red (hue 0). Above 50%: ramp hue 0 → 42 (amber).
  const hue = p <= 50 ? 0 : Math.round(((p - 50) / 50) * 42);
  // Slightly deepen lightness so white text stays readable across the range.
  return hslToHex(hue, 75, 44);
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const color = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
