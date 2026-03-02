import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
    receipt: string;
    productId: string;
    platform: 'ios' | 'android';
    transactionId?: string; // provided by react-native-iap for deduplication
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { receipt, productId, platform, transactionId }: VerifyRequest = await req.json();

        if (!receipt || !productId || !platform) {
            throw new Error('Missing required fields (receipt, productId, platform)');
        }

        // Initialize Supabase client
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get the user ID from the authorization header
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            throw new Error("Missing Authorization header");
        }

        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);

        if (userError || !user) {
            throw new Error("Invalid or missing user token");
        }

        let isValid = false;
        let isSubscription = productId.includes('premium'); // Using premium keyword for subscription check

        if (platform === 'ios') {
            isValid = await verifyAppleReceipt(receipt);
        } else if (platform === 'android') {
            isValid = await verifyGoogleReceipt(receipt, productId, isSubscription);
        } else {
            throw new Error('Unsupported platform');
        }

        if (!isValid) {
            throw new Error('Receipt validation failed with the store');
        }

        // --- Award User their credits or subscription ---
        
        // 1. Transaction Deduplication Check (important for consumables)
        if (transactionId) {
             const { data: existingTx } = await supabase
                .from('iap_transactions')
                .select('id')
                .eq('transaction_id', transactionId)
                .maybeSingle();
                
             if (existingTx) {
                 return new Response(JSON.stringify({ success: true, message: 'Already processed' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
             }
        }

        // 2. Fetch current profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            throw new Error("Profile not found");
        }

        let updates: any = {};

        if (isSubscription) {
             updates.is_premium = true;
        } else if (productId === 'pawvibe_snack_pack') {
             updates.purchased_credits = (profile.purchased_credits || 0) + 10;
        } else if (productId === 'pawvibe_party_pack') {
             updates.purchased_credits = (profile.purchased_credits || 0) + 50;
        }

        // 3. Update Profile
        const { error: updateError } = await supabase
             .from('profiles')
             .update(updates)
             .eq('id', user.id);

        if (updateError) {
             throw new Error(`Failed to update profile: ${updateError.message}`);
        }

        // 4. Log Transaction
        if (transactionId) {
             await supabase
                 .from('iap_transactions')
                 .insert({
                     user_id: user.id,
                     transaction_id: transactionId,
                     product_id: productId,
                     platform: platform,
                     receipt_data: receipt
                 });
        }

        return new Response(JSON.stringify({ 
            success: true, 
             message: 'Receipt verified and profile updated.'
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400
        });
    }
});

/**
 * Apple Receipt Verification — Production-ready.
 * Always tries PRODUCTION first, then auto-falls back to SANDBOX if Apple
 * returns status 21007 (sandbox receipt). This handles both App Store and
 * TestFlight purchases without any manual flag switching.
 */
async function verifyAppleReceipt(receiptData: string): Promise<boolean> {
    const secret = Deno.env.get("APPLE_APP_SPECIFIC_SHARED_SECRET");
    
    // SECURITY: If no secret is configured, REJECT the receipt.
    if (!secret) {
        console.error("APPLE_APP_SPECIFIC_SHARED_SECRET not set. Cannot verify receipt — REJECTING.");
        return false; 
    }

    const requestBody = JSON.stringify({
        'receipt-data': receiptData,
        'password': secret,
        'exclude-old-transactions': true
    });

    // 1. Try PRODUCTION first
    const prodRes = await fetch('https://buy.itunes.apple.com/verifyReceipt', {
        method: 'POST',
        body: requestBody
    });
    const prodData = await prodRes.json();

    // status 0 = valid receipt
    if (prodData.status === 0) return true;
    
    // status 21007 = sandbox receipt sent to production → retry with sandbox
    if (prodData.status === 21007) {
        console.log('[verify-receipt] Sandbox receipt detected, retrying with sandbox endpoint');
        const sandboxRes = await fetch('https://sandbox.itunes.apple.com/verifyReceipt', {
            method: 'POST',
            body: requestBody
        });
        const sandboxData = await sandboxRes.json();
        return sandboxData.status === 0;
    }

    console.error('[verify-receipt] Apple returned status:', prodData.status);
    return false;
}

/**
 * Google Play Receipt Verification
 * Note: Doing this securely requires a Service Account JSON configured as an env var.
 */
async function verifyGoogleReceipt(purchaseToken: string, productId: string, isSubscription: boolean): Promise<boolean> {
   // Implementing proper Google auth purely on Edge Functions without external deps requires
   // generating JWTs from a service account and calling play developer API. 
   // For now, if the environment variable GOOGLE_PLAY_SERVICE_ACCOUNT is empty, 
   // we let the purchase succeed, just like with Apple's dev mode.
   
   const serviceAccountStr = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT");
   if (!serviceAccountStr) {
       console.warn("GOOGLE_PLAY_SERVICE_ACCOUNT not set. Approving token blindly.");
       return true;
   }
   
   // In a complete implementation you would:
   // 1. Parse serviceAccountStr 
   // 2. Generate an OAuth2 Bearer token
   // 3. Make a request to: 
   // `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.your.package/purchases/${isSubscription ? 'subscriptions' : 'products'}/${productId}/tokens/${purchaseToken}`
   
   return true;
}
