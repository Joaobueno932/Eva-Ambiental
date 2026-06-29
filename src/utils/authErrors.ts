/**
 * Helpers para traduzir erros de autenticação/perfil em mensagens claras
 * para o usuário, sem expor dados sensíveis.
 */

export type AuthIssueKind =
  | 'no-profile'
  | 'inactive'
  | 'invalid-role'
  | 'permission'
  | 'missing-table'
  | 'network'
  | 'unknown';

export interface AuthIssue {
  kind: AuthIssueKind;
  message: string;
  /** true quando o problema é definitivo de conta e o usuário deve ser deslogado */
  signOut: boolean;
}

const VALID_ROLES = ['admin', 'analyst', 'viewer'];

export const AUTH_MESSAGES: Record<AuthIssueKind, string> = {
  'no-profile': 'Usuário autenticado, mas perfil não encontrado. Verifique a tabela profiles.',
  inactive: 'Usuário inativo. Entre em contato com o administrador.',
  'invalid-role': 'Perfil de acesso inválido. Verifique as permissões do usuário.',
  permission:
    'Sem permissão para ler o perfil. Verifique os GRANTs/policies da tabela profiles no Supabase.',
  'missing-table': 'Tabela de perfis não encontrada. Rode as migrations no Supabase.',
  network: 'Não foi possível conectar ao Supabase. Verifique a internet e as variáveis do ambiente.',
  unknown: 'Não foi possível carregar seu perfil. Tente novamente.',
};

/** Classifica o erro retornado pelo Supabase ao buscar o perfil. */
export function describeProfileError(error: any): AuthIssue {
  const code: string | undefined = error?.code;
  const msg = String(error?.message ?? '');

  // PGRST116 = .single() não encontrou linha (perfil inexistente)
  if (code === 'PGRST116') return issue('no-profile', true);
  // 42501 = permissão negada (faltam GRANTs / policy de SELECT)
  if (code === '42501') return issue('permission', false);
  // PGRST205 / 42P01 = tabela inexistente (migrations não rodaram)
  if (code === 'PGRST205' || code === '42P01') return issue('missing-table', false);
  // Falhas de rede/conexão
  if (/network|fetch|timeout|connection|failed to fetch|networkerror/i.test(msg)) {
    return issue('network', false);
  }
  return issue('unknown', false);
}

/** Valida os dados do perfil já carregado (ativo + role válido). */
export function validateProfile(data: { role?: string | null; active?: boolean } | null): AuthIssue | null {
  if (!data) return issue('no-profile', true);
  if (!data.role || !VALID_ROLES.includes(data.role)) return issue('invalid-role', true);
  if (!data.active) return issue('inactive', true);
  return null;
}

/** Mensagem amigável para erros do signInWithPassword. */
export function describeSignInError(error: any): string {
  const msg = String(error?.message ?? '');
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(msg)) return 'E-mail ainda não confirmado.';
  if (/network|fetch|timeout|connection|failed to fetch/i.test(msg)) {
    return AUTH_MESSAGES.network;
  }
  return 'Não foi possível entrar. Tente novamente.';
}

function issue(kind: AuthIssueKind, signOut: boolean): AuthIssue {
  return { kind, message: AUTH_MESSAGES[kind], signOut };
}
