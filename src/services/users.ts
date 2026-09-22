import { supabase } from '@/lib/supabase';
import { Profile, Role } from '@/types';

/**
 * Lista os usuários, com o último acesso quando disponível.
 *
 * Tenta a função `admin_list_users` (migração 0007), que traz o
 * `last_sign_in_at` de `auth.users`. Se ela ainda não existir no banco, cai na
 * tabela `profiles` — a lista continua funcionando, só sem a data de acesso.
 */
export async function listUsers(): Promise<Profile[]> {
  const withAccess = await supabase.rpc('admin_list_users');
  if (!withAccess.error) return (withAccess.data ?? []) as Profile[];

  const { data, error } = await supabase.from('profiles').select('*').order('full_name');
  if (error) throw error;
  return (data ?? []) as Profile[];
}

/**
 * Cria usuário de forma SEGURA via Edge Function (service role no servidor).
 * Nunca cria usuários do Auth diretamente pelo app.
 */
export async function createUser(params: {
  email: string;
  password: string;
  full_name: string;
  role: Role;
  client_id?: string | null;
}) {
  const { data, error } = await supabase.functions.invoke('admin-create-user', {
    body: params,
  });
  if (error) {
    // Mensagens de erro detalhadas vêm no corpo da resposta.
    const ctx = (error as any).context;
    let msg = error.message;
    try {
      const body = await ctx?.json?.();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

export async function updateUser(
  id: string,
  fields: Partial<Pick<Profile, 'full_name' | 'role' | 'active' | 'notes' | 'cpf' | 'birth_date'>>
) {
  const { error } = await supabase.from('profiles').update(fields).eq('id', id);
  if (error) throw error;
}

export async function setUserActive(id: string, active: boolean) {
  return updateUser(id, { active });
}
