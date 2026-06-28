import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator, Linking, Modal, Dimensions } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { ImageZoom } from "@likashefqet/react-native-image-zoom";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";

const c = Colors.light;
const BUCKET = "health-documents";

type DocRow = {
  id: string;
  pet_id: string;
  name: string;
  file_url: string;
  file_type: string; // 'image' | 'pdf' | other
  created_at: string;
};

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); }
  catch { return ""; }
}

const fieldLabel = { fontSize: 12, fontWeight: "600" as const, color: c.subtext, marginBottom: 6 };
const inputStyle = {
  backgroundColor: c.cardInner, borderRadius: 10, borderWidth: 0.75, borderColor: c.border,
  paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: c.text,
};

type Pending = { uri: string; type: "image" | "pdf"; fileName: string };

export function HealthDocuments({ petId, ownerId }: { petId: string; ownerId: string }) {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("pet_health_documents")
      .select("*")
      .eq("pet_id", petId)
      .order("created_at", { ascending: false });
    setDocs((data ?? []) as DocRow[]);
    setLoading(false);
  }, [petId]);

  useEffect(() => { void load(); }, [load]);

  const resetForm = () => { setName(""); setPending(null); };

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed", "Please allow photo access."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setPending({ uri: result.assets[0].uri, type: "image", fileName: result.assets[0].fileName || "photo.jpg" });
  };

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Camera access needed", "Please allow camera access."); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setPending({ uri: result.assets[0].uri, type: "image", fileName: "photo.jpg" });
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const isPdf = (asset.mimeType || "").includes("pdf") || asset.name.toLowerCase().endsWith(".pdf");
    setPending({ uri: asset.uri, type: isPdf ? "pdf" : "image", fileName: asset.name || "document" });
  };

  const uploadFile = async (p: Pending): Promise<string | null> => {
    try {
      const base64 = await FileSystem.readAsStringAsync(p.uri, { encoding: FileSystem.EncodingType.Base64 });
      const arrayBuffer = decode(base64);
      const ext = p.type === "pdf" ? "pdf" : (p.fileName.split(".").pop() || "jpg").split("?")[0].toLowerCase();
      const contentType = p.type === "pdf" ? "application/pdf" : (ext === "png" ? "image/png" : "image/jpeg");
      const path = `docs/${petId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, { upsert: true, contentType });
      if (error) return null;
      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return publicUrl;
    } catch { return null; }
  };

  const save = async () => {
    if (!name.trim()) { Alert.alert("Add a name", "Please give this document a name."); return; }
    if (!pending) { Alert.alert("Add a file", "Please choose a photo or document to upload."); return; }
    setSaving(true);
    try {
      const url = await uploadFile(pending);
      if (!url) { Alert.alert("Upload failed", "Couldn't upload the file. Please try again."); setSaving(false); return; }
      const { error } = await supabase.from("pet_health_documents").insert({
        pet_id: petId, owner_id: ownerId, name: name.trim(), file_url: url, file_type: pending.type,
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
    <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 28, marginBottom: open || docs.length > 0 ? 12 : 0 }}>
        <Text style={{ fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, color: c.subtext }}>Health Documents</Text>
        {!open ? (
          <TouchableOpacity onPress={() => setOpen(true)} style={{ paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999, borderWidth: 0.75, borderColor: c.border }}>
            <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>+ Add</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Add form */}
      {open ? (
        <View style={{ marginBottom: docs.length > 0 ? 16 : 0 }}>
          <Text style={fieldLabel}>Document name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="e.g. Rabies vaccination 2025" placeholderTextColor={c.muted} style={inputStyle} />

          <Text style={[fieldLabel, { marginTop: 12 }]}>File</Text>
          {pending ? (
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: c.cardInner, borderRadius: 10, padding: 10, marginBottom: 8 }}>
              {pending.type === "image" ? (
                <Image source={{ uri: pending.uri }} style={{ width: 44, height: 44, borderRadius: 6, marginRight: 10 }} />
              ) : (
                <View style={{ width: 44, height: 44, borderRadius: 6, marginRight: 10, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>PDF</Text>
                </View>
              )}
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: c.text }}>{pending.fileName}</Text>
              <TouchableOpacity onPress={() => setPending(null)} style={{ marginLeft: 8, width: 24, height: 24, borderRadius: 999, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>×</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={pickFromLibrary} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 0.75, borderColor: c.border, alignItems: "center" }}>
              <Text style={{ color: c.text, fontSize: 12, fontWeight: "600" }}>Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={pickFromCamera} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 0.75, borderColor: c.border, alignItems: "center" }}>
              <Text style={{ color: c.text, fontSize: 12, fontWeight: "600" }}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={pickDocument} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 0.75, borderColor: c.border, alignItems: "center" }}>
              <Text style={{ color: c.text, fontSize: 12, fontWeight: "600" }}>File / PDF</Text>
            </TouchableOpacity>
          </View>

          {/* Save — prominent primary action */}
          <TouchableOpacity onPress={() => void save()} disabled={saving} activeOpacity={0.85} style={{ marginTop: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: "#10b981", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}>
            {saving ? <ActivityIndicator color="#fff" /> : (
              <>
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>Save document</Text>
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>→</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { resetForm(); setOpen(false); }} disabled={saving} style={{ marginTop: 8, paddingVertical: 10, borderRadius: 10, borderWidth: 0.75, borderColor: c.border, alignItems: "center" }}>
            <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Document list */}
      {loading ? (
        <ActivityIndicator color={Colors.brand} style={{ marginTop: 8 }} />
      ) : docs.length === 0 && !open ? (
        <Text style={{ fontSize: 14, color: c.subtext, marginTop: 12 }}>No documents yet. Add vaccination certificates, reports, and letters here.</Text>
      ) : (
        <View style={{ gap: 8 }}>
          {docs.map(d => (
            <TouchableOpacity
              key={d.id}
              activeOpacity={0.8}
              onPress={() => {
                if (d.file_type === "image") setViewerUrl(d.file_url);
                else Linking.openURL(d.file_url);
              }}
              style={{ flexDirection: "row", alignItems: "center", backgroundColor: c.cardInner, borderRadius: 10, padding: 10 }}
            >
              {d.file_type === "image" ? (
                <Image source={{ uri: d.file_url }} style={{ width: 44, height: 44, borderRadius: 6, marginRight: 10 }} />
              ) : (
                <View style={{ width: 44, height: 44, borderRadius: 6, marginRight: 10, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>PDF</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: c.text }} numberOfLines={1}>{d.name}</Text>
                <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>{formatDate(d.created_at)}</Text>
              </View>
              <Text style={{ fontSize: 18, color: c.muted, marginLeft: 6 }}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Fullscreen image viewer */}
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
            <TouchableOpacity onPress={() => setViewerUrl(null)} style={{ position: "absolute", top: 56, right: 20, width: 38, height: 38, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 22, fontWeight: "600", lineHeight: 24 }}>×</Text>
            </TouchableOpacity>
          </View>
        </GestureHandlerRootView>
      </Modal>
    </View>
  );
}
