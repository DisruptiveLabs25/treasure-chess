import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const MOONPAY_PUBLISHABLE_KEY = Deno.env.get("EXPO_PUBLIC_MOONPAY_PUBLISHABLE_KEY") ?? "";
const MOONPAY_SECRET_KEY = Deno.env.get("MOONPAY_SECRET_KEY") ?? "";
const MOONPAY_SANDBOX = MOONPAY_PUBLISHABLE_KEY.startsWith("pk_test_");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

async function signQueryString(queryString: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(queryString));
  return toBase64(mac);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { walletAddress, flow, currencyCode = "usdc" } = await req.json();

    if (!walletAddress || typeof walletAddress !== "string") {
      return new Response(JSON.stringify({ error: "walletAddress is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!flow || !["buy", "sell"].includes(flow)) {
      return new Response(JSON.stringify({ error: "flow must be 'buy' or 'sell'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const host = flow === "buy"
      ? (MOONPAY_SANDBOX ? "buy-sandbox.moonpay.com" : "buy.moonpay.com")
      : (MOONPAY_SANDBOX ? "sell-sandbox.moonpay.com" : "sell.moonpay.com");

    const params = new URLSearchParams({
      apiKey: MOONPAY_PUBLISHABLE_KEY,
      walletAddress,
      currencyCode,
    });

    const queryString = `?${params.toString()}`;
    const signature = await signQueryString(queryString, MOONPAY_SECRET_KEY);
    const url = `https://${host}${queryString}&signature=${encodeURIComponent(signature)}`;

    return new Response(JSON.stringify({ url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[generate-moonpay-url] Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
