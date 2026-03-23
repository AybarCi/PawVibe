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
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: corsHeaders });
    }

    const { type = 'credit', page = 1, limit = 20, search = '', productId = '' } = await req.json();
    const offset = (page - 1) * limit;

    // 2. Fetch Transactions
    let query = adminClient.from('iap_transactions').select(`
      *,
      profiles (
        username,
        is_premium
      )
    `, { count: 'exact' });

    if (type === 'subscription') {
      query = query.ilike('product_id', '%premium%');
    } else {
      query = query.not('product_id', 'ilike', '%premium%');
    }

    if (productId) {
      query = query.eq('product_id', productId);
    }

    if (search) {
      const s = search.trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
      
      if (isUuid) {
        // If it's a UUID, search in id and user_id directly
        query = query.or(`id.eq.${s},user_id.eq.${s},transaction_id.ilike.%${s}%`);
      } else {
        // Otherwise, only search in transaction_id (which is text)
        query = query.ilike('transaction_id', `%${s}%`);
      }
    }

    const { data: transactions, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return new Response(JSON.stringify({ transactions, totalCount: count }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: corsHeaders
    });
  }
});
