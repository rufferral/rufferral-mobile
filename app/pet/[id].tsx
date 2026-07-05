import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Linking,
  Alert,
  Keyboard,
  useColorScheme,
  StyleSheet,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";
import { profileCompletion, completionColor } from "@/lib/profileCompletion";
import { ScreenHeader } from "@/components/ScreenHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EditText, EditDate, EditSelect, EditSelectSearch, EditCardHeader, EditNumberStepper } from "@/components/EditFields";
import { SymptomTracker } from "@/components/SymptomTracker";
import { PetTimeline } from "@/components/PetTimeline";
import { HealthDocuments } from "@/components/HealthDocuments";
import { BREED_OPTIONS, OTHER_LISTED_VALUE, OTHER_BREED_OPTION_LABEL } from "@/lib/breedOptions";

const SPECIES_OPTIONS = ["Bird", "Cat", "Dog", "Fish", "Guinea Pig", "Horse", "Other", "Rabbit", "Reptile"];
const SEX_OPTS = ["Female desexed", "Female intact", "Male neutered", "Male intact"];
import { INSURANCE_PROVIDERS } from "@/lib/insuranceProviders";

// ── Types (ported from web) ────────────────────────────────────────────────
type PetRow = {
  id: string; name: string | null; species: string | null; breed: string | null;
  sex: string | null; age: string | null; date_of_birth: string | null;
  photo_url: string | null; owner_id: string | null; microchip_number: string | null;
  food_brand: string | null; food_type: string | null; food_amount_grams: number | null;
  feeding_frequency: number | null; treats: string | null; supplements: string | null;
  food_sensitivities: string | null; exercise_duration_mins: number | null;
  exercise_types: string | null; living_situation: string | null; backyard_access: boolean | null;
  other_pets: string | null; temperament: string | null; training_level: string | null;
  vaccination_status: string | null; desexed_date: string | null;
  acquisition_source: string | null; insurance_provider: string | null; insurance_policy_number: string | null;
};

// Derived clinical values, read from the event tables (not columns on pets).
type ClinicalDerived = {
  latestWeightKg: number | null;
  conditions: { id: string; display_text: string }[];   // category = 'diagnosis'
  allergies: { id: string; display_text: string }[];     // category = 'allergy'
  lastVaccinatedAt: string | null;                        // latest pet_vaccinations.administered_at
};

type ReferralRow = {
  id: string; status: string | null; speciality_needed: string | null;
  urgency: string | null; created_at: string; preferred_clinic: string | null;
};

type PrescriptionRow = {
  id: string; medication_name: string; dosage: string | null; frequency: string | null;
  prescribed_by_type: string | null; prescribed_by_name: string | null;
  start_date: string | null; end_date: string | null; repeats_total: number | null;
  repeats_remaining: number | null; status: string | null; purchase_url: string | null;
  purchase_product_name: string | null; purchase_image_url: string | null;
  purchase_price: string | null; notes: string | null;
};

type PracticeInfo = {
  name: string | null; suburb: string | null; state: string | null;
  postcode: string | null; phone: string | null; email: string | null;
  address: string | null; vet_name: string | null;
};

// ── Helpers (ported verbatim) ──────────────────────────────────────────────
function calculateAge(dob: string): string {
  const raw = dob?.trim().split("T")[0]; if (!raw) return "—";
  const parts = raw.split("-"); if (parts.length < 3) return "—";
  const y = parseInt(parts[0], 10), m = parseInt(parts[1], 10) - 1, d = parseInt(parts[2], 10);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return "—";
  const birth = new Date(y, m, d), today = new Date();
  birth.setHours(0, 0, 0, 0); today.setHours(0, 0, 0, 0);
  if (birth > today) return "0 months";
  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();
  const days = today.getDate() - birth.getDate();
  if (days < 0) months--;
  if (months < 0) { years--; months += 12; }
  if (years < 0) return "—";
  if (years === 0) return `${months} month${months === 1 ? "" : "s"}`;
  return `${years} year${years === 1 ? "" : "s"} ${months} month${months === 1 ? "" : "s"}`;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }); } catch { return "—"; }
}

// Split "1 year 3 months" into ["1 year", "3 months"]; "3 months" stays one line.
function ageLines(age: string): string[] {
  const m = age.match(/^(\d+\s+years?)\s+(\d+\s+months?)$/);
  if (m) return [m[1], m[2]];
  return [age];
}

// ── Small presentational helpers ───────────────────────────────────────────
function Field({ label, value, c }: { label: string; value: string | null | undefined; c: typeof Colors.light }) {
  const display = value && value.trim() ? value : "—";
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 12, fontWeight: "600", color: c.subtext, marginBottom: 3 }}>{label}</Text>
      <Text style={{ fontSize: 15, color: c.text, lineHeight: 20 }}>{display}</Text>
    </View>
  );
}

