import { useState, useRef, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native";
import { supabase } from "@/lib/supabase";
import { Colors } from "@/constants/colors";

const c = Colors.light;

export type Suburb = {
  id: string;
  name: string;
  state: string;
  postcode: string;
  country: string;
};

const AUTOCOMPLETE_COUNTRIES = new Set(["Australia", "New Zealand", "United Kingdom"]);

// Inline suburb autocomplete: type a suburb -> suggestions from the search_suburbs RPC ->
// selecting one fills suburb name, postcode and state together (matches desktop).
export function SuburbAutocomplete({
  value, state, country, onValueChange, onSelect, placeholder, labelStyle, inputStyle,
}: {
  value: string;
  state: string | null;
  country: string;
  onValueChange: (v: string) => void;        // suburb name text changes
  onSelect: (s: Suburb) => void;             // a suburb was picked (carries postcode + state)
  placeholder?: string;
  labelStyle?: object;
  inputStyle: object;
}) {
  const [results, setResults] = useState<Suburb[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justSelectedRef = useRef(false);

  const isSupported = AUTOCOMPLETE_COUNTRIES.has(country);

  const runSearch = useCallback(async (term: string, filterState: string | null, ctry: string) => {
    setLoading(true);
    const { data, error } = await supabase.rpc("search_suburbs", {
      search_term: term,
      filter_state: null,        // always null — state auto-fills from selection, no need to pre-filter
      filter_country: ctry,
      max_results: 10,
    });
    setLoading(false);
    if (!error && data && (data as Suburb[]).length > 0) {
      setResults(data as Suburb[]);
      setOpen(true);
    } else {
      setResults([]);
      setOpen(false);
    }
  }, []);

  const handleChange = (text: string) => {
    onValueChange(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!isSupported || text.length < 2) { setResults([]); setOpen(false); return; }
    if (justSelectedRef.current) { justSelectedRef.current = false; return; }
    debounceRef.current = setTimeout(() => void runSearch(text, state, country), 300);
  };

  const handleSelect = (s: Suburb) => {
    justSelectedRef.current = true;
    // Postcodes can arrive numeric (e.g. "3805.0"); normalise before using/saving.
    const cleaned: Suburb = { ...s, postcode: String(s.postcode ?? "").replace(/\.0+$/, "") };
    onValueChange(cleaned.name);
    onSelect(cleaned);
    setResults([]);
    setOpen(false);
  };

  return (
    <View style={{ marginBottom: 14 }}>
      {labelStyle ? <Text style={labelStyle}>Suburb / City</Text> : null}
      <View>
        <TextInput
          value={value}
          onChangeText={handleChange}
          placeholder={placeholder ?? "Start typing your suburb"}
          placeholderTextColor={c.muted}
          autoCorrect={false}
          style={inputStyle}
        />
        {loading ? (
          <ActivityIndicator color={c.subtext} size="small" style={{ position: "absolute", right: 10, top: 10 }} />
        ) : null}
      </View>

      {open && results.length > 0 ? (
        <View style={{ marginTop: 4, borderWidth: 0.75, borderColor: c.border, borderRadius: 8, backgroundColor: c.card, overflow: "hidden" }}>
          {results.map((s, i) => (
            <TouchableOpacity key={s.id} onPress={() => handleSelect(s)}
              style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: 12, paddingVertical: 11, borderTopWidth: i === 0 ? 0 : 0.75, borderTopColor: c.border }}>
              <Text style={{ fontSize: 14, color: c.text, fontWeight: "500" }}>{s.name}</Text>
              <Text style={{ fontSize: 12, color: c.subtext, marginLeft: 12 }}>{`${s.state} ${String(s.postcode ?? "").replace(/\.0+$/, "")}`}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {isSupported && !state && value.length >= 2 && !open ? (
        <Text style={{ fontSize: 12, color: c.muted, marginTop: 5 }}>Start typing to find your suburb</Text>
      ) : null}
    </View>
  );
}
