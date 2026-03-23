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
    const { data: { user: adminUser }, error: authError } = await adminClient.auth.getUser(token);

    if (authError || !adminUser || adminUser.user_metadata?.role !== 'admin') {
      console.error("[manage-user-credits] Unauthorized access attempt:", adminUser?.email, "Role:", adminUser?.user_metadata?.role);
      return new Response(JSON.stringify({ 
        error: "Unauthorized", 
        detail: `Required role 'admin' missing. Found: '${adminUser?.user_metadata?.role || 'none'}'` 
      }), { status: 403, headers: corsHeaders });
    }

    const { userId, amount, reason } = await req.json();

    if (!userId || amount === undefined || !reason) {
      throw new Error("Missing parameters: userId, amount, and reason are required.");
    }

    // 2. Kullanıcının mevcut kredisini çek
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('purchased_credits')
      .eq('id', userId)
      .single();

    if (profileError || !profile) throw new Error("User profile not found.");

    const newBalance = (profile.purchased_credits || 0) + amount;

    // 3. Kredi Güncelle ve Logla
    // a. Profili güncelle
    const { error: updateError } = await adminClient
      .from('profiles')
      .update({ purchased_credits: newBalance })
      .eq('id', userId);

    if (updateError) throw updateError;

    // b. Audit Log ekle (credit_logs tablosuna)
    const { error: logError } = await adminClient
      .from('credit_logs')
      .insert({
        user_id: userId,
        admin_id: adminUser.id,
        amount: amount,
        reason: reason
      });

    if (logError) {
       console.error("[manage-user-credits] Failed to log but profile updated:", logError.message);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      newBalance 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("[manage-user-credits] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: corsHeaders
    });
  }
});
