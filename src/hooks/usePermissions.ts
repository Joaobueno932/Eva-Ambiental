import { useAuth } from '@/contexts/AuthContext';
import { Weighing } from '@/types';

/**
 * Centraliza as regras de acesso por perfil (admin / analyst / viewer).
 */
export function usePermissions() {
  const { profile } = useAuth();
  const role = profile?.role;

  const isAdmin = role === 'admin';
  const isAnalyst = role === 'analyst';
  const isViewer = role === 'viewer';

  return {
    role,
    isAdmin,
    isAnalyst,
    isViewer,

    canCreateWeighing: isAdmin || isAnalyst,
    canApprove: isAdmin,
    canManageMasters: isAdmin,
    canManageUsers: isAdmin,
    canExportReports: true, // todos os perfis podem gerar PDF/CSV

    /** Pode editar uma pesagem específica? */
    canEditWeighing: (w?: Weighing | null) => {
      if (!w || !profile) return false;
      if (isAdmin) return true;
      if (isAnalyst) return w.created_by === profile.id && w.approval_status === 'pending';
      return false;
    },
  };
}
