// =============================================================
// Edge Function: admin-create-user
// =============================================================
// Cria usuários no Supabase Auth de forma SEGURA.
// - Valida que quem chama é um admin ATIVO (via JWT do usuário).
// - Usa a service_role key (somente no servidor) para criar o usuário.
// - O profile é criado automaticamente pelo trigger handle_new_user,
//   lendo full_name/role/active dos metadados.
//
// Deploy:  supabase functions deploy admin-create-user
// Secrets necessárias (já existem por padrão no projeto):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// =============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'Não autenticado.' }, 401);
    }

    // Cliente "como o usuário" para validar quem está chamando.
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) {
      return json({ error: 'Sessão inválida.' }, 401);
    }

    // Confirma que o solicitante é admin ativo.
    const { data: profile } = await userClient
      .from('profiles')
      .select('role, active')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin' || !profile.active) {
      return json({ error: 'Apenas administradores ativos podem criar usuários.' }, 403);
    }

    const body = await req.json();
    const { email, password, full_name, role, client_id } = body ?? {};

    if (!email || !password || !full_name || !role) {
      return json({ error: 'Campos obrigatórios: email, password, full_name, role.' }, 400);
    }
    if (!['admin', 'analyst', 'operator', 'viewer'].includes(role)) {
      return json({ error: 'Perfil inválido.' }, 400);
    }
    if (String(password).length < 6) {
      return json({ error: 'A senha deve ter ao menos 6 caracteres.' }, 400);
    }

    // Cliente admin (service role) — cria o usuário de fato.
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
        active: true,
        client_id: client_id ?? null,
      },
    });

    if (createErr) {
      return json({ error: createErr.message }, 400);
    }

    return json({ user: { id: created.user?.id, email: created.user?.email } }, 200);
  } catch (e) {
    return json({ error: (e as Error).message ?? 'Erro inesperado.' }, 500);
  }
});

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
