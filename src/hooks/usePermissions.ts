import { useAuth } from '@/contexts/AuthContext';
import { Role, Weighing } from '@/types';

/**
 * O que cada perfil pode fazer, sem depender de quem está logado.
 *
 * Fica separada do hook para que a tela de Usuários possa mostrar as
 * permissões de um perfil qualquer — as do usuário sendo editado, não as de
 * quem edita. Uma segunda lista dessas regras na interface divergiria da
 * regra real no primeiro ajuste.
 */
export function permissionsForRole(role?: Role | null) {
  const isAdmin = role === 'admin';
  const isAnalyst = role === 'analyst';
  const isOperator = role === 'operator';
  const isViewer = role === 'viewer';

  return {
    isAdmin,
    isAnalyst,
    isOperator,
    isViewer,

    canCreateWeighing: isAdmin || isAnalyst || isOperator,
    canApprove: isAdmin || isAnalyst,
    canCancelWeighing: isAdmin || isAnalyst,
    canManageMasters: isAdmin,
    canManageUsers: isAdmin,
    canExportReports: true, // todos os perfis podem gerar PDF/CSV
    /** Edita pesagem de qualquer autor; os demais, só a própria e pendente. */
    canEditAnyWeighing: isAdmin,
  };
}

/**
 * Centraliza as regras de acesso por perfil (admin / analyst / operator / viewer).
 */
export function usePermissions() {
  const { profile } = useAuth();
  const role = profile?.role;
  const base = permissionsForRole(role);
  const { isAdmin, isAnalyst, isOperator } = base;

  return {
    role,
    ...base,

    /** Pode editar uma pesagem específica? */
    canEditWeighing: (w?: Weighing | null) => {
      if (!w || !profile) return false;
      if (w.canceled_at) return false; // pesagem cancelada não pode ser editada
      if (isAdmin) return true;
      if (isAnalyst || isOperator) return w.created_by === profile.id && w.approval_status === 'pending';
      return false;
    },
  };
}
