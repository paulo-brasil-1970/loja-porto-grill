import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── CORS ────────────────────────────────────────────────────────────────────
// Necessário para que o navegador aceite a resposta da Edge Function.
// O frontend React (portogrill.com.br/cardapio) chama esta função diretamente.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── HANDLER PRINCIPAL ───────────────────────────────────────────────────────
serve(async (req) => {
  // Preflight CORS — o navegador envia OPTIONS antes de toda requisição cross-origin
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 1. AUTENTICAÇÃO ───────────────────────────────────────────────────────
    // O frontend envia o JWT do usuário logado no header Authorization.
    // Se não vier, rejeitamos imediatamente — não criamos PIX para anônimos.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return resposta({ error: "Não autorizado" }, 401);
    }

    // ── 2. DOIS CLIENTES SUPABASE ─────────────────────────────────────────────
    //
    // supabaseUser → usa o JWT do usuário → respeita o RLS do banco
    //   Usamos para verificar quem é o usuário autenticado.
    //
    // supabaseAdmin → usa a service_role key → bypassa RLS
    //   Usamos para UPDATE em loja.pedidos, porque a policy do pedido
    //   permite apenas o dono fazer SELECT, mas o sistema precisa atualizar
    //   as colunas de pagamento (id_pagamento_mp, pix_copia_e_cola, etc.)
    //   em nome do servidor, não do usuário.
    //
    // SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY são
    // injetados automaticamente pelo Supabase em todas as Edge Functions.
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── 3. VERIFICAR USUÁRIO ──────────────────────────────────────────────────
    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return resposta({ error: "Usuário não autenticado" }, 401);
    }

    // ── 4. LER BODY ───────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const { pedido_id } = body;

    if (!pedido_id) {
      return resposta({ error: "pedido_id é obrigatório" }, 400);
    }

    // ── 5. BUSCAR PEDIDO ──────────────────────────────────────────────────────
    // Usamos o admin para buscar — assim não dependemos do RLS para leitura aqui.
    // A segurança é garantida na próxima etapa: verificamos que o pedido
    // pertence ao usuário autenticado.
    const { data: pedido, error: pedidoError } = await supabaseAdmin
      .schema("loja")
      .from("pedidos")
      .select(
        "id, numero, total, status, status_pagamento, id_pagamento_mp, pix_copia_e_cola, pix_expira_em, cliente_vip_id"
      )
      .eq("id", pedido_id)
      .single();

    if (pedidoError || !pedido) {
      return resposta({ error: "Pedido não encontrado" }, 404);
    }

    // ── 6. VERIFICAR PROPRIEDADE DO PEDIDO ───────────────────────────────────
    // Garante que um usuário não possa criar PIX para o pedido de outro.
    // cliente_vip_id é o auth.uid() do cliente que criou o pedido.
    if (pedido.cliente_vip_id !== user.id) {
      return resposta({ error: "Acesso negado" }, 403);
    }

    // ── 7. IDEMPOTÊNCIA ───────────────────────────────────────────────────────
    // Se o pedido já tem um PIX gerado E ele ainda não expirou,
    // retornamos o existente sem chamar a API do MP de novo.
    // Isso evita duplicar pagamentos se o usuário recarregar a página.
    if (pedido.id_pagamento_mp && pedido.pix_expira_em) {
      const expira = new Date(pedido.pix_expira_em);
      if (expira > new Date() && pedido.status_pagamento !== "approved") {
        // Busca o QR code atualizado do MP (precisamos do base64 para a imagem)
        const mpToken = Deno.env.get("MP_ACCESS_TOKEN")!;
        const mpGet = await fetch(
          `https://api.mercadopago.com/v1/payments/${pedido.id_pagamento_mp}`,
          { headers: { Authorization: `Bearer ${mpToken}` } }
        );
        const mpGetData = await mpGet.json();

        return resposta({
          qr_code_base64:
            mpGetData.point_of_interaction?.transaction_data?.qr_code_base64 ??
            null,
          copia_e_cola: pedido.pix_copia_e_cola,
          expira_em: pedido.pix_expira_em,
          payment_id: pedido.id_pagamento_mp,
          reutilizado: true,
        });
      }
    }

    // ── 8. VERIFICAR SE O PEDIDO JÁ FOI PAGO ─────────────────────────────────
    if (pedido.status_pagamento === "approved") {
      return resposta({ error: "Este pedido já foi pago" }, 409);
    }

    // ── 9. CRIAR PAGAMENTO PIX NO MERCADO PAGO ────────────────────────────────
    const mpToken = Deno.env.get("MP_ACCESS_TOKEN")!;

    // PIX expira em 30 minutos — tempo suficiente para o cliente pagar
    const expiraEm = new Date(Date.now() + 30 * 60 * 1000);

    // X-Idempotency-Key: usamos pedido_id como chave.
    // Se esta função for chamada duas vezes com o mesmo pedido_id antes de
    // expirar, o MP retorna o mesmo pagamento em vez de criar um novo.
    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mpToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": pedido_id,
      },
      body: JSON.stringify({
        transaction_amount: Number(pedido.total),
        payment_method_id: "pix",
        payer: {
          // O MP exige um email. Usamos o do usuário autenticado.
          // Em produção, garantir que o usuário sempre tenha email.
          email: user.email ?? "cliente@portogrill.com.br",
        },
        date_of_expiration: expiraEm.toISOString(),
        description: `Pedido Porto Grill #${String(pedido.numero).padStart(4, "0")}`,
      }),
    });

    const mpData = await mpResponse.json();

    // Se o MP retornar erro, logamos e retornamos 502 (Bad Gateway)
    if (!mpResponse.ok) {
      console.error("Erro Mercado Pago:", JSON.stringify(mpData));
      return resposta(
        {
          error: "Falha ao criar pagamento PIX no Mercado Pago",
          codigo: mpData?.cause?.[0]?.code ?? null,
        },
        502
      );
    }

    const qrCode =
      mpData.point_of_interaction?.transaction_data?.qr_code;
    const qrCodeBase64 =
      mpData.point_of_interaction?.transaction_data?.qr_code_base64;

    if (!qrCode) {
      console.error("MP não retornou QR code:", JSON.stringify(mpData));
      return resposta({ error: "Mercado Pago não retornou QR code PIX" }, 502);
    }

    // ── 10. ATUALIZAR PEDIDO NO BANCO ─────────────────────────────────────────
    // Gravamos os dados do PIX no pedido para:
    //   - exibir novamente se o usuário voltar à tela
    //   - comparar com o webhook quando o pagamento for confirmado
    const { error: updateError } = await supabaseAdmin
      .schema("loja")
      .from("pedidos")
      .update({
        id_pagamento_mp: String(mpData.id),
        pix_copia_e_cola: qrCode,
        pix_expira_em: expiraEm.toISOString(),
        status_pagamento: "aguardando",
        forma_pagamento: "pix",
      })
      .eq("id", pedido_id);

    if (updateError) {
      // Não falhamos aqui: o PIX já foi criado no MP.
      // O pior cenário é o usuário pagar e o webhook atualizar o banco depois.
      // Logamos para monitoramento.
      console.error("Aviso: erro ao atualizar pedido após criar PIX:", updateError);
    }

    // ── 11. RETORNAR DADOS DO PIX PARA O FRONTEND ─────────────────────────────
    return resposta({
      qr_code_base64: qrCodeBase64,   // base64 para renderizar a imagem do QR
      copia_e_cola: qrCode,           // string do PIX copia e cola
      expira_em: expiraEm.toISOString(), // para o timer regressivo no frontend
      payment_id: String(mpData.id),  // ID do pagamento no MP (para polling)
    });
  } catch (err) {
    console.error("Erro interno criar-pagamento-pix:", err);
    return resposta({ error: "Erro interno do servidor" }, 500);
  }
});

// ─── HELPER ──────────────────────────────────────────────────────────────────
function resposta(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
