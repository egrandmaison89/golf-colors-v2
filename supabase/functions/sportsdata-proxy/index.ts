/**
 * Supabase Edge Function: SportsData.io API Proxy
 * 
 * This function proxies requests to SportsData.io API to avoid CORS issues.
 * The API key is stored in Supabase secrets and never exposed to the client.
 * 
 * Usage:
 *   POST /sportsdata-proxy
 *   Body: { endpoint: "/Tournaments", method: "GET" }
 * 
 * Returns: API response data
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Golf v2 API: https://api.sportsdata.io/golf/v2/json/Tournaments/2026
// Auth: Ocp-Apim-Subscription-Key header or ?key= query param
const API_BASE_URL = "https://api.sportsdata.io/golf/v2/json";

interface ProxyRequest {
  endpoint: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
      },
    });
  }

  try {
    // Get API key from Supabase secrets
    const apiKey = Deno.env.get("SPORTSDATA_API_KEY");
    if (!apiKey) {
      console.error("SPORTSDATA_API_KEY not configured in Supabase secrets");
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Parse request body
    const proxyRequest: ProxyRequest = await req.json();
    const { endpoint, method = "GET", body } = proxyRequest;

    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: "Missing endpoint in request body" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Make request to SportsData.io API (base already includes /json)
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${API_BASE_URL}${path}`;
    const apiResponse = await fetch(url, {
      method,
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    // Parse response - API may return non-JSON on some errors
    let data: unknown;
    const contentType = apiResponse.headers.get("content-type") || "";
    try {
      data = contentType.includes("application/json")
        ? await apiResponse.json()
        : { error: await apiResponse.text(), status: apiResponse.status };
    } catch (parseError) {
      throw new Error(
        `Failed to parse API response (${apiResponse.status}): ${parseError instanceof Error ? parseError.message : "Unknown"}`
      );
    }

    // Track API usage in Supabase (only on successful responses)
    if (apiResponse.ok) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const today = new Date().toISOString().split("T")[0];
        await supabase.from("api_usage").insert({
          endpoint,
          data_type: "tournament",
          day: today,
        });
      } catch (trackError) {
        console.error("Failed to track API usage:", trackError);
      }
    }

    // Return API response
    return new Response(JSON.stringify(data), {
      status: apiResponse.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return new Response(
      JSON.stringify({
        error: "Proxy request failed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});


