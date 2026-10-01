import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Admin Verification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No Authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);

    if (authError || !user || user.user_metadata?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const { action, id, ids, payload } = body;

    switch (action) {
      case "list": {
        const { country, status, search } = payload || {};
        let query = adminClient
          .from("petshops")
          .select("*")
          .order("created_at", { ascending: false });

        if (country && country !== "ALL") {
          query = query.eq("country", country);
        }
        if (status && status !== "ALL") {
          query = query.eq("status", status);
        }
        if (search && search.trim().length > 0) {
          const s = search.trim();
          query = query.or(`name.ilike.%${s}%,email.ilike.%${s}%,city.ilike.%${s}%,website.ilike.%${s}%`);
        }

        const { data, error } = await query;
        if (error) throw error;

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "stats": {
        const { data, error } = await adminClient.from("petshops").select("country, status");
        if (error) throw error;

        const total = data.length;
        const us_count = data.filter((d) => d.country === "US").length;
        const tr_count = data.filter((d) => d.country === "TR").length;
        const lead_count = data.filter((d) => d.status === "lead").length;
        const contacted_count = data.filter((d) => d.status === "contacted").length;
        const partner_count = data.filter((d) => d.status === "partner").length;

        return new Response(
          JSON.stringify({
            total,
            us_count,
            tr_count,
            lead_count,
            contacted_count,
            partner_count,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "create": {
        if (!payload || !payload.name || !payload.email || !payload.country) {
          throw new Error("Missing required fields: name, email, and country are required.");
        }
        const insertData = {
          name: payload.name.trim(),
          email: payload.email.trim().toLowerCase(),
          country: payload.country.toUpperCase(),
          city: payload.city ? payload.city.trim() : null,
          website: payload.website ? payload.website.trim() : null,
          phone: payload.phone ? payload.phone.trim() : null,
          category: payload.category || "general",
          status: payload.status || "lead",
          notes: payload.notes || null,
        };

        const { data, error } = await adminClient
          .from("petshops")
          .insert([insertData])
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "bulk_import": {
        const items = payload?.items;
        if (!Array.isArray(items) || items.length === 0) {
          throw new Error("Payload must contain an array of items");
        }

        const validItems = items
          .filter((item: any) => item.name && item.email && item.country)
          .map((item: any) => ({
            name: String(item.name).trim(),
            email: String(item.email).trim().toLowerCase(),
            country: String(item.country).toUpperCase() === "TR" ? "TR" : "US",
            city: item.city ? String(item.city).trim() : null,
            website: item.website ? String(item.website).trim() : null,
            phone: item.phone ? String(item.phone).trim() : null,
            category: item.category || "general",
            status: item.status || "lead",
            notes: item.notes || null,
          }));

        if (validItems.length === 0) {
          throw new Error("No valid petshop rows found with name, email, and country.");
        }

        // Deduplicate within the incoming batch by email
        const uniqueItems = Array.from(
          new Map(validItems.map((item: any) => [item.email, item])).values()
        );

        const { data, error } = await adminClient
          .from("petshops")
          .upsert(uniqueItems, { onConflict: "email", ignoreDuplicates: true })
          .select();

        if (error) throw error;

        return new Response(
          JSON.stringify({
            success: true,
            imported: data ? data.length : uniqueItems.length,
            total_sent: uniqueItems.length,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "update": {
        if (!id) throw new Error("Missing ID for update");
        const updateData: any = { ...payload, updated_at: new Date().toISOString() };
        if (updateData.email) updateData.email = updateData.email.trim().toLowerCase();
        if (updateData.country) updateData.country = updateData.country.toUpperCase();

        const { data, error } = await adminClient
          .from("petshops")
          .update(updateData)
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete": {
        if (ids && Array.isArray(ids) && ids.length > 0) {
          const { error } = await adminClient.from("petshops").delete().in("id", ids);
          if (error) throw error;
          return new Response(JSON.stringify({ success: true, count: ids.length }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (!id) throw new Error("Missing ID for deletion");
        const { error } = await adminClient.from("petshops").delete().eq("id", id);
        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        throw new Error(`Unsupported action: ${action}`);
    }
  } catch (error: any) {
    console.error("[manage-petshops] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: corsHeaders,
    });
  }
});
