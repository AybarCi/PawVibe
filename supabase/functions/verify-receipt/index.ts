import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function decodeBase64URL(str: string): string {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    return atob(base64 + padding);
}

interface VerifyRequest {
    receipt: string;
    productId: string;
    platform: 'ios' | 'android';
    transactionId?: string;
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const body: VerifyRequest = await req.json();
        const { receipt, productId, platform, transactionId } = body;

        // 1. Initialize Supabase with Service Role (Admin)
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const adminClient = createClient(supabaseUrl, supabaseServiceKey);

        // 2. AUTH VERIFICATION
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error("No Authorization header provided");

        // Log token details for debugging (safe version)
        console.log(`[Auth] Header received. Length: ${authHeader.length}. Starts with: ${authHeader.substring(0, 15)}...`);

        const token = authHeader.replace('Bearer ', '').trim();
        if (!token) throw new Error("Empty Bearer token");

        // Use service role to verify the user's token - most reliable method
        const { data: { user }, error: userError } = await adminClient.auth.getUser(token);

        if (userError || !user) {
            console.error("[Auth] Verification failed:", userError?.message);
            throw new Error(`EF_AUTH_FAIL: ${userError?.message || 'Invalid Session'}`);
        }

        const userId = user.id;
        console.log(`[verify-receipt] Verified User: ${userId}`);

        // 3. Store Verification
        let isValid = false;
        let status = 0;

        if (platform === 'ios') {
            if (receipt.startsWith('eyJ')) {
                // JWS StoreKit 2
                try {
                    const [, payload] = receipt.split('.');
                    const decoded = JSON.parse(decodeBase64URL(payload));
                    console.log(`[Apple] JWS Product: ${decoded.productId}`);
                    isValid = true;
                } catch (e: any) {
                    throw new Error(`JWS Error: ${e.message}`);
                }
            } else {
                // Legacy
                const legacy = await verifyAppleLegacy(receipt);
                isValid = legacy.isValid;
                status = legacy.status;
            }
        } else {
            isValid = true;
        }

        if (!isValid) throw new Error(`Apple Verify Failed (Status: ${status})`);

        // 4. Update Database
        const txKey = (transactionId || receipt).substring(0, 100);
        const { data: existing } = await adminClient.from('iap_transactions').select('id').eq('transaction_id', txKey).maybeSingle();
        
        if (existing) {
            return new Response(JSON.stringify({ success: true, message: 'Already processed' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const { data: profile } = await adminClient.from('profiles').select('*').eq('id', userId).single();
        if (!profile) throw new Error("Profile not found");

        let updates: any = {};
        const isSubscription = productId.includes('premium');
        
        if (isSubscription) {
            updates.is_premium = true;
        } else if (productId === 'pawvibe_snack_pack') {
            updates.purchased_credits = (profile.purchased_credits || 0) + 10;
        } else if (productId === 'pawvibe_party_pack') {
            updates.purchased_credits = (profile.purchased_credits || 0) + 50;
        }

        if (Object.keys(updates).length > 0) {
            await adminClient.from('profiles').update(updates).eq('id', userId);
        }

        // Log Transaction & Get Final Profile
        await adminClient.from('iap_transactions').insert({ user_id: userId, transaction_id: txKey, product_id: productId, platform: platform, receipt_data: receipt.substring(0, 1000) });
        const { data: finalProfile } = await adminClient.from('profiles').select('*').eq('id', userId).single();

        return new Response(JSON.stringify({ success: true, profile: finalProfile }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (error: any) {
        console.error("[verify-receipt] ERROR:", error.message);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400
        });
    }
});

async function verifyAppleLegacy(receiptData: string) {
    const secret = Deno.env.get("APPLE_APP_SPECIFIC_SHARED_SECRET");
    if (!secret) return { isValid: false, status: -1 };
    const body = JSON.stringify({ 'receipt-data': receiptData, 'password': secret, 'exclude-old-transactions': true });
    let res = await fetch('https://buy.itunes.apple.com/verifyReceipt', { method: 'POST', body });
    let data = await res.json();
    if (data.status === 21007) {
        res = await fetch('https://sandbox.itunes.apple.com/verifyReceipt', { method: 'POST', body });
        data = await res.json();
    }
    return { isValid: data.status === 0, status: data.status };
}
