import { useAuth } from '@/contexts/AuthContext';
import { Weighing } from '@/types';

/**
 * Centraliza as regras de acesso por perfil (admin / analyst / operator / viewer).
 */
export function usePermissions() {
  const { profile } = useAuth();
  const role = profile?.role;

  const isAdmin = role === 'admin';
  const isAnalyst = role === 'analyst';
  const isOperator = role === 'operator';
  const isViewer = role === 'viewer';

  return {
    role,
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
