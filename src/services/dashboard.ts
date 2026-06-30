import { supabase } from '@/lib/supabase';
import { DashboardStats, Weighing } from '@/types';
import { colors } from '@/theme/colors';

export interface DashboardRange {
  startDate?: string;
  endDate?: string;
}

/**
 * Calcula os indicadores do painel a partir das pesagens no período.
 * Considera apenas pesagens aprovadas + pendentes (não rejeitadas) para peso.
 */
export async function getDashboardStats(range: DashboardRange = {}): Promise<DashboardStats> {
  let q = supabase
    .from('weighings')
    .select(
      `id, weight_kg, approval_status, people_count, could_divert_from_landfill,
       waste_type:waste_types(name, color, is_divertible),
       treatment_type:treatment_types(name, counts_as_diversion),
       recipient:recipients(name, is_landfill)`
    )
    .neq('approval_status', 'rejected')
    .is('canceled_at', null); // pesagens canceladas não entram no painel

  if (range.startDate) q = q.gte('weighing_date', range.startDate);
  if (range.endDate) q = q.lte('weighing_date', range.endDate);

  const { data, error } = await q;
  if (error) throw error;

  const rows = (data ?? []) as unknown as Weighing[];

  const totalWeighings = rows.length;
  const totalWeight = rows.reduce((acc, w) => acc + Number(w.weight_kg ?? 0), 0);

  // Taxa de desvio de aterro: peso desviado / peso total * 100
  const diverted = rows
    .filter((w) => w.treatment_type?.counts_as_diversion)
    .reduce((acc, w) => acc + Number(w.weight_kg ?? 0), 0);
  const diversionRate = totalWeight > 0 ? (diverted / totalWeight) * 100 : 0;

  // Distribuição por tipo de resíduo
  const wasteMap = new Map<string, { name: string; color: string; weight: number }>();
  rows.forEach((w) => {
    const name = w.waste_type?.name ?? 'Não informado';
    const color = w.waste_type?.color ?? colors.green;
    const prev = wasteMap.get(name) ?? { name, color, weight: 0 };
    prev.weight += Number(w.weight_kg ?? 0);
    wasteMap.set(name, prev);
  });
  const byWasteType = [...wasteMap.values()].sort((a, b) => b.weight - a.weight);

  // Distribuição por tipo de tratamento
  const treatMap = new Map<string, number>();
  rows.forEach((w) => {
    const name = w.treatment_type?.name ?? 'Não informado';
    treatMap.set(name, (treatMap.get(name) ?? 0) + Number(w.weight_kg ?? 0));
  });
  const byTreatment = [...treatMap.entries()]
    .map(([name, weight]) => ({ name, weight }))
    .sort((a, b) => b.weight - a.weight);

  // Clientes e unidades ativos (cadastro)
  const [{ count: activeClients }, { count: activeUnits }] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('active', true),
    supabase.from('units').select('id', { count: 'exact', head: true }).eq('active', true),
  ]);

  // ── Geração per capita ──────────────────────────────────────────────────────
  const rowsWithPeople = rows.filter((w) => (w.people_count ?? 0) > 0);
  const totalPeople = rowsWithPeople.reduce((acc, w) => acc + (w.people_count ?? 0), 0);
  const weightWithPeople = rowsWithPeople.reduce((acc, w) => acc + Number(w.weight_kg ?? 0), 0);
  const avgKgPerPerson = totalPeople > 0 ? weightWithPeople / totalPeople : 0;

  // ── Potencial de desvio perdido ──────────────────────────────────────────────
  // Base: pesagens enviadas para destinatário marcado como aterro (recipient.is_landfill).
  // Potencial perdido: dessas, as marcadas com could_divert_from_landfill = true.
  const landfillRows = rows.filter((w) => (w.recipient as any)?.is_landfill === true);
  const divertibleWeight = landfillRows.reduce((acc, w) => acc + Number(w.weight_kg ?? 0), 0);
  const lostRows = landfillRows.filter((w) => (w as any).could_divert_from_landfill === true);
  const lostWeight = lostRows.reduce((acc, w) => acc + Number(w.weight_kg ?? 0), 0);
  const lostDiversionRate = divertibleWeight > 0 ? (lostWeight / divertibleWeight) * 100 : 0;

  return {
    totalWeighings,
    totalWeight,
    activeClients: activeClients ?? 0,
    activeUnits: activeUnits ?? 0,
    diversionRate,
    byWasteType,
    byTreatment,
    perCapita: {
      avgKgPerPerson,
      totalPeople,
      weighingsWithPeople: rowsWithPeople.length,
    },
    lostDiversion: {
      rate: lostDiversionRate,
      lostWeight,
      divertibleWeight,
    },
  };
}
