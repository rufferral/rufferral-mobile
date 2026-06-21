import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Colors } from "@/constants/colors";

const c = Colors.light;

const labelStyle = { fontSize: 12, fontWeight: "600" as const, color: c.subtext, marginBottom: 6 };
const inputBox = {
  backgroundColor: c.cardInner, borderRadius: 8, borderWidth: 0.75, borderColor: c.border,
  paddingHorizontal: 12, paddingVertical: 10, color: c.text, fontSize: 15,
} as const;

export function EditNumberStepper({ label, value, onChange, placeholder, step = 0.1, min = 0, decimals = 1, unit }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  step?: number; min?: number; decimals?: number; unit?: string;
}) {
  const adjust = (dir: 1 | -1) => {
    const current = parseFloat(value);
    const base = isNaN(current) ? 0 : current;
    let next = base + dir * step;
    if (next < min) next = min;
    // Round to the given decimals to avoid floating-point noise (e.g. 3.300000001).
    const rounded = Number(next.toFixed(decimals));
    onChange(String(rounded));
  };

  const btnStyle = {
    width: 44, height: 44, borderRadius: 8, borderWidth: 0.75, borderColor: c.border,
    backgroundColor: c.cardInner, alignItems: "center" as const, justifyContent: "center" as const,
  };

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={labelStyle}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <TouchableOpacity onPress={() => adjust(-1)} style={btnStyle}>
          <Text style={{ color: c.text, fontSize: 22, fontWeight: "600", lineHeight: 24 }}>−</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder={placeholder}
            placeholderTextColor={c.muted}
            keyboardType="decimal-pad"
            style={[inputBox, { flex: 1, textAlign: "center" }]}
          />
          {unit ? <Text style={{ color: c.subtext, fontSize: 15, marginLeft: 8 }}>{unit}</Text> : null}
        </View>
        <TouchableOpacity onPress={() => adjust(1)} style={btnStyle}>
          <Text style={{ color: c.text, fontSize: 22, fontWeight: "600", lineHeight: 24 }}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function EditText({ label, value, onChange, placeholder, keyboardType, onFocus }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  keyboardType?: "default" | "numeric" | "decimal-pad";
  onFocus?: () => void;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={labelStyle}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        keyboardType={keyboardType ?? "default"}
        onFocus={onFocus}
        style={inputBox}
      />
    </View>
  );
}

