import { supabase } from '@/lib/supabase';
import { ApprovalStatus, LocationColumns, Weighing } from '@/types';

const SELECT_FULL = `
  *,
  client:clients(*),
  unit:units(*),
  waste_type:waste_types(*),
  treatment_type:treatment_types(*),
  recipient:recipients(*),
  creator:profiles!weighings_created_by_fkey(id, full_name, email, role),
  approver:profiles!weighings_approved_by_fkey(id, full_name, email, role),
  photos:weighing_photos(id, image_source)
`;

export interface WeighingFilters {
  search?: string;
  startDate?: string; // ISO
  endDate?: string; // ISO
  unitId?: string;
  wasteTypeId?: string;
  approvalStatus?: ApprovalStatus;
}

export async function listWeighings(filters: WeighingFilters = {}): Promise<Weighing[]> {
  let q = supabase.from('weighings').select(SELECT_FULL).order('weighing_date', { ascending: false });

  if (filters.startDate) q = q.gte('weighing_date', filters.startDate);
  if (filters.endDate) q = q.lte('weighing_date', filters.endDate);
  if (filters.unitId) q = q.eq('unit_id', filters.unitId);
  if (filters.wasteTypeId) q = q.eq('waste_type_id', filters.wasteTypeId);
  if (filters.approvalStatus) q = q.eq('approval_status', filters.approvalStatus);

  const { data, error } = await q;
  if (error) throw error;

  let rows = (data ?? []) as Weighing[];

  // Busca textual em memória (resíduo, unidade, operador, observações).
  if (filters.search?.trim()) {
    const s = filters.search.trim().toLowerCase();
    rows = rows.filter((w) =>
      [
        w.waste_type?.name,
        w.unit?.name,
        w.client?.name,
        w.creator?.full_name,
        w.notes,
        w.manual_location,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s))
    );
  }
  return rows;
}

export async function getWeighing(id: string): Promise<Weighing | null> {
  const { data, error } = await supabase.from('weighings').select(SELECT_FULL).eq('id', id).single();
  if (error) throw error;
  return data as Weighing;
}

export interface WeighingInput extends LocationColumns {
  client_id: string;
  unit_id: string;
  waste_type_id: string;
  treatment_type_id: string;
  recipient_id?: string | null;
  weighing_date: string;
  weight_kg: number;
  notes?: string | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
  manual_location?: string | null;
  image_source?: 'camera' | 'upload' | null;
  captured_at?: string | null;
}

export async function createWeighing(input: WeighingInput, userId: string): Promise<Weighing> {
  const { data, error } = await supabase
    .from('weighings')
    .insert({ ...input, created_by: userId, approval_status: 'pending', status: 'completed' })
    .select()
    .single();
  if (error) throw error;
  return data as Weighing;
}

export async function updateWeighing(id: string, input: Partial<WeighingInput>): Promise<Weighing> {
  const { data, error } = await supabase.from('weighings').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data as Weighing;
}

export async function approveWeighing(id: string, approverId: string): Promise<void> {
  const { error } = await supabase
    .from('weighings')
    .update({
      approval_status: 'approved',
      approved_by: approverId,
      approved_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function rejectWeighing(id: string, approverId: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from('weighings')
    .update({
      approval_status: 'rejected',
      approved_by: approverId,
      approved_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq('id', id);
  if (error) throw error;
}
