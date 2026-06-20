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

export function EditText({ label, value, onChange, placeholder, keyboardType }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  keyboardType?: "default" | "numeric" | "decimal-pad";
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
      {show ? (
        <DateTimePicker
          value={dateObj}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          onChange={(event, selected) => {
            setShow(Platform.OS === "ios");
            if (event.type === "set" && selected) {
              const y = selected.getFullYear();
              const m = String(selected.getMonth() + 1).padStart(2, "0");
              const d = String(selected.getDate()).padStart(2, "0");
              onChange(`${y}-${m}-${d}`);
              if (Platform.OS === "ios") setShow(false);
            } else if (event.type === "dismissed") {
              setShow(false);
            }
          }}
        />
      ) : null}
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
