import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Generates a responsive, branded HTML email template
function buildHtmlEmail(params: {
  shopName: string;
  bodyContent: string;
  language: "tr" | "en";
  website?: string;
  city?: string;
}) {
  const { shopName, bodyContent, language } = params;
  const isTr = language === "tr";

  const ctaText = isTr ? "Ortaklık Detaylarını Görüşelim 🐾" : "Schedule a Quick Partnership Call 🐾";
  const ctaUrl = "https://pawvibe.app/partners";
  const headerSubtitle = isTr
    ? "Yapay Zekâ Destekli Evcil Hayvan Analizi & Ürün Pazaryeri"
    : "AI-Powered Pet Behavioral Analysis & Product Marketplace";
  const footerNote = isTr
    ? "Bu e-posta PawVibe B2B İş Ortaklığı ekibi tarafından gönderilmiştir."
    : "This email was sent by the PawVibe B2B Partnerships Team.";

  // Format line breaks in bodyContent to HTML paragraphs
  const formattedBody = bodyContent
    .split("\n\n")
    .map((paragraph) => `<p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #2D3748;">${paragraph.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PawVibe Partnership</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0A001A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0A001A; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #15002C 0%, #2D005A 50%, #FF007F 100%); padding: 36px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.5px; color: #FFFFFF;">
                Paw<span style="color: #FFD700;">Vibe</span> 🐾
              </h1>
              <p style="margin: 8px 0 0 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: rgba(255,255,255,0.85);">
                ${headerSubtitle}
              </p>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 36px 32px; background-color: #FFFFFF;">
              <div style="margin-bottom: 24px;">
                ${formattedBody}
              </div>

              <!-- Partnership Value Proposition Card -->
              <div style="background-color: #F8F5FC; border-left: 4px solid #FF007F; border-radius: 10px; padding: 18px 20px; margin: 28px 0;">
                <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 800; color: #15002C; text-transform: uppercase; letter-spacing: 0.5px;">
                  ✨ ${isTr ? "PawVibe Partner Avantajları:" : "Why Partner with PawVibe:"}
                </p>
                <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.7; color: #4A5568;">
                  <li>${isTr ? "Analiz sonrası pet sahibine nokta atışı ürün önerisi" : "AI recommendations tailored directly to pet emotional and behavioral states"}</li>
                  <li>${isTr ? "Yüksek satın alma motivasyonlu evcil hayvan sahipleri kitlesi" : "High-intent pet parents actively caring for pet well-being"}</li>
                  <li>${isTr ? "Sıfır riskli affiliate ve doğrudan yönlendirme modeli" : "Zero-friction affiliate and direct placement revenue models"}</li>
                </ul>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin-top: 36px; margin-bottom: 20px;">
                <a href="${ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, #FF007F 0%, #6A4C93 100%); color: #FFFFFF; font-size: 15px; font-weight: 800; text-decoration: none; padding: 16px 32px; border-radius: 50px; box-shadow: 0 8px 20px rgba(255,0,127,0.35);">
                  ${ctaText}
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F7FAFC; padding: 24px 30px; text-align: center; border-top: 1px solid #EDF2F7;">
              <p style="margin: 0; font-size: 12px; color: #A0AEC0;">
                PawVibe App • ${footerNote}
              </p>
              <p style="margin: 6px 0 0 0; font-size: 11px; color: #CBD5E0;">
                ${isTr ? "İletişim: partnership@pawvibe.app" : "Contact: partnership@pawvibe.app"}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

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

    const {
      petshop_ids,
      language = "tr",
      subject_template,
      body_template,
      from_email = "PawVibe Partnerships <onboarding@resend.dev>",
    } = await req.json();

    if (!Array.isArray(petshop_ids) || petshop_ids.length === 0) {
      throw new Error("petshop_ids array cannot be empty");
    }

    if (!subject_template || !body_template) {
      throw new Error("subject_template and body_template are required");
    }

    // 2. Fetch petshops
    const { data: petshops, error: fetchError } = await adminClient
      .from("petshops")
      .select("*")
      .in("id", petshop_ids);

    if (fetchError) throw fetchError;
    if (!petshops || petshops.length === 0) {
      throw new Error("No petshops found matching the provided IDs");
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    let sentCount = 0;
    let failedCount = 0;
    const logs: any[] = [];

    // 3. Process each petshop
    for (const shop of petshops) {
      // Dynamic replacement of tags
      const personalizedSubject = subject_template
        .replace(/{{shop_name}}/gi, shop.name)
        .replace(/{{website}}/gi, shop.website || "")
        .replace(/{{city}}/gi, shop.city || "");

      const personalizedBody = body_template
        .replace(/{{shop_name}}/gi, shop.name)
        .replace(/{{website}}/gi, shop.website || "")
        .replace(/{{city}}/gi, shop.city || "");

      const htmlContent = buildHtmlEmail({
        shopName: shop.name,
        bodyContent: personalizedBody,
        language: (shop.country === "US" ? "en" : language) as "tr" | "en",
        website: shop.website,
        city: shop.city,
      });

      let status = "sent";
      let errorMessage: string | null = null;

      // 4. Send Email via Resend if API key is present
      if (resendApiKey) {
        try {
          const resendResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: from_email,
              to: [shop.email],
              subject: personalizedSubject,
              html: htmlContent,
            }),
          });

          if (!resendResponse.ok) {
            const errBody = await resendResponse.text();
            status = "failed";
            errorMessage = `Resend Error: ${errBody}`;
            failedCount++;
          } else {
            sentCount++;
          }
        } catch (e: any) {
          status = "failed";
          errorMessage = e.message;
          failedCount++;
        }
      } else {
        // Simulated / Queued state if RESEND_API_KEY is not yet added in Supabase Secrets
        sentCount++;
        errorMessage = "RESEND_API_KEY not configured in Supabase Secrets. Email logged and simulated successfully.";
      }

      // 5. Insert Log
      const { data: logEntry } = await adminClient.from("petshop_email_logs").insert([
        {
          petshop_id: shop.id,
          recipient_email: shop.email,
          subject: personalizedSubject,
          language: (shop.country === "US" ? "en" : language),
          status,
          error_message: errorMessage,
        },
      ]).select().single();

      if (logEntry) logs.push(logEntry);

      // 6. Update petshop status & last_contacted_at
      if (status === "sent") {
        await adminClient
          .from("petshops")
          .update({
            status: "contacted",
            last_contacted_at: new Date().toISOString(),
          })
          .eq("id", shop.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: petshops.length,
        sent: sentCount,
        failed: failedCount,
        resend_configured: !!resendApiKey,
        logs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[send-petshop-outreach] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: corsHeaders,
    });
  }
});