export function EditDate({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void; // value is YYYY-MM-DD or ""
}) {
  const [show, setShow] = useState(false);
  const dateObj = value ? new Date(value + "T00:00:00") : new Date();
  const display = value
    ? new Date(value + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
    : "Select date";

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={labelStyle}>{label}</Text>
      <TouchableOpacity onPress={() => setShow(true)} style={[inputBox, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
        <Text style={{ color: value ? c.text : c.muted, fontSize: 15 }}>{display}</Text>
        <Text style={{ color: c.subtext }}>📅</Text>
      </TouchableOpacity>
      {value ? (
        <TouchableOpacity onPress={() => onChange("")}><Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>Clear</Text></TouchableOpacity>
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal visible={show} transparent animationType="fade" onRequestClose={() => setShow(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setShow(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 }}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ backgroundColor: c.card, borderRadius: 16, borderWidth: 0.75, borderColor: c.border, padding: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4, paddingBottom: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: c.subtext, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</Text>
                <TouchableOpacity onPress={() => setShow(false)} style={{ paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999, backgroundColor: Colors.brand }}>
                  <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={dateObj}
                mode="date"
                display="spinner"
                themeVariant="dark"
                textColor="#ffffff"
                accentColor={Colors.brand}
                style={{ alignSelf: "stretch" }}
                onChange={(event, selected) => {
                  if (event.type === "set" && selected) {
                    const y = selected.getFullYear();
                    const m = String(selected.getMonth() + 1).padStart(2, "0");
                    const d = String(selected.getDate()).padStart(2, "0");
                    onChange(`${y}-${m}-${d}`);
                  }
                }}
              />
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      ) : (
        show ? (
          <DateTimePicker
            value={dateObj}
            mode="date"
            display="default"
            onChange={(event, selected) => {
              setShow(false);
              if (event.type === "set" && selected) {
                const y = selected.getFullYear();
                const m = String(selected.getMonth() + 1).padStart(2, "0");
                const d = String(selected.getDate()).padStart(2, "0");
                onChange(`${y}-${m}-${d}`);
              }
            }}
          />
        ) : null
      )}
    </View>
  );
}

export function EditSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find(o => o.value === value)?.label ?? "Select";

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={labelStyle}>{label}</Text>
      <TouchableOpacity onPress={() => setOpen(true)} style={[inputBox, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
        <Text style={{ color: value ? c.text : c.muted, fontSize: 15 }}>{selectedLabel}</Text>
        <Text style={{ color: c.subtext }}>▾</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 32 }}>
          <View style={{ backgroundColor: c.card, borderRadius: 16, borderWidth: 0.75, borderColor: c.border, overflow: "hidden", maxHeight: "70%" }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: c.subtext, textTransform: "uppercase", letterSpacing: 0.6, padding: 16, paddingBottom: 8 }}>{label}</Text>
            <ScrollView>
              {options.map(opt => (
                <TouchableOpacity key={opt.value} onPress={() => { onChange(opt.value); setOpen(false); }}
                  style={{ paddingVertical: 14, paddingHorizontal: 16, borderTopWidth: 0.75, borderTopColor: c.border, backgroundColor: opt.value === value ? c.cardInner : "transparent" }}>
                  <Text style={{ fontSize: 15, color: c.text, fontWeight: opt.value === value ? "700" : "400" }}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export function EditSelectSearch({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const uniqueOptions = options.filter((o, i) => options.indexOf(o) === i);
  const filtered = query.trim()
    ? uniqueOptions.filter(o => o.toLowerCase().includes(query.trim().toLowerCase()))
    : uniqueOptions;

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={labelStyle}>{label}</Text>
      <TouchableOpacity onPress={() => { setQuery(""); setOpen(true); }} style={[inputBox, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
        <Text style={{ color: value ? c.text : c.muted, fontSize: 15, flex: 1 }} numberOfLines={1}>{value || (placeholder ?? "Select")}</Text>
        <Text style={{ color: c.subtext }}>▾</Text>
      </TouchableOpacity>
      {value ? (
        <TouchableOpacity onPress={() => onChange("")}><Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>Clear</Text></TouchableOpacity>
      ) : null}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 }}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ backgroundColor: c.card, borderRadius: 16, borderWidth: 0.75, borderColor: c.border, overflow: "hidden", maxHeight: "75%" }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: c.subtext, textTransform: "uppercase", letterSpacing: 0.6, padding: 16, paddingBottom: 8 }}>{label}</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search…"
              placeholderTextColor={c.muted}
              autoFocus
              style={{ backgroundColor: c.cardInner, borderRadius: 8, borderWidth: 0.75, borderColor: c.border, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 10, color: c.text, fontSize: 15 }}
            />
            <ScrollView keyboardShouldPersistTaps="handled">
              {filtered.length === 0 ? (
                <Text style={{ color: c.muted, fontSize: 14, padding: 16 }}>No matches</Text>
              ) : filtered.map(opt => (
                <TouchableOpacity key={opt} onPress={() => { onChange(opt); setOpen(false); }}
                  style={{ paddingVertical: 14, paddingHorizontal: 16, borderTopWidth: 0.75, borderTopColor: c.border, backgroundColor: opt === value ? c.cardInner : "transparent" }}>
                  <Text style={{ fontSize: 15, color: c.text, fontWeight: opt === value ? "700" : "400" }}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export function EditCardHeader({ title, editing, saving, onEdit, onSave, onCancel }: {
  title: string; editing: boolean; saving: boolean; onEdit: () => void; onSave: () => void; onCancel: () => void;
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <Text style={{ fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, color: c.subtext }}>{title}</Text>
      {editing ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity onPress={onCancel} disabled={saving} style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 0.75, borderColor: c.border }}>
            <Text style={{ color: c.subtext, fontSize: 13, fontWeight: "600" }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onSave} disabled={saving} style={{ paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999, backgroundColor: Colors.brand }}>
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>{saving ? "Saving…" : "Save"}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={onEdit} style={{ paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999, borderWidth: 0.75, borderColor: c.border }}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: "600" }}>Edit</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
