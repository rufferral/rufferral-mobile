import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "expo-router";
import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, ActivityIndicator, Modal, Dimensions, Animated, Easing, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { ImageZoom } from "@likashefqet/react-native-image-zoom";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";
import { EditDate } from "@/components/EditFields";
import { loadPetTimeline, KIND_META, type TimelineEvent, type TimelineEventKind } from "@/lib/petTimeline";
import { TimelineIcon, HAS_SVG_ICON } from "@/components/TimelineIcon";

const c = Colors.light;
const COLLAPSED_COUNT = 6;

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); }
  catch { return ""; }
}

// Today's date as YYYY-MM-DD (local).
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Convert a YYYY-MM-DD date to an ISO timestamp at local noon (avoids timezone day-shift).
function dateToIso(ymd: string): string {
  if (!ymd) return new Date().toISOString();
  return new Date(ymd + "T12:00:00").toISOString();
}

const ALL_KINDS: TimelineEventKind[] = ["weight", "symptom", "condition", "vaccination", "medication", "referral", "birthday"];
// Event types the owner can ADD from the timeline (referrals are created via the vet flow, not here).
const ADDABLE: TimelineEventKind[] = ["weight", "symptom", "condition", "vaccination", "medication"];
const BUCKET = "symptom-photos";

export function PetTimeline({ petId, ownerId, dateOfBirth, petName, onRequestScrollTo }: { petId: string; ownerId: string; dateOfBirth?: string | null; petName?: string | null; onRequestScrollTo?: (y: number) => void }) {
  const router = useRouter();
  const cardY = useRef(0);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<TimelineEventKind | null>(null); // null = all
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  // Expand/collapse choreography.
  //  Expand:   drawLine (line grows from last visible circle to tab) → grow (card) → fade-in rows
  //  Collapse: fade-out rows together → shrink (card)
  const [animPhase, setAnimPhase] = useState<"idle" | "drawing" | "growing" | "shrinking" | "fadingOut">("idle");
  const drawAnim = useRef(new Animated.Value(0)).current;   // pre-grow line segment height 0→1
  const rowsOpacity = useRef(new Animated.Value(1)).current; // 1=visible; animates to 0 on collapse fade-out
  const DRAW_GAP = 48; // px: last visible circle → first reveal circle (with -15 margin into spacer)

  // Add-event state
  const [adding, setAdding] = useState(false);                 // panel open
  const [addKind, setAddKind] = useState<TimelineEventKind | null>(null); // chosen type
  const [saving, setSaving] = useState(false);
  // Shared/simple fields reused across the forms
  const [fName, setFName] = useState("");        // symptom name / diagnosis text / vaccine / medication name
  const [fNotes, setFNotes] = useState("");      // notes
  const [fNum, setFNum] = useState("");          // weight kg / dose value
  const [fUnit, setFUnit] = useState("");        // dose unit
  const [fProduct, setFProduct] = useState("");  // vaccine product / medication product
  const [fPhotos, setFPhotos] = useState<string[]>([]);
  const [fDate, setFDate] = useState(todayStr()); // event date (YYYY-MM-DD), defaults to today

  const load = useCallback(async () => {
    setLoading(true);
    const evts = await loadPetTimeline(petId, dateOfBirth, petName);
    setEvents(evts);
    setLoading(false);
  }, [petId, dateOfBirth]);

  useEffect(() => { void load(); }, [load]);

  const resetForm = () => { setFName(""); setFNotes(""); setFNum(""); setFUnit(""); setFProduct(""); setFPhotos([]); setFDate(todayStr()); };
  const closeAdd = () => { setAdding(false); setAddKind(null); resetForm(); };

  const addFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed", "Please allow photo access."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.8 });
    if (result.canceled) return;
    setFPhotos(prev => [...prev, ...(result.assets ?? []).map(a => a.uri).filter(Boolean)]);
  };
  const addFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Camera access needed", "Please allow camera access."); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setFPhotos(prev => [...prev, result.assets[0].uri]);
  };
  const uploadPhoto = async (uri: string): Promise<string | null> => {
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
    const now = new Date().toISOString();
    const eventIso = dateToIso(fDate);   // the date the event happened (owner-selectable)
    const base = { pet_id: petId, owner_id: ownerId, source: "owner", confidence: "reported" as const };
    try {
      if (addKind === "weight") {
        const kg = parseFloat(fNum.replace(",", "."));
        if (!(kg > 0)) { Alert.alert("Enter a weight", "Please enter a weight in kg."); return; }
        setSaving(true);
        const { error } = await supabase.from("pet_weights").insert({ ...base, weight_kg: kg, recorded_at: eventIso });
        if (error) throw error;
      } else if (addKind === "symptom") {
        if (!fName.trim()) { Alert.alert("Add a name", "Please give this symptom a short name."); return; }
        setSaving(true);
        const urls: string[] = [];
        for (const uri of fPhotos) { const u = await uploadPhoto(uri); if (u) urls.push(u); }
        const { error } = await supabase.from("pet_observations").insert({ ...base, kind: "symptom", display_text: fName.trim(), code_system: null, code: null, notes: fNotes.trim() || null, photo_urls: urls, observed_at: eventIso });
        if (error) throw error;
      } else if (addKind === "condition") {
        if (!fName.trim()) { Alert.alert("Add a diagnosis", "Please enter the diagnosis or allergy."); return; }
        setSaving(true);
        const { error } = await supabase.from("pet_conditions").insert({ ...base, code_system: null, code: null, display_text: fName.trim(), category: "diagnosis", status: "active", onset_at: eventIso, recorded_at: now });
        if (error) throw error;
      } else if (addKind === "vaccination") {
        if (!fName.trim()) { Alert.alert("Add a vaccination", "Please enter the vaccination."); return; }
        setSaving(true);
        const { error } = await supabase.from("pet_vaccinations").insert({ ...base, code_system: null, code: null, display_text: fName.trim(), product: fProduct.trim() || null, administered_at: eventIso, recorded_at: now });
        if (error) throw error;
      } else if (addKind === "medication") {
        if (!fName.trim()) { Alert.alert("Add a medication", "Please enter the medication."); return; }
        setSaving(true);
        const dose = fNum ? parseFloat(fNum.replace(",", ".")) : null;
        const { error } = await supabase.from("pet_medications").insert({ ...base, code_system: null, code: null, display_text: fName.trim(), dose_value: dose, dose_unit: fUnit.trim() || null, started_at: eventIso, recorded_at: now });
        if (error) throw error;
      }
      closeAdd();
      await load();
    } catch (e) {
      Alert.alert("Couldn't save", e instanceof Error ? e.message : String(e));
    }
    setSaving(false);
  };

  const filtered = filter ? events.filter(e => e.kind === filter) : events;
  const baseRows = filtered.slice(0, COLLAPSED_COUNT);
  const revealRows = filtered.slice(COLLAPSED_COUNT);

  // Renders a single timeline row. `showLine` controls the downward connector
  // line. `animatedLine` makes it an animated draw (for the last visible row on expand).
  const renderRow = (e: TimelineEvent, globalIdx: number, isLast: boolean, showLine?: boolean, animatedLine?: boolean) => {
    const meta = KIND_META[e.kind];
    const onCircle = meta.color === "#ffffff" ? Colors.brand : "#ffffff";
    const drawLine = showLine !== undefined ? showLine : !isLast;
    const hasExtra = !!(e.subtitle || (e.photoUrls && e.photoUrls.length > 0) || (e.kind === "referral" && e.referralId));
    const railTopSpacer = hasExtra ? 15 : 4; // shorter spacer for two-line events (date + title only)
    return (
      <View key={e.id} style={{ flexDirection: "row", gap: 12 }}>
        {/* Rail: glyph circle + connector line */}
        <View style={{ width: 28, alignItems: "center" }}>
          <View style={{ height: railTopSpacer }} />
          <View style={{ height: 28, width: 28, borderRadius: 14, backgroundColor: meta.color, alignItems: "center", justifyContent: "center" }}>
            {HAS_SVG_ICON[e.kind] ? (
              <TimelineIcon kind={e.kind} size={28} color={onCircle} />
            ) : (
              <Text style={{ color: onCircle, fontSize: 14, fontWeight: "900" }}>{meta.glyph}</Text>
            )}
          </View>
          {animatedLine ? (
            <Animated.View pointerEvents="none" style={{
              width: 1, backgroundColor: "rgba(255,255,255,0.2)", marginBottom: -15,
              height: (expanded && animPhase !== "drawing")
                ? DRAW_GAP
                : drawAnim.interpolate({ inputRange: [0, 1], outputRange: [0, DRAW_GAP] }),
            }} />
          ) : drawLine ? (
            <View style={{ flex: 1, width: 1, backgroundColor: "rgba(255,255,255,0.2)", marginBottom: -15 }} />
          ) : null}
        </View>
        {/* Content */}
        <View style={{ flex: 1, paddingBottom: isLast ? 0 : 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <Text style={{ fontSize: 11, color: c.muted }}>{formatDate(e.date)}</Text>
            <View style={{ backgroundColor: meta.color === "#ffffff" ? c.cardInner : meta.color, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1.5 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: meta.color === "#ffffff" ? c.subtext : "#ffffff" }}>{meta.label}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 15, fontWeight: "700", color: c.text }}>{e.title}</Text>
          {e.subtitle ? <Text style={{ fontSize: 14, color: c.subtext, marginTop: 2, lineHeight: 20 }}>{e.subtitle}</Text> : null}

          {/* Referral: mini progress bar + navigate button */}
          {e.kind === "referral" && e.referralId ? (
            <View style={{ marginTop: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <View style={{ backgroundColor: e.progressColor ?? c.cardInner, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1.5 }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#ffffff" }}>{e.statusLabel ?? "In progress"}</Text>
                </View>
                <Text style={{ fontSize: 11, color: c.muted }}>{e.progressPercent ?? 0}%</Text>
              </View>
              <View style={{ height: 6, borderRadius: 999, backgroundColor: c.cardInner, overflow: "hidden" }}>
                <View style={{ height: "100%", width: `${e.progressPercent ?? 0}%`, borderRadius: 999, backgroundColor: e.progressColor ?? Colors.brand }} />
              </View>
              <TouchableOpacity
                onPress={() => router.push(`/referral/${e.referralId}`)}
                activeOpacity={0.8}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10, paddingVertical: 9, borderRadius: 10, borderWidth: 0.75, borderColor: c.border }}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: c.text }}>View referral journey</Text>
                <Text style={{ fontSize: 13, color: c.subtext }}>→</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {e.photoUrls && e.photoUrls.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {e.photoUrls.map(url => (
                <TouchableOpacity key={url} onPress={() => setViewerUrl(url)} activeOpacity={0.85}>
                  <Image source={{ uri: url }} style={{ width: 72, height: 72, borderRadius: 8, marginRight: 8 }} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
          {e.source && e.source !== "owner" ? (
            <Text style={{ fontSize: 11, color: Colors.brand, marginTop: 3, fontWeight: "600" }}>✓ Clinic-verified</Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View
      onLayout={(e) => { cardY.current = e.nativeEvent.layout.y; }}
      style={{ backgroundColor: c.card, borderRadius: 16, borderWidth: 0.75, borderColor: c.border, padding: 16 }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 28, marginBottom: 12 }}>
        <Text style={{ fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, color: c.subtext }}>Lifetime Timeline</Text>
        {!adding ? (
          <TouchableOpacity onPress={() => setAdding(true)} activeOpacity={0.8}
            style={{ paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999, borderWidth: 0.75, borderColor: c.border }}>
            <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>Add +</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Inline add panel */}
      {adding ? (
        <View style={{ marginBottom: 16, backgroundColor: c.cardInner, borderRadius: 12, padding: 14 }}>
          {!addKind ? (
            <>
              <Text style={{ fontSize: 13, fontWeight: "600", color: c.text, marginBottom: 10 }}>What would you like to add?</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {ADDABLE.map(k => (
                  <TouchableOpacity key={k} onPress={() => setAddKind(k)} activeOpacity={0.8}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 0.75, borderColor: c.border }}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: KIND_META[k].color, alignItems: "center", justifyContent: "center" }}>
                      {HAS_SVG_ICON[k] ? (
                        <TimelineIcon kind={k} size={20} color={KIND_META[k].color === "#ffffff" ? Colors.brand : "#fff"} />
                      ) : (
                        <Text style={{ color: KIND_META[k].color === "#ffffff" ? Colors.brand : "#fff", fontSize: 11, fontWeight: "900" }}>{KIND_META[k].glyph}</Text>
                      )}
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: c.text }}>{KIND_META[k].label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity onPress={closeAdd} style={{ marginTop: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 0.75, borderColor: c.border, alignItems: "center" }}>
                <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <AddForm
              kind={addKind}
              fName={fName} setFName={setFName}
              fNotes={fNotes} setFNotes={setFNotes}
              fNum={fNum} setFNum={setFNum}
              fUnit={fUnit} setFUnit={setFUnit}
              fProduct={fProduct} setFProduct={setFProduct}
              fDate={fDate} setFDate={setFDate}
              fPhotos={fPhotos} removePhoto={(u) => setFPhotos(prev => prev.filter(x => x !== u))}
              addFromLibrary={addFromLibrary} addFromCamera={addFromCamera}
              saving={saving} onSave={() => void save()} onBack={() => { setAddKind(null); resetForm(); }}
            />
          )}
        </View>
      ) : null}

      {/* Filter chips */}
      {events.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14, marginHorizontal: -2 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 2 }}>
          <Chip label="All" active={filter === null} onPress={() => setFilter(null)} color={c.text} />
          {ALL_KINDS.map(k => (
            <Chip key={k} label={KIND_META[k].label} active={filter === k} onPress={() => setFilter(filter === k ? null : k)} color={KIND_META[k].color} />
          ))}
        </ScrollView>
      ) : null}

      {loading ? (
        <ActivityIndicator color={Colors.brand} style={{ marginTop: 8 }} />
      ) : filtered.length === 0 ? (
        <Text style={{ fontSize: 14, color: c.subtext, marginTop: 4 }}>
          {filter ? "No events of this type yet." : "No events yet. As you add weights, symptoms, vaccinations and more, they'll appear here as a lifetime record."}
        </Text>
      ) : (
        <View>
          {/* Always-visible rows. Last base row's line shows only when expanded
              (so it bridges into the reveal section, not into the Show-more tab). */}
          {baseRows.map((e, i) => {
            const isLastOverall = i === filtered.length - 1;
            const isLastBase = i === baseRows.length - 1;
            if (isLastBase && !isLastOverall) {
              // Last visible row: its downward line is animated (draws to the tab on expand).
              return renderRow(e, i, isLastOverall, false, true);
            }
            return renderRow(e, i, isLastOverall, !isLastOverall);
          })}

          {/* Revealed rows inside a growing container. A continuous connector line
              sits behind them (visible as the card grows); rows fade in on top. */}
          {filtered.length > COLLAPSED_COUNT ? (
            <RevealSection expanded={expanded}>
              {/* Sync-fade layer: on collapse, all rows fade out together via rowsOpacity */}
              <Animated.View style={{ opacity: rowsOpacity }}>
                {revealRows.map((e, idx) => {
                  const globalIdx = COLLAPSED_COUNT + idx;
                  const isLastOverall = globalIdx === filtered.length - 1;
                  return (
                    <FadeInRow key={e.id} delay={Math.max(0, REVEAL_DURATION - 1000) + idx * 90} run={expanded}>
                      {renderRow(e, globalIdx, isLastOverall, !isLastOverall)}
                    </FadeInRow>
                  );
                })}
              </Animated.View>
            </RevealSection>
          ) : null}

          {filtered.length > COLLAPSED_COUNT ? (
            <TouchableOpacity
              onPress={() => {
                if (animPhase !== "idle") return; // ignore taps mid-animation
                if (!expanded) {
                  // EXPAND: draw line (steady/linear) → grow starts just before draw ends → fade rows in
                  setAnimPhase("drawing");
                  drawAnim.setValue(0);
                  Animated.timing(drawAnim, { toValue: 1, duration: 347, easing: Easing.linear, useNativeDriver: false }).start();
                  setTimeout(() => {
                    setExpanded(true);        // triggers RevealSection grow + row fade-in
                    setAnimPhase("growing");
                    setTimeout(() => setAnimPhase("idle"), REVEAL_DURATION);
                  }, 295);
                } else {
                  // COLLAPSE: fade rows out IMMEDIATELY → shrink the instant fade completes
                  setAnimPhase("fadingOut");
                  drawAnim.setValue(0);       // retract the pre-grow line immediately
                  Animated.timing(rowsOpacity, { toValue: 0, duration: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
                    if (!finished) return;
                    setExpanded(false);       // shrink begins the instant fade-out ends
                    setAnimPhase("shrinking");
                    // Track the view up so the card top is back on screen when the shrink ends.
                    onRequestScrollTo?.(Math.max(0, cardY.current - 12));
                    setTimeout(() => { rowsOpacity.setValue(1); setAnimPhase("idle"); }, REVEAL_DURATION + 50);
                  });
                }
              }}
              activeOpacity={0.7}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginHorizontal: -16, paddingHorizontal: 16, marginTop: 7, paddingTop: 14, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: c.subtext }}>
                {expanded ? "Show less" : `Show ${filtered.length - COLLAPSED_COUNT} more`}
              </Text>
              <Text style={{ fontSize: 12, color: c.muted }}>{expanded ? "▲" : "▼"}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* Fullscreen photo viewer (pinch-to-zoom) */}
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

// Fades a row in (opacity 0→1, translateY 12→0). Animates whenever `run` is true,
// including on first mount. `delay` sequences the cascade after the card grows.
function FadeInRow({ delay = 0, run, children }: { delay?: number; run: boolean; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => {
    anim.current?.stop();
    if (!run) { opacity.setValue(0); translateY.setValue(12); return; }
    opacity.setValue(0); translateY.setValue(12);
    anim.current = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    anim.current.start();
    return () => anim.current?.stop();
  }, [run, delay]);
  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

// Reveal container. No measurement needed: animates maxHeight 0↔LARGE, which
// clips/reveals the always-mounted children. Natural content height caps it, so
// there's no race and the first expand works reliably.
const REVEAL_DURATION = 1400;
const REVEAL_MAX = 5000; // generous ceiling to accommodate long timelines with birthday events
function RevealSection({ expanded, children }: { expanded: boolean; children: React.ReactNode }) {
  const maxH = useRef(new Animated.Value(expanded ? REVEAL_MAX : 0)).current;
  useEffect(() => {
    Animated.timing(maxH, {
      toValue: expanded ? REVEAL_MAX : 0,
      duration: REVEAL_DURATION,
      easing: Easing.inOut(Easing.poly(4)),
      useNativeDriver: false,
    }).start();
  }, [expanded]);
  return (
    <Animated.View style={{ maxHeight: maxH, overflow: "hidden" }}>
      {children}
    </Animated.View>
  );
}

function Chip({ label, active, onPress, color }: { label: string; active: boolean; onPress: () => void; color: string }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}
      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 0.75, borderColor: active ? color : c.border, backgroundColor: active ? (color === "#ffffff" ? "rgba(255,255,255,0.15)" : color + "22") : "transparent" }}>
      <Text style={{ fontSize: 12, fontWeight: "600", color: active ? (color === "#ffffff" ? c.text : color) : c.subtext }}>{label}</Text>
    </TouchableOpacity>
  );
}

const fieldLabel = { fontSize: 12, fontWeight: "600" as const, color: c.subtext, marginBottom: 6 };
const inputStyle = { backgroundColor: c.card, borderRadius: 10, borderWidth: 0.75, borderColor: c.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: c.text };

type AddFormProps = {
  kind: TimelineEventKind;
  fName: string; setFName: (v: string) => void;
  fNotes: string; setFNotes: (v: string) => void;
  fNum: string; setFNum: (v: string) => void;
  fUnit: string; setFUnit: (v: string) => void;
  fProduct: string; setFProduct: (v: string) => void;
  fDate: string; setFDate: (v: string) => void;
  fPhotos: string[]; removePhoto: (u: string) => void;
  addFromLibrary: () => void; addFromCamera: () => void;
  saving: boolean; onSave: () => void; onBack: () => void;
};

function AddForm(p: AddFormProps) {
  const meta = KIND_META[p.kind];
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: meta.color, alignItems: "center", justifyContent: "center" }}>
          {HAS_SVG_ICON[p.kind] ? (
            <TimelineIcon kind={p.kind} size={22} color={meta.color === "#ffffff" ? Colors.brand : "#fff"} />
          ) : (
            <Text style={{ color: meta.color === "#ffffff" ? Colors.brand : "#fff", fontSize: 12, fontWeight: "900" }}>{meta.glyph}</Text>
          )}
        </View>
        <Text style={{ fontSize: 14, fontWeight: "700", color: c.text }}>Add {meta.label.toLowerCase()}</Text>
      </View>

      {/* Date — defaults to today, can be backdated to fill the timeline */}
      <EditDate label="Date" value={p.fDate} onChange={p.setFDate} />

      {p.kind === "weight" ? (
        <>
          <Text style={fieldLabel}>Weight (kg)</Text>
          <TextInput value={p.fNum} onChangeText={p.setFNum} keyboardType="decimal-pad" placeholder="e.g. 5.2" placeholderTextColor={c.muted} style={inputStyle} />
        </>
      ) : null}

      {p.kind === "symptom" ? (
        <>
          <Text style={fieldLabel}>Symptom name</Text>
          <TextInput value={p.fName} onChangeText={p.setFName} placeholder="e.g. Limping on right paw" placeholderTextColor={c.muted} style={inputStyle} />
          <Text style={[fieldLabel, { marginTop: 12 }]}>Notes</Text>
          <TextInput value={p.fNotes} onChangeText={p.setFNotes} placeholder="Describe what you've noticed…" placeholderTextColor={c.muted} multiline style={[inputStyle, { minHeight: 70, textAlignVertical: "top" }]} />
          <Text style={[fieldLabel, { marginTop: 12 }]}>Photos</Text>
          {p.fPhotos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {p.fPhotos.map(uri => (
                <View key={uri} style={{ marginRight: 8 }}>
                  <Image source={{ uri }} style={{ width: 64, height: 64, borderRadius: 8 }} />
                  <TouchableOpacity onPress={() => p.removePhoto(uri)} style={{ position: "absolute", top: -6, right: -6, backgroundColor: "#ef4444", width: 20, height: 20, borderRadius: 999, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          ) : null}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={p.addFromLibrary} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 0.75, borderColor: c.border, alignItems: "center" }}>
              <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>Choose photo</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={p.addFromCamera} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 0.75, borderColor: c.border, alignItems: "center" }}>
              <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>Take photo</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}

      {p.kind === "condition" ? (
        <>
          <Text style={fieldLabel}>Diagnosis / condition</Text>
          <TextInput value={p.fName} onChangeText={p.setFName} placeholder="e.g. Atopic dermatitis" placeholderTextColor={c.muted} style={inputStyle} />
          <Text style={{ fontSize: 11, color: c.muted, marginTop: 6 }}>Standardised coding (VeNom) will be added later.</Text>
        </>
      ) : null}

      {p.kind === "vaccination" ? (
        <>
          <Text style={fieldLabel}>Vaccination</Text>
          <TextInput value={p.fName} onChangeText={p.setFName} placeholder="e.g. Annual C5" placeholderTextColor={c.muted} style={inputStyle} />
          <Text style={[fieldLabel, { marginTop: 12 }]}>Product (optional)</Text>
          <TextInput value={p.fProduct} onChangeText={p.setFProduct} placeholder="e.g. Nobivac DHP" placeholderTextColor={c.muted} style={inputStyle} />
        </>
      ) : null}

      {p.kind === "medication" ? (
        <>
          <Text style={fieldLabel}>Medication</Text>
          <TextInput value={p.fName} onChangeText={p.setFName} placeholder="e.g. Apoquel" placeholderTextColor={c.muted} style={inputStyle} />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={fieldLabel}>Dose (optional)</Text>
              <TextInput value={p.fNum} onChangeText={p.setFNum} keyboardType="decimal-pad" placeholder="e.g. 16" placeholderTextColor={c.muted} style={inputStyle} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={fieldLabel}>Unit (optional)</Text>
              <TextInput value={p.fUnit} onChangeText={p.setFUnit} placeholder="e.g. mg" placeholderTextColor={c.muted} style={inputStyle} />
            </View>
          </View>
        </>
      ) : null}

      {/* Save (green, matching the app) + Back */}
      <TouchableOpacity onPress={p.onSave} disabled={p.saving} activeOpacity={0.85}
        style={{ marginTop: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: "#10b981", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}>
        {p.saving ? <ActivityIndicator color="#fff" /> : (
          <>
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>Add to timeline</Text>
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>→</Text>
          </>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={p.onBack} disabled={p.saving} style={{ marginTop: 8, paddingVertical: 10, borderRadius: 10, borderWidth: 0.75, borderColor: c.border, alignItems: "center" }}>
        <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

