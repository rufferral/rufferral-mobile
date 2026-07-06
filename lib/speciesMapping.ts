// Friendly species labels shown to owners, mapped to their VeNom species codes.
// The code is stored on the pet; the label is what the owner sees. Ordered by
// how common the species is as a pet. Species with a breed list come first.

export type FriendlySpecies = { label: string; code: string; hasBreeds: boolean };

export const FRIENDLY_SPECIES: FriendlySpecies[] = [
  { label: "Dog",        code: "15461",  hasBreeds: true },
  { label: "Cat",        code: "15459",  hasBreeds: true },
  { label: "Rabbit",     code: "100070", hasBreeds: true },   // Domestic Rabbit (has breeds)
  { label: "Guinea Pig", code: "100071", hasBreeds: true },
  { label: "Horse",      code: "15463",  hasBreeds: true },
  { label: "Ferret",     code: "15464",  hasBreeds: true },
  { label: "Rat",        code: "100079", hasBreeds: true },
  { label: "Hamster",    code: "100077", hasBreeds: true },
  { label: "Mouse",      code: "100078", hasBreeds: true },
  // Common pets without a VeNom breed list — breed field becomes free-text/optional.
  { label: "Bird",       code: "",       hasBreeds: false },
  { label: "Fish",       code: "",       hasBreeds: false },
  { label: "Reptile",    code: "",       hasBreeds: false },
];

// Look up a friendly species by its stored code (to show the friendly label back).
export function friendlyLabelForCode(code: string | null | undefined): string | null {
  if (!code) return null;
  return FRIENDLY_SPECIES.find(s => s.code === code)?.label ?? null;
}

export function friendlySpeciesByLabel(label: string | null | undefined): FriendlySpecies | null {
  if (!label) return null;
  return FRIENDLY_SPECIES.find(s => s.label === label) ?? null;
}
