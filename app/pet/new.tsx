import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Image, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EditText, EditDate, EditSelect, EditNumberStepper } from "@/components/EditFields";
import { VenomCodePicker } from "@/components/VenomCodePicker";
import { FRIENDLY_SPECIES, friendlySpeciesByLabel } from "@/lib/speciesMapping";

const c = Colors.light;
const PET_PHOTOS_BUCKET = "pet-photos";
const SEX_OPTIONS = ["Female desexed", "Female intact", "Male neutered", "Male intact"];

export default function NewPetScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [speciesCode, setSpeciesCode] = useState("");
  const [breed, setBreed] = useState("");
  const [breedCode, setBreedCode] = useState("");
  const [sex, setSex] = useState("");
  const [dob, setDob] = useState("");
  const [weight, setWeight] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const speciesInfo = friendlySpeciesByLabel(species);
  const hasBreedList = !!speciesInfo?.hasBreeds;
  const breedLabel = species === "Fish" || species === "Bird" || species === "Reptile" ? "Species/Type" : "Breed";

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed", "Please allow photo access to add a pet photo."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (!result.canceled && result.assets?.[0]?.uri) setPhotoUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert("Required", "Pet name is required."); return; }
    if (!species) { Alert.alert("Required", "Species is required."); return; }
    if (!breed.trim()) { Alert.alert("Required", `${breedLabel} is required.`); return; }
    if (!sex) { Alert.alert("Required", "Sex is required."); return; }
    if (!dob) { Alert.alert("Required", "Date of birth is required."); return; }
    if (!userId) { Alert.alert("Not signed in", "Please sign in again."); return; }
    setSaving(true);

    try {
      const { data: petData, error: petErr } = await supabase.from("pets").insert({
        owner_id: userId,
        name: name.trim(),
        species: species || null,
        species_code: speciesCode || null,
        breed: breed.trim() || null,
        breed_code: breedCode || null,
        sex: sex || null,
        date_of_birth: dob || null,
      }).select("id").single();

      if (petErr || !petData) throw petErr ?? new Error("Failed to create pet");
      const petId = (petData as { id: string }).id;

      // Initial weight becomes the first longitudinal observation (not a column on pets).
      if (weight && parseFloat(weight) > 0) {
        await supabase.from("pet_weights").insert({
          pet_id: petId,
          owner_id: userId,
          weight_kg: parseFloat(weight),
          recorded_at: new Date().toISOString(),
          source: "owner",
          confidence: "reported",
        });
      }

      // Photo upload is best-effort — the pet is created regardless.
      if (photoUri) {
        try {
          const base64 = await FileSystem.readAsStringAsync(photoUri, { encoding: FileSystem.EncodingType.Base64 });
          const arrayBuffer = decode(base64);
          const ext = (photoUri.split(".").pop() || "jpg").split("?")[0].toLowerCase();
          const contentType = ext === "png" ? "image/png" : "image/jpeg";
          const path = `pets/${petId}/profile_${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage.from(PET_PHOTOS_BUCKET).upload(path, arrayBuffer, { upsert: true, contentType });
          if (!upErr) {
            const { data: { publicUrl } } = supabase.storage.from(PET_PHOTOS_BUCKET).getPublicUrl(path);
            await supabase.from("pets").update({ photo_url: publicUrl }).eq("id", petId);
          } else {
            Alert.alert("Photo upload failed", `Reason: ${upErr.message}`);
          }
        } catch (e) {
          Alert.alert("Photo upload error", e instanceof Error ? e.message : String(e));
        }
      }

      router.replace(`/pet/${petId}`);
    } catch (err) {
      setSaving(false);
      Alert.alert("Couldn't create pet", err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const labelStyle = { fontSize: 12, fontWeight: "600" as const, color: c.subtext, marginBottom: 6 };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader title="Add a pet" />
      <KeyboardAwareScrollView
        style={{ flex: 1, backgroundColor: c.bg }}
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={24}
      >
        {/* Photo */}
        <View style={{ alignItems: "center", marginBottom: 20 }}>
          <TouchableOpacity onPress={pickPhoto} style={{ width: 140, height: 140, borderRadius: 70, borderWidth: 3, borderColor: c.border, borderStyle: "dashed", backgroundColor: c.card, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            ) : (
              <Text style={{ color: c.subtext, fontSize: 13, textAlign: "center", paddingHorizontal: 12 }}>Tap to add{"\n"}a photo</Text>
            )}
          </TouchableOpacity>
          {photoUri ? (
            <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
              <TouchableOpacity onPress={pickPhoto}><Text style={{ color: c.subtext, fontSize: 13, fontWeight: "600" }}>Change photo</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setPhotoUri(null)}><Text style={{ color: c.muted, fontSize: 13 }}>Remove</Text></TouchableOpacity>
            </View>
          ) : (
            <Text style={{ color: c.muted, fontSize: 12, textAlign: "center", marginTop: 8, paddingHorizontal: 20 }}>Choose a photo, then drag and pinch to position your pet within the square frame.</Text>
          )}
        </View>

        <View style={styles.card}>
          <EditText label="Pet name *" value={name} onChange={setName} placeholder="e.g. Bella" />

          <EditSelect label="Species *" value={species}
            onChange={(label) => {
              const info = friendlySpeciesByLabel(label);
              setSpecies(label);
              setSpeciesCode(info?.code ?? "");
              setBreed(""); setBreedCode(""); // reset breed on species change
            }}
            options={FRIENDLY_SPECIES.map(s => ({ label: s.label, value: s.label }))} />

          {species ? (
            hasBreedList && speciesInfo?.code ? (
              <VenomCodePicker
                label={`${breedLabel} *`}
                category="breed"
                parentCode={speciesInfo.code}
                value={breed}
                onPick={(pick) => { setBreed(pick?.display_text ?? ""); setBreedCode(pick?.code ?? ""); }}
                placeholder={`Search ${breedLabel.toLowerCase()}…`}
              />
            ) : (
              <EditText label={`${breedLabel} *`} value={breed} onChange={(v) => { setBreed(v); setBreedCode(""); }} placeholder={`Enter ${breedLabel.toLowerCase()}`} />
            )
          ) : null}

          <EditSelect label="Sex *" value={sex} onChange={setSex}
            options={SEX_OPTIONS.map(s => ({ label: s, value: s }))} />

          <EditDate label="Date of birth *" value={dob} onChange={setDob} />

          <EditNumberStepper label="Weight (kg)" value={weight} onChange={setWeight} placeholder="e.g. 12.5" step={0.1} unit="kg" />
        </View>

        <TouchableOpacity onPress={() => void handleSave()} disabled={saving}
          style={{ backgroundColor: Colors.brand, borderRadius: 999, paddingVertical: 15, alignItems: "center", marginTop: 20, opacity: saving ? 0.7 : 1 }}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Create pet profile</Text>}
        </TouchableOpacity>
        <Text style={{ color: c.muted, fontSize: 12, textAlign: "center", marginTop: 10 }}>* Required</Text>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: c.card, borderRadius: 12, borderWidth: 0.75, borderColor: c.border, padding: 16 },
});
