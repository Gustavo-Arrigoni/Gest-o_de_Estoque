import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function reply(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { success: false, error: "METHOD_NOT_ALLOWED", message: "Use POST." });

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return reply(401, { success: false, error: "UNAUTHORIZED", message: "Faça login para continuar." });
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const keys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
  const key = keys.default ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabase = createClient(url, key, {
    global: { headers: { Authorization: authorization } },
  });

  const token = authorization.slice(7);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return reply(401, { success: false, error: "INVALID_USER", message: "Sua sessão expirou. Entre novamente." });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply(400, { success: false, error: "INVALID_BODY", message: "Envie um JSON válido." });
  }

  const empresaId = body.empresa_id;
  const produtoId = body.produto_id;
  const tipo = body.tipo;
  const quantidade = String(body.quantidade ?? "");
  const motivo = typeof body.motivo === "string" ? body.motivo.trim() : "";
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (
    typeof empresaId !== "string" || !uuid.test(empresaId) ||
    typeof produtoId !== "string" || !uuid.test(produtoId) ||
    (tipo !== "entrada" && tipo !== "saida") ||
    !/^(?:0|[1-9]\d{0,10})(?:\.\d{1,3})?$/.test(quantidade) ||
    Number(quantidade) <= 0 ||
    motivo.length > 255
  ) {
    return reply(400, { success: false, error: "INVALID_DATA", message: "Confira o produto, tipo e quantidade informados." });
  }

  // A RLS confirma o vínculo do usuário. O trigger do banco bloqueia o
  // produto, atualiza o saldo e grava esta linha na mesma transação.
  const { data, error } = await supabase.from("movimentacoes_estoque")
    .insert({ empresa_id: empresaId, produto_id: produtoId, usuario_id: user.id, tipo, quantidade, motivo: motivo || null })
    .select("id,empresa_id,produto_id,usuario_id,tipo,quantidade,motivo,criado_em")
    .single();

  if (error) {
    const known = error.message.includes("Estoque insuficiente") ||
      error.message.includes("Produto não encontrado") ||
      error.message.includes("não tem acesso");
    return reply(known ? 400 : 500, {
      success: false,
      error: known ? "STOCK_OPERATION_REJECTED" : "STOCK_OPERATION_FAILED",
      message: known ? error.message : "Não foi possível registrar a movimentação.",
    });
  }

  return reply(201, { success: true, data, message: "Movimentação registrada com sucesso." });
});
