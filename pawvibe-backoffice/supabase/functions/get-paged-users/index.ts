import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
      console.error("[get-paged-users] Unauthorized access attempt:", user?.email, "Role:", user?.user_metadata?.role);
      return new Response(JSON.stringify({ 
        error: "Unauthorized", 
        detail: `Required role 'admin' missing. Found: '${user?.user_metadata?.role || 'none'}'` 
      }), { status: 403, headers: corsHeaders });
    }

    const { page = 1, limit = 20, search = '' } = await req.json();
    const offset = (page - 1) * limit;

    // 2. Fetch Users from Auth
    const { data: { users }, error: usersError } = await adminClient.auth.admin.listUsers();
    
    if (usersError) throw usersError;

    // Debug: İlk kullanıcının yapısını konsola bas (sadece loglarda görünür)
    if (users.length > 0) {
      console.log("[get-paged-users] DB User[0] keys:", Object.keys(users[0]));
      console.log("[get-paged-users] User[0] email_change:", users[0].email_change);
      console.log("[get-paged-users] User[0] new_email:", (users[0] as any).new_email);
    }

    // 3. Process & Filter (Handling email_change for linked accounts)
    let processedUsers = users.map(u => ({
      id: u.id,
      email: u.email || null,
      // Bazı GoTrue sürümlerinde 'new_email' olarak da gelebilir
      email_change: u.email_change || (u as any).new_email || null,
      created_at: u.created_at,
      last_login: u.last_sign_in_at
    }));

    if (search) {
      const s = search.toLowerCase();
      processedUsers = processedUsers.filter(u => 
        (u.email && u.email.toLowerCase().includes(s)) ||
        (u.email_change && u.email_change.toLowerCase().includes(s)) ||
        u.id.toLowerCase().includes(s)
      );
    }

    // Sort newest first
    processedUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const totalCount = processedUsers.length;
    const paginatedUsers = processedUsers.slice(offset, offset + limit);

    // 4. Merge with Profile Data
    const userIds = paginatedUsers.map(u => u.id);
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('*')
      .in('id', userIds);

    const merged = paginatedUsers.map(u => {
      const profile = profiles?.find(p => p.id === u.id);
      return {
        ...u,
        profile: profile || {},
        username: profile?.username || 'Guest'
      };
    });

    return new Response(JSON.stringify({ users: merged, totalCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("[get-paged-users] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: corsHeaders
    });
  }
});
