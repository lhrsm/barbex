// ==============================================================================
// BARBEX — EDGE FUNCTION: ai-assistant
// ==============================================================================
// Independent AI assistant service replacing legacy Lovable gateway.
// Supports:
// 1. admin-assistant (Super Admin platform health analysis)
// 2. loyalty-campaign-suggestions (Tenant loyalty campaign generation)
// Strictly enforces RBAC, distributed rate limiting, data minimization, and zero PII leaks.
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createSupabaseAdminClient } from "../_shared/supabase-admin.ts";
import { getAuthenticatedUser } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { AppError } from "../_shared/errors.ts";

interface RequestBody {
  action: "admin-assistant" | "loyalty-campaign-suggestions";
  question?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  tenantId?: string;
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse(new AppError("METHOD_NOT_ALLOWED", "Apenas POST permitido.", 405), corsHeaders);
  }

  const supabaseAdmin = createSupabaseAdminClient();

  try {
    // 1. Authenticate user
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return errorResponse(new AppError("UNAUTHORIZED", "Autenticação obrigatória.", 401), corsHeaders);
    }

    // 2. Rate limit: max 15 requests per minute per user
    const rateLimitKey = `ai_assistant_${user.id}`;
    const isAllowed = await checkRateLimit(supabaseAdmin, rateLimitKey, 15, 60);
    if (!isAllowed) {
      return errorResponse(new AppError("RATE_LIMIT_EXCEEDED", "Limite de requisições de IA excedido. Tente novamente em um minuto.", 429), corsHeaders);
    }

    const body: RequestBody = await req.json().catch(() => ({ action: "" as any }));
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    // ---------------------------------------------------------------------------
    // ACTION: admin-assistant (Super Admin Only)
    // ---------------------------------------------------------------------------
    if (body.action === "admin-assistant") {
      const { data: isAdmin, error: roleErr } = await supabaseAdmin.rpc("has_role", {
        _user_id: user.id,
        _role: "super_admin",
      });

      if (roleErr || !isAdmin) {
        return errorResponse(new AppError("FORBIDDEN", "Apenas Super Admin pode acessar o assistente geral.", 403), corsHeaders);
      }

      if (!body.question || typeof body.question !== "string" || body.question.trim().length === 0) {
        return errorResponse(new AppError("INVALID_PAYLOAD", "A pergunta é obrigatória.", 400), corsHeaders);
      }

      // Parallel aggregated snapshot (Data Minimization: NO passwords, tokens or raw customer lists)
      const [kpisRes, alertsRes, healthRes, recentTenantsRes, subsRes] = await Promise.all([
        supabaseAdmin.rpc("admin_executive_kpis"),
        supabaseAdmin.rpc("admin_anomaly_alerts"),
        supabaseAdmin.rpc("admin_tenant_health", { p_limit: 10 }),
        supabaseAdmin
          .from("profiles")
          .select("id, business_name, plan, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
        supabaseAdmin
          .from("subscriptions")
          .select("status, plan_id, updated_at")
          .order("updated_at", { ascending: false })
          .limit(20),
      ]);

      const snapshot = {
        generated_at: new Date().toISOString(),
        executive_kpis: kpisRes.data ?? null,
        anomaly_alerts: alertsRes.data ?? null,
        worst_health_tenants: healthRes.data ?? null,
        recent_signups: recentTenantsRes.data ?? null,
        recent_subscription_events: subsRes.data ?? null,
      };

      if (!openaiApiKey) {
        return jsonResponse(
          {
            success: true,
            data: {
              answer:
                "ℹ️ Provedor OpenAI não configurado no ambiente de teste. Snapshot analítico consolidado:\n\n```json\n" +
                JSON.stringify(snapshot, null, 2) +
                "\n```",
            },
          },
          200,
          corsHeaders
        );
      }

      const systemPrompt = `Você é o Assistente do Super Admin do Barbex (SaaS de gestão para barbearias).
Você recebe um snapshot READ-ONLY do banco em JSON e responde perguntas do operador em PORTUGUÊS.
Regras:
- Responda de forma CONCISA e ACIONÁVEL.
- Cite números específicos do snapshot.
- Se a pergunta pedir dado que NÃO está no snapshot, diga claramente que não possui esse dado.
- Formato Markdown simples. Sem HTML.`;

      const history = (body.history || []).slice(-6);

      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "system", content: `Snapshot atual (JSON):\n${JSON.stringify(snapshot)}` },
            ...history,
            { role: "user", content: body.question.trim().slice(0, 500) },
          ],
          temperature: 0.3,
          max_tokens: 800,
        }),
      });

      if (!aiResponse.ok) {
        return errorResponse(new AppError("AI_PROVIDER_ERROR", "Falha na comunicação com o provedor de IA.", 502), corsHeaders);
      }

      const json = await aiResponse.json();
      const answer = json.choices?.[0]?.message?.content || "Sem resposta gerada pelo modelo.";

      return jsonResponse({ success: true, data: { answer } }, 200, corsHeaders);
    }

    // ---------------------------------------------------------------------------
    // ACTION: loyalty-campaign-suggestions (Tenant Scoped)
    // ---------------------------------------------------------------------------
    if (body.action === "loyalty-campaign-suggestions") {
      const tenantId = user.id; // Enforce tenant ownership strictly from authenticated session

      const [{ count: customersCount }, { data: recentAppts }, { count: subsCount }] = await Promise.all([
        supabaseAdmin.from("customers").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        supabaseAdmin
          .from("appointments")
          .select("status, total_amount, created_at")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabaseAdmin
          .from("customer_subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId),
      ]);

      const completed = (recentAppts || []).filter((a: any) => a.status === "completed");
      const avgTicket =
        completed.length > 0
          ? completed.reduce((s: number, a: any) => s + Number(a.total_amount || 0), 0) / completed.length
          : 0;

      const defaultSuggestions = [
        {
          template_slug: "clube-dos-10",
          reason: "Mecânica simples e comprovada para aumentar recorrência.",
          tweak: { target: 10 },
        },
        {
          template_slug: "cashback-progressivo",
          reason: `Ticket médio atual R$${avgTicket.toFixed(2)} — cashback escalonado incentiva alta de consumo.`,
          tweak: {},
        },
        {
          template_slug: subsCount && subsCount > 0 ? "assinante-premium" : "indique-um-amigo",
          reason:
            subsCount && subsCount > 0
              ? "Você possui assinantes ativos — recompensar tempo de assinatura reduz cancelamento."
              : "Crescimento orgânico via indicação dos clientes atuais.",
          tweak: {},
        },
      ];

      if (!openaiApiKey) {
        return jsonResponse({ success: true, data: { suggestions: defaultSuggestions } }, 200, corsHeaders);
      }

      const prompt = `Você é um especialista em fidelização de barbearias. Com base nos dados agregados:
- Clientes cadastrados: ${customersCount ?? 0}
- Atendimentos concluídos recentes: ${completed.length}
- Ticket médio: R$ ${avgTicket.toFixed(2)}
- Assinantes ativos: ${subsCount ?? 0}

Sugira 3 campanhas de fidelidade escolhendo entre estes slugs:
clube-dos-10, cashback-progressivo, cliente-ouro, aniversariante-premium, indique-um-amigo, cliente-vip, desafio-mensal, clube-da-barba, clube-do-cabelo, combo-premiado, cliente-frequente, cliente-sem-falta, assinante-premium, compra-de-produtos, black-friday, natal, cliente-diamante, programa-corporativo, meta-anual.

Responda APENAS JSON no formato:
{"suggestions":[{"template_slug":"...","reason":"frase curta em português","tweak":{}}]}`;

      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.5,
        }),
      });

      if (!aiResponse.ok) {
        return jsonResponse({ success: true, data: { suggestions: defaultSuggestions } }, 200, corsHeaders);
      }

      const json = await aiResponse.json();
      const text = json.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(text);

      return jsonResponse(
        {
          success: true,
          data: { suggestions: parsed.suggestions || defaultSuggestions },
        },
        200,
        corsHeaders
      );
    }

    return errorResponse(new AppError("INVALID_ACTION", "Ação de IA desconhecida.", 400), corsHeaders);
  } catch (err: any) {
    return errorResponse(err, corsHeaders);
  }
});
