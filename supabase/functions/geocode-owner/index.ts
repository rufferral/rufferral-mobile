// supabase/functions/geocode-owner/index.ts
// Edge Function: geocodes an owner's address via OpenCage and writes lat/lng to their profile.
// The OpenCage key stays server-side as a Supabase secret (never shipped in the mobile app).
//
// Deploy:  supabase functions deploy geocode-owner
// Secret:  supabase secrets set OPENCAGE_API_KEY=your_key_here
//
// The caller must be authenticated (the function uses the caller's JWT to identify the owner),
// so an owner can only ever geocode and update their OWN profile.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Body = {
  address?: string | null;
  suburb?: string | null;
  state?: string | null;
  postcode?: string | null;
  country?: string | null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Identify the caller from their JWT — they can only update their own profile.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing authorization" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return json({ error: "Unauthorised" }, 401);
    }

    const body = (await req.json()) as Body;
    const queryParts = [body.address, body.suburb, body.state, body.postcode, body.country]
      .map((p) => (p ?? "").toString().trim())
      .filter(Boolean);

    if (queryParts.length === 0) {
      return json({ error: "No address parts provided" }, 400);
    }

    const apiKey = Deno.env.get("OPENCAGE_API_KEY");
    if (!apiKey) {
      return json({ error: "Geocoding not configured" }, 500);
    }

    const query = encodeURIComponent(queryParts.join(", "));
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${query}&key=${apiKey}&limit=1&no_annotations=1`;

    const geoRes = await fetch(url);
    if (!geoRes.ok) {
      return json({ error: "Geocoding request failed" }, 502);
    }
    const geo = (await geoRes.json()) as {
      results: { geometry: { lat: number; lng: number } }[];
      status: { code: number };
    };
    if (geo.status.code !== 200 || !geo.results.length) {
      return json({ error: "Could not geocode address" }, 422);
    }

    const { lat, lng } = geo.results[0].geometry;

    // Write coordinates to the caller's own profile.
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ lat, lng })
      .eq("id", user.id);

    if (updateError) {
      return json({ error: updateError.message }, 500);
    }

    return json({ lat, lng });
  } catch (e) {
    return json({ error: (e as Error).message ?? "Unexpected error" }, 500);
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
