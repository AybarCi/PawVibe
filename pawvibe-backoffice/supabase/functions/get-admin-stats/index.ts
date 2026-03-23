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
      console.error("[get-admin-stats] Unauthorized access attempt:", user?.email, "Role:", user?.user_metadata?.role);
      return new Response(JSON.stringify({ 
        error: "Unauthorized", 
        detail: `Required role 'admin' missing. Found: '${user?.user_metadata?.role || 'none'}'` 
      }), { status: 403, headers: corsHeaders });
    }

    // 2. Aggregate Data
    const { count: totalUsers } = await adminClient.from('profiles').select('*', { count: 'exact', head: true });
    const { count: activePremium } = await adminClient.from('profiles').select('*', { count: 'exact', head: true }).eq('is_premium', true);
    const { count: totalScans } = await adminClient.from('scans').select('*', { count: 'exact', head: true });

    // Detailed Sales Analysis
    const { data: allTransactions, error: txError } = await adminClient
      .from('iap_transactions')
      .select('product_id');

    if (txError) throw txError;

    const premiumIds = ['pawvibe_premium_monthly', 'pawvibe_premium_yearly']; // Add all premium IDs
    const creditSales = allTransactions?.filter(tx => 
      tx.product_id?.includes('snack') || tx.product_id?.includes('party') || tx.product_id?.includes('pack')
    ).length || 0;

    const premiumSales = allTransactions?.filter(tx => 
      tx.product_id?.includes('premium') || premiumIds.includes(tx.product_id)
    ).length || 0;

    const totalSales = allTransactions?.length || 0;

    // Son büyüme (7 günlük)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { count: recentGrowth } = await adminClient
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString());

    return new Response(JSON.stringify({
      totalUsers: totalUsers || 0,
      activePremium: activePremium || 0,
      totalScans: totalScans || 0,
      totalSales: totalSales || 0,
      creditSales: creditSales,
      premiumSales: premiumSales,
      recentGrowth: recentGrowth || 0
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("[get-admin-stats] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: corsHeaders
    });
  }
});
