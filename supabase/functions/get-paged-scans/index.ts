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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("No Authorization header");

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);

    if (authError || !user || user.user_metadata?.role !== 'admin') {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: corsHeaders });
    }

    const { page = 1, limit = 20, search = '' } = await req.json();
    const offset = (page - 1) * limit;

    // 2. Query Scans with Join logic (simulated by fetching profiles)
    let query = adminClient
      .from('scans')
      .select('*, profiles(username)')
      .order('created_at', { ascending: false });

    if (search) {
      // Basic search on mood title or vibe
      query = query.ilike('mood_title', `%${search}%`);
    }

    const { data: scans, error: scansError, count } = await query
      .range(offset, offset + limit - 1);

    if (scansError) throw scansError;

    // 3. Fetch Auth Emails (optional, for better admin view)
    // List all users to map IDs to emails (since we can't join auth.users directly in simple select)
    const { data: { users } } = await adminClient.auth.admin.listUsers();
    
    const enrichedScans = scans?.map(scan => {
      const authUser = users.find(u => u.id === scan.user_id);
      return {
        ...scan,
        email: authUser?.email || 'Anonymous',
        username: (scan as any).profiles?.username || 'Guest'
      };
    });

    return new Response(JSON.stringify({ scans: enrichedScans, totalCount: count || enrichedScans.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: corsHeaders
    });
  }
});
