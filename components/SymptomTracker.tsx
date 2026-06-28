import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, Alert, ActivityIndicator, Modal, Dimensions, LayoutAnimation, Platform, UIManager } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { ImageZoom } from "@likashefqet/react-native-image-zoom";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const c = Colors.light;
const BUCKET = "symptom-photos";

type SymptomRow = {
  id: string;
  pet_id: string;
  name: string;
  notes: string | null;
  photo_urls: string[] | null;
  created_at: string;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch { return ""; }
}

const sectionHeading = { fontSize: 13, fontWeight: "700" as const, textTransform: "uppercase" as const, letterSpacing: 0.6, color: c.subtext };
const fieldLabel = { fontSize: 12, fontWeight: "600" as const, color: c.subtext, marginBottom: 6 };
const inputStyle = {
  backgroundColor: c.cardInner, borderRadius: 10, borderWidth: 0.75, borderColor: c.border,
  paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: c.text,
};

export function SymptomTracker({ petId, ownerId }: { petId: string; ownerId: string }) {
  const [symptoms, setSymptoms] = useState<SymptomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);        // inline form open
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [photoUris, setPhotoUris] = useState<string[]>([]); // local URIs before upload
  const [saving, setSaving] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null); // fullscreen photo viewer
  const [historyOpen, setHistoryOpen] = useState(false); // expand to show all symptoms

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("pet_symptoms")
      .select("*")
      .eq("pet_id", petId)
      .order("created_at", { ascending: false });
    setSymptoms((data ?? []) as SymptomRow[]);
    setLoading(false);
  }, [petId]);

  useEffect(() => { void load(); }, [load]);

  const resetForm = () => { setName(""); setNotes(""); setPhotoUris([]); };

  const addFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed", "Please allow photo access to attach a photo."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.8,
    });
    if (result.canceled) return;
    const uris = (result.assets ?? []).map(a => a.uri).filter(Boolean);
    setPhotoUris(prev => [...prev, ...uris]);
  };

  const addFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Camera access needed", "Please allow camera access to take a photo."); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setPhotoUris(prev => [...prev, result.assets[0].uri]);
  };

  const removePhoto = (uri: string) => setPhotoUris(prev => prev.filter(u => u !== uri));

  const uploadOne = async (uri: string): Promise<string | null> => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const arrayBuffer = decode(base64);
      const ext = (uri.split(".").pop() || "jpg").split("?")[0].toLowerCase();
      const contentType = ext === "png" ? "image/png" : "image/jpeg";
      const path = `symptoms/${petId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, { upsert: true, contentType });
      if (error) return null;
      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return publicUrl;
    } catch { return null; }
  };

  const save = async () => {
    if (!name.trim()) { Alert.alert("Add a name", "Please give this symptom a short name."); return; }
    setSaving(true);
    try {
      // Upload any photos first
      const urls: string[] = [];
      for (const uri of photoUris) {
        const url = await uploadOne(uri);
        if (url) urls.push(url);
      }
      const { error } = await supabase.from("pet_symptoms").insert({
        pet_id: petId, owner_id: ownerId, name: name.trim(), notes: notes.trim() || null, photo_urls: urls,
      });
      if (error) { Alert.alert("Couldn't save", error.message); setSaving(false); return; }
      resetForm();
      setOpen(false);
      await load();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : String(e));
    }
    setSaving(false);
  };

  return (
    <View style={{ backgroundColor: c.card, borderRadius: 16, borderWidth: 0.75, borderColor: c.border, padding: 16 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 28, marginBottom: open || symptoms.length > 0 ? 12 : 0 }}>
        <Text style={sectionHeading}>Symptom Tracker</Text>
        {!open ? (
          <TouchableOpacity onPress={() => setOpen(true)} style={{ paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999, borderWidth: 0.75, borderColor: c.border }}>
            <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>+ Add</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Inline add form */}
      {open ? (
        <View style={{ marginBottom: symptoms.length > 0 ? 16 : 0 }}>
          <Text style={fieldLabel}>Symptom name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="e.g. Limping on right paw" placeholderTextColor={c.muted} style={inputStyle} />

          <Text style={[fieldLabel, { marginTop: 12 }]}>Notes</Text>
          <TextInput value={notes} onChangeText={setNotes} placeholder="Describe what you've noticed…" placeholderTextColor={c.muted} multiline style={[inputStyle, { minHeight: 80, textAlignVertical: "top" }]} />

          <Text style={[fieldLabel, { marginTop: 12 }]}>Photos</Text>
          {photoUris.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {photoUris.map(uri => (
                <View key={uri} style={{ marginRight: 8 }}>
                  <Image source={{ uri }} style={{ width: 72, height: 72, borderRadius: 8 }} />
                  <TouchableOpacity onPress={() => removePhoto(uri)} style={{ position: "absolute", top: -6, right: -6, backgroundColor: "#ef4444", width: 20, height: 20, borderRadius: 999, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          ) : null}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={addFromLibrary} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 0.75, borderColor: c.border, alignItems: "center" }}>
              <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>Choose photo</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={addFromCamera} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 0.75, borderColor: c.border, alignItems: "center" }}>
              <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>Take photo</Text>
            </TouchableOpacity>
          </View>

          {/* Save — prominent primary action */}
          <TouchableOpacity onPress={() => void save()} disabled={saving} activeOpacity={0.85} style={{ marginTop: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: "#10b981", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}>
            {saving ? <ActivityIndicator color="#fff" /> : (
              <>
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>Save symptom</Text>
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>→</Text>
              </>
            )}
          </TouchableOpacity>
          {/* Cancel — matches the photo-button height/style for consistency */}
          <TouchableOpacity onPress={() => { resetForm(); setOpen(false); }} disabled={saving} style={{ marginTop: 8, paddingVertical: 10, borderRadius: 10, borderWidth: 0.75, borderColor: c.border, alignItems: "center" }}>
            <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Timeline of recorded symptoms */}
      {loading ? (
        <ActivityIndicator color={Colors.brand} style={{ marginTop: 8 }} />
      ) : symptoms.length === 0 && !open ? (
        <Text style={{ fontSize: 14, color: c.subtext, marginTop: 12 }}>No symptoms recorded yet. Tap “Add” to start tracking.</Text>
      ) : (
        (() => {
          const shown = historyOpen ? symptoms : symptoms.slice(0, 3);
          return (
            <View>
              {/* Entries — each has a circle aligned to its title, with a connector line
                  segment that fills the rest of that entry's height (handles variable heights). */}
              <View style={{ paddingTop: 4 }}>
                {shown.map((s, i) => {
                  const isLast = i === shown.length - 1;
                  return (
                    <View key={s.id} style={{ flexDirection: "row", gap: 12 }}>
                      {/* Circle column stretches to full row height; line flexes from circle to bottom */}
                      <View style={{ width: 24, alignItems: "center" }}>
                        <View style={{ height: 15 }} />
                        <View style={{ height: 24, width: 24, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ color: Colors.brand, fontSize: 12, fontWeight: "900" }}>✓</Text>
                        </View>
                        {!isLast ? <View style={{ flex: 1, width: 1, backgroundColor: "rgba(255,255,255,0.2)", marginBottom: -15 }} /> : null}
                      </View>
                      {/* Content (carries the inter-entry gap as paddingBottom so the column stretches through it) */}
                      <View style={{ flex: 1, paddingBottom: isLast ? 0 : 18 }}>
                        <Text style={{ fontSize: 11, color: c.muted, marginBottom: 2 }}>{formatDate(s.created_at)}</Text>
                        <Text style={{ fontSize: 15, fontWeight: "700", color: c.text }}>{s.name}</Text>
                        {s.notes ? <Text style={{ fontSize: 14, color: c.subtext, marginTop: 2, lineHeight: 20 }}>{s.notes}</Text> : null}
                        {s.photo_urls && s.photo_urls.length > 0 ? (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                            {s.photo_urls.map(url => (
                              <TouchableOpacity key={url} onPress={() => setViewerUrl(url)} activeOpacity={0.85}>
                                <Image source={{ uri: url }} style={{ width: 80, height: 80, borderRadius: 8, marginRight: 8 }} />
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>

          {/* Expand / collapse when there are more than 3 */}
          {symptoms.length > 3 ? (
            <TouchableOpacity
              onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setHistoryOpen(o => !o); }}
              activeOpacity={0.7}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginHorizontal: -16, paddingHorizontal: 16, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: c.subtext }}>
                {historyOpen ? "Show less" : `Show ${symptoms.length - 3} more`}
              </Text>
              <Text style={{ fontSize: 12, color: c.muted }}>{historyOpen ? "▲" : "▼"}</Text>
            </TouchableOpacity>
          ) : null}
            </View>
          );
        })()
      )}

      {/* Fullscreen photo viewer */}
      <Modal visible={viewerUrl !== null} transparent animationType="fade" onRequestClose={() => setViewerUrl(null)}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" }}>
            {viewerUrl ? (
              <ImageZoom
                uri={viewerUrl}
                style={{ width: Dimensions.get("window").width, height: Dimensions.get("window").height * 0.8 }}
                resizeMode="contain"
                minScale={1}
                maxScale={5}
                doubleTapScale={2.5}
                isDoubleTapEnabled
              />
            ) : null}
            <TouchableOpacity
              onPress={() => setViewerUrl(null)}
              style={{ position: "absolute", top: 56, right: 20, width: 38, height: 38, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: "#fff", fontSize: 22, fontWeight: "600", lineHeight: 24 }}>×</Text>
            </TouchableOpacity>
          </View>
        </GestureHandlerRootView>
      </Modal>
    </View>
  );
}
