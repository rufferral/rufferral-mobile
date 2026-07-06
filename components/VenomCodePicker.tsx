import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";

const c = Colors.light;

export type CodePick = { code: string; display_text: string } | null;

/**
 * Searchable autocomplete over VeNom clinical_codes.
 * - category: which VeNom category to search ('species' | 'breed' | 'diagnosis' | ...)
 * - parentCode: when set (for breeds), restricts results to that species's breeds
 * - value: currently selected display text (for showing the chosen label)
 * - onPick: called with {code, display_text} when a suggestion is tapped, or null when cleared
 */
export function VenomCodePicker({
  label, category, parentCode, value, onPick, placeholder, disabled,
}: {
  label: string;
  category: string;
  parentCode?: string | null;
  value?: string | null;
  onPick: (pick: CodePick) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ code: string; display_text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounce = useRef<any>(null);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    let req = supabase
      .from("clinical_codes")
      .select("code, display_text")
      .eq("code_system", "venom")
      .eq("category", category)
      .eq("active", true)
      .ilike("display_text", `%${q}%`)
      .order("display_text")
      .limit(40);
    if (category === "breed" && parentCode) req = req.eq("parent_code", parentCode);
    const { data } = await req;
    setResults((data ?? []) as { code: string; display_text: string }[]);
    setLoading(false);
  }, [category, parentCode]);

  useEffect(() => {
    if (!open) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { void search(query); }, 180);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query, open, search]);

  const displayValue = value?.trim();

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 12, fontWeight: "600", color: c.subtext, marginBottom: 6 }}>{label}</Text>

      {/* Selected value chip / open button */}
      {displayValue && !open ? (
        <TouchableOpacity
          disabled={disabled}
          onPress={() => { setOpen(true); setQuery(""); setResults([]); }}
          activeOpacity={0.8}
          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.card, borderRadius: 10, borderWidth: 0.75, borderColor: c.border, paddingHorizontal: 12, paddingVertical: 11 }}
        >
          <Text style={{ fontSize: 15, color: c.text, flex: 1 }}>{displayValue}</Text>
          <Text style={{ fontSize: 12, color: c.subtext }}>Change</Text>
        </TouchableOpacity>
      ) : (
        <View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onFocus={() => setOpen(true)}
            editable={!disabled}
            placeholder={placeholder ?? `Search ${label.toLowerCase()}…`}
            placeholderTextColor={c.muted}
            style={{ backgroundColor: c.card, borderRadius: 10, borderWidth: 0.75, borderColor: c.border, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: c.text }}
          />
          {open ? (
            <View style={{ marginTop: 6, backgroundColor: c.card, borderRadius: 10, borderWidth: 0.75, borderColor: c.border, maxHeight: 240, overflow: "hidden" }}>
              {loading ? (
                <ActivityIndicator color={Colors.brand} style={{ paddingVertical: 16 }} />
              ) : results.length === 0 ? (
                <Text style={{ fontSize: 13, color: c.muted, padding: 14 }}>
                  {query.trim().length === 0 ? "Start typing to search…" : "No matches found."}
                </Text>
              ) : (
                <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                  {results.map(r => (
                    <TouchableOpacity
                      key={r.code}
                      onPress={() => { onPick({ code: r.code, display_text: r.display_text }); setOpen(false); setQuery(""); }}
                      activeOpacity={0.7}
                      style={{ paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: c.border }}
                    >
                      <Text style={{ fontSize: 14, color: c.text }}>{r.display_text}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              {/* Cancel search, keep existing value */}
              <TouchableOpacity onPress={() => { setOpen(false); setQuery(""); }} style={{ paddingVertical: 10, alignItems: "center", borderTopWidth: 0.75, borderTopColor: c.border }}>
                <Text style={{ fontSize: 13, color: c.subtext, fontWeight: "600" }}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}
