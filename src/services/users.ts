import { supabase } from '@/lib/supabase';
import { Profile, Role } from '@/types';

export async function listUsers(): Promise<Profile[]> {
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

export async function updateUser(id: string, fields: Partial<Pick<Profile, 'full_name' | 'role' | 'active'>>) {
  const { error } = await supabase.from('profiles').update(fields).eq('id', id);
  if (error) throw error;
}

export async function setUserActive(id: string, active: boolean) {
  return updateUser(id, { active });
}