// Fades + slides a child up once `go` is true, after an optional delay. (native driver, no layout impact)
function FadeIn({ go, delay = 0, style, children }: { go: boolean; delay?: number; style?: any; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    if (!go) { opacity.setValue(0); translateY.setValue(12); return; }
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [go]);
  return <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

export default function PetProfileScreen() {
  const params = useLocalSearchParams();
  const scrollRef = useRef<any>(null);
  const scrollY = useRef(0); // tracks current scroll offset
  const timelineY = useRef(0); // Y offset of the timeline card in the scroll content
  const scrollAnimRef = useRef<any>(null);

  // Smoothly animate the scroll offset to `targetY` over `duration`, matching the
  // timeline card's shrink so the view tracks with it and ends with the card in view.
  const smoothScrollTo = (targetY: number, duration: number) => {
    const startY = scrollY.current;
    const start = Date.now();
    if (scrollAnimRef.current) clearInterval(scrollAnimRef.current);
    // ease-in-out poly(4) to match the card animation
    const ease = (t: number) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2);
    scrollAnimRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / duration);
      const y = startY + (targetY - startY) * ease(t);
      scrollRef.current?.scrollToPosition?.(0, y, false);
      if (t >= 1 && scrollAnimRef.current) { clearInterval(scrollAnimRef.current); scrollAnimRef.current = null; }
    }, 16);
  };
  const ownershipY = useRef(0); // Y position of the Ownership card
  const router = useRouter();
  const petId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const c = dark ? Colors.dark : Colors.light;

  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing">("loading");
  const [pet, setPet] = useState<PetRow | null>(null);
  const [clinical, setClinical] = useState<ClinicalDerived>({ latestWeightKg: null, conditions: [], allergies: [], lastVaccinatedAt: null });

  // ── Intro fade cascade (opacity only; runs once after the pet loads) ──
  const [tilesGo, setTilesGo] = useState(false); // stat tiles cascade
  const [cardsGo, setCardsGo] = useState(false); // lower cards cascade
  const introRan = useRef(false);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>([]);
  const [practice, setPractice] = useState<PracticeInfo | null>(null);

  // ── Pet identity (header) editing ──
  const [editingHeader, setEditingHeader] = useState(false);
  const [savingHeader, setSavingHeader] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const seedingHeader = useRef(false); // true while seeding so the species-change effect doesn't wipe breed
  const [hName, setHName] = useState("");
  const [hSpecies, setHSpecies] = useState("");
  const [hBreedSelect, setHBreedSelect] = useState("");
  const [hBreedCustom, setHBreedCustom] = useState("");
  const [hSex, setHSex] = useState("");
  const [hDob, setHDob] = useState("");
  const [hWeight, setHWeight] = useState("");

  const seedHeaderFields = (p: PetRow) => {
    seedingHeader.current = true; // suppress the species-change breed-reset during seeding
    setHName(p.name ?? "");
    setHSpecies(p.species ?? "");
    const breedList = BREED_OPTIONS[p.species ?? ""] ?? [];
    if (p.breed && breedList.length > 0 && !breedList.includes(p.breed)) {
      setHBreedSelect(OTHER_LISTED_VALUE); setHBreedCustom(p.breed);
    } else {
      setHBreedSelect(p.breed ?? ""); setHBreedCustom("");
    }
    setHSex(p.sex ?? "");
    setHDob(p.date_of_birth?.split("T")[0] ?? "");
    setHWeight(clinical.latestWeightKg != null ? String(clinical.latestWeightKg) : "");
  };

  const headerBreedOptions = BREED_OPTIONS[hSpecies] ?? [];
  const headerHasBreedList = headerBreedOptions.length > 0;
  const headerBreedLabel = hSpecies === "Fish" || hSpecies === "Bird" || hSpecies === "Reptile" ? "Species/Type" : "Breed";
  const headerResolvedBreed = () => hBreedSelect === OTHER_LISTED_VALUE ? hBreedCustom.trim() : hBreedSelect.trim();

  const saveHeader = async () => {
    if (!hName.trim()) { Alert.alert("Required", "Pet name is required."); return; }
    setSavingHeader(true);
    const fields = {
      name: hName.trim(),
      species: hSpecies || null,
      breed: headerResolvedBreed() || null,
      sex: hSex || null,
      date_of_birth: hDob || null,
    };
    const { error } = await supabase.from("pets").update(fields).eq("id", petId);
    if (error) { setSavingHeader(false); Alert.alert("Couldn't save", error.message); return; }

    // Weight is longitudinal: if it changed, record a NEW dated observation (don't overwrite).
    const newWeight = hWeight ? parseFloat(hWeight) : null;
    if (newWeight != null && newWeight > 0 && newWeight !== clinical.latestWeightKg) {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("pet_weights").insert({
        pet_id: petId,
        owner_id: user?.id ?? pet?.owner_id,
        weight_kg: newWeight,
        recorded_at: new Date().toISOString(),
        source: "owner",
        confidence: "reported",
      });
      setClinical(prev => ({ ...prev, latestWeightKg: newWeight }));
    }
    setSavingHeader(false);
    setPet(prev => prev ? { ...prev, ...fields } as PetRow : prev);
    setEditingHeader(false);
  };

  const PET_PHOTOS_BUCKET = "pet-photos";
  const changePhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed", "Please allow photo access to change the photo."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.9,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const uri = result.assets[0].uri;
    setUploadingPhoto(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const arrayBuffer = decode(base64);
      const ext = (uri.split(".").pop() || "jpg").split("?")[0].toLowerCase();
      const contentType = ext === "png" ? "image/png" : "image/jpeg";
      const path = `pets/${petId}/profile_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(PET_PHOTOS_BUCKET).upload(path, arrayBuffer, { upsert: true, contentType });
      if (upErr) { Alert.alert("Photo upload failed", upErr.message); setUploadingPhoto(false); return; }
      const { data: { publicUrl } } = supabase.storage.from(PET_PHOTOS_BUCKET).getPublicUrl(path);
      const { error: updErr } = await supabase.from("pets").update({ photo_url: publicUrl }).eq("id", petId);
      if (updErr) { Alert.alert("Couldn't save photo", updErr.message); setUploadingPhoto(false); return; }
      setPet(prev => prev ? { ...prev, photo_url: publicUrl } as PetRow : prev);
    } catch (e) {
      Alert.alert("Photo error", e instanceof Error ? e.message : String(e));
    }
    setUploadingPhoto(false);
  };

  // ── Health & Medical editing ──
  const [editingHealth, setEditingHealth] = useState(false);
  const [savingHealth, setSavingHealth] = useState(false);
  const [hMicrochip, setHMicrochip] = useState("");
  const [hVaccinationStatus, setHVaccinationStatus] = useState("");
  const [hLastVaccinated, setHLastVaccinated] = useState("");
  const [hDesexedDate, setHDesexedDate] = useState("");

  const seedHealthFields = (p: PetRow) => {
    setHMicrochip(p.microchip_number ?? "");
    setHVaccinationStatus(p.vaccination_status ?? "");
    setHLastVaccinated(clinical.lastVaccinatedAt?.split("T")[0] ?? "");
    setHDesexedDate(p.desexed_date?.split("T")[0] ?? "");
  };

  const saveHealth = async () => {
    setSavingHealth(true);
    // Only columns that still live on `pets`. Allergies/conditions/vaccination dates
    // are event-table data (read-only in this pass; full editing comes later with codes).
    const fields = {
      microchip_number: hMicrochip || null,
      vaccination_status: hVaccinationStatus || null,
      desexed_date: hDesexedDate || null,
    };
    const { error } = await supabase.from("pets").update(fields).eq("id", petId);
    setSavingHealth(false);
    if (error) { Alert.alert("Couldn't save", error.message); return; }
    setPet(prev => prev ? { ...prev, ...fields } as PetRow : prev);
    setEditingHealth(false);
  };

  // ── Nutrition & Diet editing ──
  const [editingNutrition, setEditingNutrition] = useState(false);
  const [savingNutrition, setSavingNutrition] = useState(false);
  const [nFoodBrand, setNFoodBrand] = useState("");
  const [nFoodType, setNFoodType] = useState("");
  const [nFoodAmount, setNFoodAmount] = useState("");
  const [nFeedingFreq, setNFeedingFreq] = useState("");
  const [nTreats, setNTreats] = useState("");
  const [nSupplements, setNSupplements] = useState("");
  const [nSensitivities, setNSensitivities] = useState("");

  const seedNutritionFields = (p: PetRow) => {
    setNFoodBrand(p.food_brand ?? "");
    setNFoodType(p.food_type ?? "");
    setNFoodAmount(p.food_amount_grams != null ? String(p.food_amount_grams) : "");
    setNFeedingFreq(p.feeding_frequency != null ? String(p.feeding_frequency) : "");
    setNTreats(p.treats ?? "");
    setNSupplements(p.supplements ?? "");
    setNSensitivities(p.food_sensitivities ?? "");
  };

  const saveNutrition = async () => {
    setSavingNutrition(true);
    const fields = {
      food_brand: nFoodBrand || null,
      food_type: nFoodType || null,
      food_amount_grams: nFoodAmount ? parseInt(nFoodAmount, 10) : null,
      feeding_frequency: nFeedingFreq ? parseInt(nFeedingFreq, 10) : null,
      treats: nTreats || null,
      supplements: nSupplements || null,
      food_sensitivities: nSensitivities || null,
    };
    const { error } = await supabase.from("pets").update(fields).eq("id", petId);
    setSavingNutrition(false);
    if (error) { Alert.alert("Couldn't save", error.message); return; }
    setPet(prev => prev ? { ...prev, ...fields } as PetRow : prev);
    setEditingNutrition(false);
  };

  // ── Lifestyle & Exercise editing ──
  const [editingLifestyle, setEditingLifestyle] = useState(false);
  const [savingLifestyle, setSavingLifestyle] = useState(false);
  const [lExerciseMins, setLExerciseMins] = useState("");
  const [lLivingSituation, setLLivingSituation] = useState("");
  const [lBackyard, setLBackyard] = useState(""); // "", "true", "false"
  const [lTrainingLevel, setLTrainingLevel] = useState("");
  const [lExerciseTypes, setLExerciseTypes] = useState("");
  const [lTemperament, setLTemperament] = useState("");
  const [lOtherPets, setLOtherPets] = useState("");

  const seedLifestyleFields = (p: PetRow) => {
    setLExerciseMins(p.exercise_duration_mins != null ? String(p.exercise_duration_mins) : "");
    setLLivingSituation(p.living_situation ?? "");
    setLBackyard(p.backyard_access === true ? "true" : p.backyard_access === false ? "false" : "");
    setLTrainingLevel(p.training_level ?? "");
    setLExerciseTypes(p.exercise_types ?? "");
    setLTemperament(p.temperament ?? "");
    setLOtherPets(p.other_pets ?? "");
  };

  const saveLifestyle = async () => {
    setSavingLifestyle(true);
    const fields = {
      exercise_duration_mins: lExerciseMins ? parseInt(lExerciseMins, 10) : null,
      living_situation: lLivingSituation || null,
      backyard_access: lBackyard === "true" ? true : lBackyard === "false" ? false : null,
      training_level: lTrainingLevel || null,
      exercise_types: lExerciseTypes || null,
      temperament: lTemperament || null,
      other_pets: lOtherPets || null,
    };
    const { error } = await supabase.from("pets").update(fields).eq("id", petId);
    setSavingLifestyle(false);
    if (error) { Alert.alert("Couldn't save", error.message); return; }
    setPet(prev => prev ? { ...prev, ...fields } as PetRow : prev);
    setEditingLifestyle(false);
  };

  // ── Ownership editing ──
  const [editingOwnership, setEditingOwnership] = useState(false);
  const [savingOwnership, setSavingOwnership] = useState(false);
  const [oAcquisition, setOAcquisition] = useState("");
  const [oInsurance, setOInsurance] = useState("");
  const [oPolicyNumber, setOPolicyNumber] = useState("");
  const [oCustomInsurance, setOCustomInsurance] = useState("");
  const [providerList, setProviderList] = useState<string[]>([]);

  const seedOwnershipFields = (p: PetRow) => {
    setOAcquisition(p.acquisition_source ?? "");
    const prov = p.insurance_provider ?? "";
    // If the stored provider isn't in our list, treat it as a custom "Other" value.
    if (prov && providerList.length > 0 && !providerList.includes(prov) && prov !== "None") {
      setOInsurance("Other"); setOCustomInsurance(prov);
    } else {
      setOInsurance(prov); setOCustomInsurance("");
    }
    setOPolicyNumber(p.insurance_policy_number ?? "");
  };

  const saveOwnership = async () => {
    setSavingOwnership(true);
    const finalProvider = oInsurance === "Other" ? (oCustomInsurance.trim() || null) : (oInsurance || null);
    const showPolicy = oInsurance !== "" && oInsurance !== "None";
    const fields = {
      acquisition_source: oAcquisition || null,
      insurance_provider: finalProvider,
      insurance_policy_number: showPolicy ? (oPolicyNumber || null) : null,
    };
    const { error } = await supabase.from("pets").update(fields).eq("id", petId);
    setSavingOwnership(false);
    if (error) { Alert.alert("Couldn't save", error.message); return; }
    setPet(prev => prev ? { ...prev, ...fields } as PetRow : prev);
    const savedY = scrollY.current;
    setEditingOwnership(false);
    // After the card swaps edit→read and the keyboard dismisses, restore position.
    setTimeout(() => { scrollRef.current?.scrollToPosition?.(0, savedY, false); }, 100);
    setTimeout(() => { scrollRef.current?.scrollToPosition?.(0, savedY, false); }, 300);
  };

  const loadData = useCallback(async () => {
    if (!petId) { setLoadState("missing"); return; }
    const { data: { user } } = await supabase.auth.getUser();

    const { data: petData, error } = await supabase.from("pets").select("*").eq("id", petId).maybeSingle();
    if (error || !petData) { setLoadState("missing"); return; }
    setPet(petData as PetRow);

    // Derived clinical values from event tables (latest weight, conditions, allergies, last vaccination)
    const [wRes, cRes, vRes] = await Promise.all([
      supabase.from("pet_weights").select("weight_kg, recorded_at").eq("pet_id", petId).order("recorded_at", { ascending: false }).limit(1),
      supabase.from("pet_conditions").select("id, display_text, category, status").eq("pet_id", petId).neq("status", "resolved").order("recorded_at", { ascending: false }),
      supabase.from("pet_vaccinations").select("administered_at").eq("pet_id", petId).not("administered_at", "is", null).order("administered_at", { ascending: false }).limit(1),
    ]);
    const conds = (cRes.data ?? []) as { id: string; display_text: string; category: string | null }[];
    setClinical({
      latestWeightKg: (wRes.data?.[0] as { weight_kg?: number } | undefined)?.weight_kg ?? null,
      conditions: conds.filter(r => r.category !== "allergy").map(r => ({ id: r.id, display_text: r.display_text })),
      allergies: conds.filter(r => r.category === "allergy").map(r => ({ id: r.id, display_text: r.display_text })),
      lastVaccinatedAt: (vRes.data?.[0] as { administered_at?: string } | undefined)?.administered_at ?? null,
    });

    const { data: refData } = await supabase.from("referrals")
      .select("id, status, speciality_needed, urgency, created_at, preferred_clinic")
      .eq("pet_id", petId).order("created_at", { ascending: false });
    setReferrals((refData ?? []) as ReferralRow[]);

    const { data: rxData } = await supabase.from("prescriptions")
      .select("id, medication_name, dosage, frequency, prescribed_by_type, prescribed_by_name, start_date, end_date, repeats_total, repeats_remaining, status, purchase_url, purchase_product_name, purchase_image_url, purchase_price, notes")
      .eq("pet_id", petId).order("created_at", { ascending: false });
    setPrescriptions((rxData ?? []) as PrescriptionRow[]);

    const { data: latestReferral } = await supabase.from("referrals")
      .select("practice_id, referring_vet_id").eq("pet_id", petId)
      .not("practice_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const lr = latestReferral as { practice_id?: string | null; referring_vet_id?: string | null } | null;
    if (lr?.practice_id) {
      const { data: practiceRow } = await supabase.from("practices").select("name, suburb, state, postcode, phone, email, address").eq("id", lr.practice_id).maybeSingle();
      const { data: vetRow } = await supabase.from("profiles").select("full_name").eq("id", lr.referring_vet_id ?? "").maybeSingle();
      if (practiceRow) {
        const pr = practiceRow as { name?: string | null; suburb?: string | null; state?: string | null; postcode?: string | null; phone?: string | null; email?: string | null; address?: string | null; };
        const vr = vetRow as { full_name?: string | null } | null;
        setPractice({ name: pr.name ?? null, suburb: pr.suburb ?? null, state: pr.state ?? null, postcode: pr.postcode ?? null, phone: pr.phone ?? null, email: pr.email ?? null, address: pr.address ?? null, vet_name: vr?.full_name ?? null });
      }
    }

    setLoadState("ready");

    // Insurance providers — read from DB so mobile stays in sync with web; fall back to bundled AU list.
    const { data: provData } = await supabase.from("insurance_providers").select("name").eq("active", true).order("name", { ascending: true });
    const names = (provData ?? []).map(r => (r as { name: string }).name).filter(Boolean)
      .filter(n => n !== "None" && n !== "Other");
    setProviderList(names.length > 0 ? names : [...INSURANCE_PROVIDERS]);
  }, [petId]);

  useEffect(() => { void loadData(); }, [loadData]);

  // Once the pet is loaded and content is ready, cascade the stat tiles in, then the lower cards.
  useEffect(() => {
    if (loadState === "ready" && pet && !introRan.current) {
      introRan.current = true;
      // rAF ensures the content has mounted/painted before we flip the fade flags.
      const raf = requestAnimationFrame(() => {
        setTilesGo(true);
        setTimeout(() => setCardsGo(true), 450);
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [loadState, pet]);
  // When species changes during header editing, reset the breed selection.
  useEffect(() => {
    if (seedingHeader.current) { seedingHeader.current = false; return; } // skip reset on initial seed
    if (editingHeader) { setHBreedSelect(""); setHBreedCustom(""); }
  }, [hSpecies]);

  if (loadState === "loading") {
    return <SafeAreaView style={[styles.center, { backgroundColor: c.bg }]}><ActivityIndicator color={Colors.brand} /></SafeAreaView>;
  }
  if (loadState === "missing" || !pet) {
    return <SafeAreaView style={[styles.center, { backgroundColor: c.bg }]}><Text style={{ color: c.text, fontSize: 16 }}>Pet not found.</Text></SafeAreaView>;
  }

  const dobStr = pet.date_of_birth ?? "";
  const ageDisplay = dobStr ? calculateAge(dobStr) : pet.age ?? "—";
  const activeReferrals = referrals.filter(r => !["completed", "declined"].includes((r.status ?? "").toLowerCase()));
  const pastReferrals = referrals.filter(r => ["completed", "declined"].includes((r.status ?? "").toLowerCase()));
  const activePrescriptions = prescriptions.filter(rx => (rx.status ?? "").toLowerCase() === "active");
  const pastPrescriptions = prescriptions.filter(rx => (rx.status ?? "").toLowerCase() !== "active");

  const card = { backgroundColor: c.card, borderRadius: 16, borderWidth: 0.75, borderColor: c.border, padding: 18, marginBottom: 16 } as const;
  const sectionHeading = { fontSize: 13, fontWeight: "700" as const, textTransform: "uppercase" as const, letterSpacing: 0.6, color: c.subtext, marginBottom: 12 };
  const statTile = { flex: 1, backgroundColor: c.cardInner, borderRadius: 8, paddingVertical: 12, alignItems: "center" as const };
  const statHead = { fontSize: 11, fontWeight: "700" as const, textTransform: "uppercase" as const, letterSpacing: 0.4, color: c.muted, textAlign: "center" as const };
  const statVal = { marginTop: 6, fontSize: 14, fontWeight: "600" as const, color: c.text, textAlign: "center" as const };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader title="Pet Profile" />
      <KeyboardAwareScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: c.bg }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        enableResetScrollToCoords={false}
        extraScrollHeight={24}
        scrollEventThrottle={16}
        onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
      >

      {/* Profile completion banner (full width, above the card) */}
      {pet && !editingHeader ? (() => {
        const pct = profileCompletion(pet, {
          hasWeight: clinical.latestWeightKg != null,
          hasAllergies: clinical.allergies.length > 0,
          hasConditions: clinical.conditions.length > 0,
        });
        return pct < 100 ? (
          <View style={{ borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, marginBottom: 12, alignItems: "center", justifyContent: "center", backgroundColor: completionColor(pct) }}>
            <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "700" }}>{pet.name ?? "This pet"}'s profile is only {pct}% complete</Text>
          </View>
        ) : null;
      })() : null}

      {/* Pet header card */}
      <View style={[card, { paddingVertical: 24 }]}>
        {editingHeader ? (
          <>
            <TouchableOpacity onPress={() => setEditingHeader(false)} disabled={savingHeader} style={{ position: "absolute", top: 12, left: 12, zIndex: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 0.75, borderColor: c.border }}>
              <Text style={{ color: c.subtext, fontSize: 13, fontWeight: "600" }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => void saveHeader()} disabled={savingHeader} style={{ position: "absolute", top: 12, right: 12, zIndex: 5, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999, backgroundColor: Colors.brand }}>
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>{savingHeader ? "Saving…" : "Save"}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity onPress={() => { if (pet) seedHeaderFields(pet); setEditingHeader(true); }} style={{ position: "absolute", top: 12, right: 12, zIndex: 5, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999, borderWidth: 0.75, borderColor: c.border }}>
            <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>Edit</Text>
          </TouchableOpacity>
        )}

        <View style={{ alignItems: "center", marginTop: editingHeader ? 24 : 0 }}>
          <TouchableOpacity disabled={!editingHeader || uploadingPhoto} onPress={editingHeader ? changePhoto : undefined} activeOpacity={0.8}>
            {pet.photo_url ? (
              <Image source={{ uri: pet.photo_url }} style={{ width: 120, height: 120, borderRadius: 60, borderWidth: 0.75, borderColor: c.border }} />
            ) : (
              <View style={{ width: 120, height: 120, borderRadius: 60, borderWidth: 0.75, borderColor: c.border, backgroundColor: c.cardInner, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 48 }}>🐾</Text>
              </View>
            )}
            {editingHeader ? (
              <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.45)", borderBottomLeftRadius: 60, borderBottomRightRadius: 60, paddingVertical: 6, alignItems: "center" }}>
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{uploadingPhoto ? "Uploading…" : "Change"}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        {editingHeader ? (
          <View style={{ marginTop: 18 }}>
            <EditText label="Pet name *" value={hName} onChange={setHName} placeholder="e.g. Bella" />
            <EditSelect label="Species *" value={hSpecies} onChange={setHSpecies} options={SPECIES_OPTIONS.map(s => ({ label: s, value: s }))} />
            {hSpecies ? (
              headerHasBreedList ? (
                <>
                  <EditSelect label={`${headerBreedLabel} *`} value={hBreedSelect} onChange={setHBreedSelect}
                    options={[...headerBreedOptions.map(b => ({ label: b, value: b })), { label: OTHER_BREED_OPTION_LABEL, value: OTHER_LISTED_VALUE }]} />
                  {hBreedSelect === OTHER_LISTED_VALUE ? (
                    <EditText label={`${headerBreedLabel} (please specify) *`} value={hBreedCustom} onChange={setHBreedCustom} placeholder={`Enter ${headerBreedLabel.toLowerCase()}`} />
                  ) : null}
                </>
              ) : (
                <EditText label={`${headerBreedLabel} *`} value={hBreedCustom} onChange={(v) => { setHBreedCustom(v); setHBreedSelect(OTHER_LISTED_VALUE); }} placeholder={`Enter ${headerBreedLabel.toLowerCase()}`} />
              )
            ) : null}
            <EditSelect label="Sex *" value={hSex} onChange={setHSex} options={SEX_OPTS.map(s => ({ label: s, value: s }))} />
            <EditDate label="Date of birth *" value={hDob} onChange={setHDob} />
            <EditNumberStepper label="Weight (kg)" value={hWeight} onChange={setHWeight} placeholder="e.g. 12.5" step={0.1} unit="kg" />
          </View>
        ) : (
          <>
            <Text style={{ fontSize: 26, fontWeight: "700", color: c.text, marginTop: 14, textAlign: "center" }}>{pet.name ?? "—"}</Text>
            <Text style={{ fontSize: 15, color: c.subtext, marginTop: 2, textAlign: "center" }}>{[pet.species, pet.breed].filter(Boolean).join(" · ") || "—"}</Text>

            {/* Stat tiles — cascade in by opacity */}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 16, alignSelf: "stretch" }}>
              <FadeIn go={tilesGo} delay={0} style={{ flex: 1 }}>
                <View style={statTile}>
                  <Text style={statHead}>Sex</Text>
                  {(pet.sex && pet.sex.trim().split(/\s+/).length === 2
                    ? pet.sex.trim().split(/\s+/)
                    : [pet.sex || "—"]
                  ).map((line, i) => (
                    <Text key={i} style={[statVal, i > 0 ? { marginTop: 0 } : null]}>{line}</Text>
                  ))}
                </View>
              </FadeIn>
              <FadeIn go={tilesGo} delay={120} style={{ flex: 1 }}>
                <View style={statTile}>
                  <Text style={statHead}>Age</Text>
                  {ageLines(ageDisplay).map((line, i) => (
                    <Text key={i} style={[statVal, i > 0 ? { marginTop: 0 } : null]}>{line}</Text>
                  ))}
                </View>
              </FadeIn>
              <FadeIn go={tilesGo} delay={240} style={{ flex: 1 }}>
                <View style={statTile}><Text style={statHead}>Weight</Text><Text style={statVal}>{clinical.latestWeightKg != null ? `${clinical.latestWeightKg} kg` : "—"}</Text></View>
              </FadeIn>
            </View>
          </>
        )}

        {/* Referral counts */}
        {practice?.name ? (
          <View style={{ alignSelf: "stretch", marginTop: 16, gap: 8 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <FadeIn go={tilesGo} delay={360} style={{ flex: 1 }}>
                <View style={statTile}><Text style={statHead}>Total{"\n"}Referrals</Text><Text style={[statVal, { fontSize: 18, fontWeight: "700" }]}>{referrals.length}</Text></View>
              </FadeIn>
              <FadeIn go={tilesGo} delay={440} style={{ flex: 1 }}>
                <View style={statTile}><Text style={statHead}>Active{"\n"}Referrals</Text><Text style={[statVal, { fontSize: 18, fontWeight: "700" }]}>{activeReferrals.length}</Text></View>
              </FadeIn>
              <FadeIn go={tilesGo} delay={520} style={{ flex: 1 }}>
                <View style={statTile}><Text style={statHead}>Last{"\n"}Referral</Text><Text style={[statVal, { fontSize: 13, fontWeight: "700" }]}>{referrals[0]?.created_at ? formatDate(referrals[0].created_at) : "—"}</Text></View>
              </FadeIn>
            </View>
          </View>
        ) : null}
      </View>

      {/* Lifetime Timeline — the longitudinal record (hero feature) */}
      <View onLayout={(e) => { timelineY.current = e.nativeEvent.layout.y; }}>
        <FadeIn go={cardsGo} delay={0} style={{ marginBottom: 16 }}>
          <PetTimeline petId={petId} ownerId={pet.owner_id ?? ""} dateOfBirth={pet.date_of_birth} onRequestScrollTo={() => smoothScrollTo(Math.max(0, timelineY.current - 12), 1400)} />
        </FadeIn>
      </View>

      {/* Active Referrals */}
      <FadeIn go={cardsGo} delay={80}>
      <View style={card}>
        <Text style={sectionHeading}>{activeReferrals.length > 0 ? `Active Referrals (${activeReferrals.length})` : "Active Referrals"}</Text>
        {activeReferrals.length === 0 ? (
          <Text style={{ fontSize: 15, color: c.subtext }}>No active referrals</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {activeReferrals.map((ref) => (
              <View key={ref.id} style={{ backgroundColor: c.cardInner, borderRadius: 12, padding: 14 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: c.text }}>{ref.speciality_needed ?? "Specialist"} referral</Text>
                    <Text style={{ fontSize: 13, color: c.subtext, marginTop: 2 }}>{ref.preferred_clinic ?? "—"} · {formatDate(ref.created_at)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <StatusBadge status={ref.status} />
                    <TouchableOpacity onPress={() => router.push(`/referral/${ref.id}`)}>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: "#92bdb3" }}>View →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
      </FadeIn>

      {/* Referral History */}
      {pastReferrals.length > 0 ? (
        <FadeIn go={cardsGo} delay={80}>
        <View style={card}>
          <Text style={sectionHeading}>Referral History</Text>
          <View style={{ gap: 10 }}>
            {pastReferrals.map((ref) => (
              <View key={ref.id} style={{ backgroundColor: c.cardInner, borderRadius: 12, padding: 14, opacity: dark ? 1 : 0.75 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: c.text }}>{ref.speciality_needed ?? "Specialist"} referral</Text>
                    <Text style={{ fontSize: 13, color: c.subtext, marginTop: 2 }}>{ref.preferred_clinic ?? "—"} · {formatDate(ref.created_at)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <StatusBadge status={ref.status} />
                    <TouchableOpacity onPress={() => router.push(`/referral/${ref.id}`)}>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: "#92bdb3" }}>View →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
        </FadeIn>
      ) : null}

      {/* Pet Details */}
      <FadeIn go={cardsGo} delay={160}>
      <View style={card}>
        <Text style={sectionHeading}>Pet Details</Text>
        <View style={{ flexDirection: "row", gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Field label="Name" value={pet.name} c={c} />
            <Field label="Species" value={pet.species} c={c} />
            <Field label="Breed" value={pet.breed} c={c} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Sex" value={pet.sex} c={c} />
            <Field label="Date of birth" value={pet.date_of_birth ? formatDate(pet.date_of_birth) : null} c={c} />
            <Field label="Weight" value={clinical.latestWeightKg != null ? `${clinical.latestWeightKg} kg` : null} c={c} />
          </View>
        </View>
      </View>
      </FadeIn>

      {/* Health & Medical */}
      <FadeIn go={cardsGo} delay={240}>
      <View style={card}>
        <EditCardHeader
          title="Health & Medical"
          editing={editingHealth}
          saving={savingHealth}
          onEdit={() => { if (pet) seedHealthFields(pet); setEditingHealth(true); }}
          onSave={() => void saveHealth()}
          onCancel={() => setEditingHealth(false)}
        />
        {editingHealth ? (
          <>
            <View style={{ flexDirection: "row", gap: 16 }}>
              <View style={{ flex: 1 }}>
                <EditText label="Microchip number" value={hMicrochip} onChange={setHMicrochip} placeholder="e.g. 956000012345678" />
                <EditDate label="Desexed date" value={hDesexedDate} onChange={setHDesexedDate} />
              </View>
              <View style={{ flex: 1 }}>
                <EditSelect label="Vaccination status" value={hVaccinationStatus} onChange={setHVaccinationStatus}
                  options={[
                    { label: "Up to date", value: "Up to date" },
                    { label: "Overdue", value: "Overdue" },
                    { label: "Unknown", value: "Unknown" },
                    { label: "Not vaccinated", value: "Not vaccinated" },
                  ]} />
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: 16 }}>
              <View style={{ flex: 1 }}>
                <Field label="Microchip number" value={pet.microchip_number} c={c} />
                <Field label="Desexed date" value={pet.desexed_date ? formatDate(pet.desexed_date) : null} c={c} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Vaccination status" value={pet.vaccination_status} c={c} />
                <Field label="Last vaccinated" value={clinical.lastVaccinatedAt ? formatDate(clinical.lastVaccinatedAt) : null} c={c} />
              </View>
            </View>
            <Field label="Known allergies" value={clinical.allergies.length ? clinical.allergies.map(a => a.display_text).join(", ") : null} c={c} />
            <Field label="Chronic conditions / diagnoses" value={clinical.conditions.length ? clinical.conditions.map(x => x.display_text).join(", ") : null} c={c} />
          </>
        )}
        <HealthDocuments petId={petId} ownerId={pet.owner_id ?? ""} />
      </View>
      </FadeIn>

      {/* Symptom Tracker */}
      <FadeIn go={cardsGo} delay={280} style={{ marginBottom: 16 }}>
        <SymptomTracker petId={petId} ownerId={pet.owner_id ?? ""} />
      </FadeIn>

      {/* Nutrition & Diet */}
      <FadeIn go={cardsGo} delay={320}>
      <View style={card}>
        <EditCardHeader
          title="Nutrition & Diet"
          editing={editingNutrition}
          saving={savingNutrition}
          onEdit={() => { if (pet) seedNutritionFields(pet); setEditingNutrition(true); }}
          onSave={() => void saveNutrition()}
          onCancel={() => setEditingNutrition(false)}
        />
        {editingNutrition ? (
          <View style={{ flexDirection: "row", gap: 16 }}>
            <View style={{ flex: 1 }}>
              <EditText label="Primary food brand" value={nFoodBrand} onChange={setNFoodBrand} placeholder="e.g. Royal Canin" />
              <EditSelect label="Food type" value={nFoodType} onChange={setNFoodType}
                options={[
                  { label: "Dry (kibble)", value: "Dry (kibble)" },
                  { label: "Wet (canned)", value: "Wet (canned)" },
                  { label: "Raw", value: "Raw" },
                  { label: "Mixed", value: "Mixed" },
                  { label: "Home cooked", value: "Home cooked" },
                  { label: "Prescription diet", value: "Prescription diet" },
                ]} />
              <EditText label="Daily amount (grams)" value={nFoodAmount} onChange={setNFoodAmount} placeholder="e.g. 200" keyboardType="numeric" />
              <EditSelect label="Meals per day" value={nFeedingFreq} onChange={setNFeedingFreq}
                options={[
                  { label: "1 = once daily", value: "1" },
                  { label: "2 = morning & evening", value: "2" },
                  { label: "3 = three times daily", value: "3" },
                  { label: "4+ = free feeding", value: "4" },
                ]} />
            </View>
            <View style={{ flex: 1 }}>
              <EditText label="Treats / snacks" value={nTreats} onChange={setNTreats} />
              <EditText label="Supplements" value={nSupplements} onChange={setNSupplements} />
              <EditText label="Food sensitivities" value={nSensitivities} onChange={setNSensitivities} />
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Field label="Primary food brand" value={pet.food_brand} c={c} />
              <Field label="Food type" value={pet.food_type} c={c} />
              <Field label="Daily amount (grams)" value={pet.food_amount_grams != null ? `${pet.food_amount_grams} g` : null} c={c} />
              <Field label="Meals per day" value={pet.feeding_frequency != null ? String(pet.feeding_frequency) : null} c={c} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Treats / snacks" value={pet.treats} c={c} />
              <Field label="Supplements" value={pet.supplements} c={c} />
              <Field label="Food sensitivities" value={pet.food_sensitivities} c={c} />
            </View>
          </View>
        )}
      </View>
      </FadeIn>

      {/* Lifestyle & Exercise */}
      <FadeIn go={cardsGo} delay={400}>
      <View style={card}>
        <EditCardHeader
          title="Lifestyle & Exercise"
          editing={editingLifestyle}
          saving={savingLifestyle}
          onEdit={() => { if (pet) seedLifestyleFields(pet); setEditingLifestyle(true); }}
          onSave={() => void saveLifestyle()}
          onCancel={() => setEditingLifestyle(false)}
        />
        {editingLifestyle ? (
          <>
            <View style={{ flexDirection: "row", gap: 16 }}>
              <View style={{ flex: 1 }}>
                <EditText label="Daily exercise (minutes)" value={lExerciseMins} onChange={setLExerciseMins} placeholder="e.g. 45" keyboardType="numeric" />
                <EditSelect label="Backyard access" value={lBackyard} onChange={setLBackyard}
                  options={[{ label: "Yes", value: "true" }, { label: "No", value: "false" }]} />
              </View>
              <View style={{ flex: 1 }}>
                <EditSelect label="Living situation" value={lLivingSituation} onChange={setLLivingSituation}
                  options={[
                    { label: "House with yard", value: "House with yard" },
                    { label: "House without yard", value: "House without yard" },
                    { label: "Apartment", value: "Apartment" },
                    { label: "Farm / rural property", value: "Farm / rural property" },
                    { label: "Other", value: "Other" },
                  ]} />
                <EditSelect label="Training level" value={lTrainingLevel} onChange={setLTrainingLevel}
                  options={[
                    { label: "None", value: "None" },
                    { label: "Basic (sit, stay)", value: "Basic (sit, stay)" },
                    { label: "Intermediate", value: "Intermediate" },
                    { label: "Advanced", value: "Advanced" },
                    { label: "Professional / working dog", value: "Professional / working dog" },
                  ]} />
              </View>
            </View>
            <EditText label="Exercise types" value={lExerciseTypes} onChange={setLExerciseTypes} placeholder="e.g. On-leash walks, off-leash park, swimming" />
            <EditText label="Temperament" value={lTemperament} onChange={setLTemperament} placeholder="e.g. Friendly, anxious around strangers" />
            <EditText label="Other pets in household" value={lOtherPets} onChange={setLOtherPets} placeholder="e.g. 1 cat, 1 other dog" />
          </>
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: 16 }}>
              <View style={{ flex: 1 }}>
                <Field label="Daily exercise (minutes)" value={pet.exercise_duration_mins != null ? `${pet.exercise_duration_mins} mins` : null} c={c} />
                <Field label="Backyard access" value={pet.backyard_access === true ? "Yes" : pet.backyard_access === false ? "No" : null} c={c} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Living situation" value={pet.living_situation} c={c} />
                <Field label="Training level" value={pet.training_level} c={c} />
              </View>
            </View>
            <Field label="Exercise types" value={pet.exercise_types} c={c} />
            <Field label="Temperament" value={pet.temperament} c={c} />
            <Field label="Other pets in household" value={pet.other_pets} c={c} />
          </>
        )}
      </View>
      </FadeIn>

      {/* Ownership */}
      <FadeIn go={cardsGo} delay={480}>
      <View style={card}>
        <EditCardHeader
          title="Ownership"
          editing={editingOwnership}
          saving={savingOwnership}
          onEdit={() => { if (pet) seedOwnershipFields(pet); setEditingOwnership(true); }}
          onSave={() => void saveOwnership()}
          onCancel={() => setEditingOwnership(false)}
        />
        {editingOwnership ? (
          <>
            <EditSelect label="Acquisition source" value={oAcquisition} onChange={setOAcquisition}
              options={[
                { label: "Registered breeder", value: "Registered breeder" },
                { label: "Rescue / shelter", value: "Rescue / shelter" },
                { label: "Pet shop", value: "Pet shop" },
                { label: "Private sale", value: "Private sale" },
                { label: "Stray / found", value: "Stray / found" },
                { label: "Gift", value: "Gift" },
                { label: "Other", value: "Other" },
              ]} />
            <EditSelectSearch
              label="Pet insurance provider"
              value={oInsurance}
              onChange={(v) => {
                setOInsurance(v);
                if (v === "" || v === "None") { setOPolicyNumber(""); }
                if (v !== "Other") { setOCustomInsurance(""); }
                // Gentle nudge to guide the user toward the now-visible policy field.
                if (v !== "" && v !== "None") {
                  setTimeout(() => { scrollRef.current?.scrollToPosition?.(0, scrollY.current + 110, true); }, 150);
                }
              }}
              options={["None", ...providerList, "Other"]}
              placeholder="Select insurance provider"
            />
            {oInsurance === "Other" ? (
              <EditText label="Insurance provider name" value={oCustomInsurance} onChange={setOCustomInsurance} placeholder="Please specify" />
            ) : null}
            {oInsurance !== "" && oInsurance !== "None" ? (
              <EditText label="Policy number" value={oPolicyNumber} onChange={setOPolicyNumber} placeholder="e.g. POL-123456" />
            ) : null}
          </>
        ) : (
          <>
            <Field label="Acquisition source" value={pet.acquisition_source} c={c} />
            <Field label="Pet insurance provider" value={pet.insurance_provider} c={c} />
            <Field label="Policy number" value={pet.insurance_policy_number} c={c} />
          </>
        )}
      </View>
      </FadeIn>

      {/* Prescriptions */}
      <FadeIn go={cardsGo} delay={560}>
      <View style={card}>
        <Text style={sectionHeading}>Prescriptions</Text>
        {prescriptions.length === 0 ? (
          <Text style={{ fontSize: 15, color: c.subtext }}>No prescriptions on file</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {[...activePrescriptions, ...pastPrescriptions].map((rx) => {
              const isActive = (rx.status ?? "").toLowerCase() === "active";
              return (
                <View key={rx.id} style={{ backgroundColor: c.cardInner, borderRadius: 12, padding: 14, opacity: isActive ? 1 : 0.6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: c.text }}>{rx.medication_name}</Text>
                    {isActive ? (
                      <View style={{ backgroundColor: "#10b981", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>Active</Text>
                      </View>
                    ) : (
                      <View style={{ backgroundColor: c.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: c.subtext }}>{rx.status ? rx.status.charAt(0).toUpperCase() + rx.status.slice(1) : "—"}</Text>
                      </View>
                    )}
                  </View>
                  {rx.dosage ? <Text style={{ fontSize: 13, color: c.subtext, marginTop: 3 }}>{rx.dosage}{rx.frequency ? ` · ${rx.frequency}` : ""}</Text> : null}
                  {rx.prescribed_by_name ? <Text style={{ fontSize: 13, color: c.muted, marginTop: 3 }}>Prescribed by {rx.prescribed_by_name}</Text> : null}
                  {(rx.start_date || rx.end_date) ? <Text style={{ fontSize: 13, color: c.muted, marginTop: 3 }}>{rx.start_date ? formatDate(rx.start_date) : "—"}{rx.end_date ? ` → ${formatDate(rx.end_date)}` : ""}</Text> : null}
                  {rx.repeats_remaining != null ? <Text style={{ fontSize: 13, color: c.muted, marginTop: 3 }}>{rx.repeats_remaining} repeat{rx.repeats_remaining === 1 ? "" : "s"} remaining</Text> : null}
                  {rx.notes ? <Text style={{ fontSize: 13, color: c.subtext, marginTop: 4, fontStyle: "italic" }}>{rx.notes}</Text> : null}
                  {isActive && rx.purchase_url ? (
                    <TouchableOpacity onPress={() => Linking.openURL(rx.purchase_url!)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 0.75, borderColor: c.border, borderRadius: 8, padding: 8, marginTop: 12 }}>
                      {rx.purchase_image_url ? <Image source={{ uri: rx.purchase_image_url }} style={{ width: 44, height: 44, borderRadius: 4 }} resizeMode="contain" /> : null}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: c.text }}>{rx.purchase_product_name ?? rx.medication_name}</Text>
                        {rx.purchase_price ? <Text style={{ fontSize: 12, color: c.subtext, marginTop: 2 }}>Pet Circle Pharmacy · {rx.purchase_price}</Text> : null}
                      </View>
                      <View style={{ backgroundColor: Colors.brand, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
                        <Text style={{ fontSize: 12, fontWeight: "600", color: "#fff" }}>Buy →</Text>
                      </View>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </View>
      </FadeIn>

    </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
