import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Fail-closed Service-to-Service Authentication (R2E.25B.1 Fase 4)
  const cronSecretHeader = req.headers.get("x-cron-secret") || req.headers.get("x-internal-secret");
  const configuredCronSecret = Deno.env.get("CRON_WORKER_SECRET") || Deno.env.get("CRON_SECRET");

  let isAuthorized = false;
  if (configuredCronSecret && cronSecretHeader && cronSecretHeader === configuredCronSecret) {
    isAuthorized = true;
  }

  if (!isAuthorized) {
    console.warn("[RunAutomationsCron] Unauthorized invocation attempt");
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const body = await req.json().catch(() => ({}));
    const { tenant_id } = body;
    
    console.log('[RunAutomationsCron] Authorized cron execution for automation queue...', { tenant_id: tenant_id || 'all' });

    // Step 1: Process the queue via service role
    const { data: queueResult, error: queueError } = await supabase.functions.invoke('process-automation-queue', {
      body: { tenant_id }
    });

    if (queueError) {
      console.error("[RunAutomationsCron] Error processing queue:", queueError);
      throw queueError;
    }

    console.log('[RunAutomationsCron] Process finished successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      queue_result: queueResult,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[RunAutomationsCron] Error:", error?.message || error);
    return new Response(JSON.stringify({ success: false, error: "Queue processing error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
