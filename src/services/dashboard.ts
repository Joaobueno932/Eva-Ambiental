import dayjs from 'dayjs';
import { supabase } from '@/lib/supabase';
import { DashboardStats, Weighing } from '@/types';
import { colors } from '@/theme/colors';
import { treatmentDiversionFactor } from '@/utils/format';

export interface DashboardRange {
  startDate?: string;
  endDate?: string;
  clientId?: string;
  unitId?: string;
  /**
   * Preset que originou o período, quando houver.
   *
   * Define contra o que o período é comparado: "Este Mês" se compara ao mês
   * anterior inteiro, não aos 30 dias anteriores — é o que o usuário entende
   * por "mês anterior" ao ler a variação.
   */
  presetKey?: 'today' | 'week' | 'month' | 'year' | 'custom';
}

const COMPARISON_LABEL: Record<string, string> = {
  today: 'vs. dia anterior',
  week: 'vs. semana anterior',
  month: 'vs. mês anterior',
  year: 'vs. ano anterior',
  custom: 'vs. período anterior',
};

const PRESET_UNIT = { today: 'day', week: 'week', month: 'month', year: 'year' } as const;

/** Período anterior comparável, ou `null` quando o recorte não tem datas. */
function previousWindow(range: DashboardRange): DashboardRange | null {
  if (!range.startDate || !range.endDate) return null;
  const start = dayjs(range.startDate);

  const preset = range.presetKey && range.presetKey !== 'custom' ? range.presetKey : null;
  if (preset) {
    const unit = PRESET_UNIT[preset];
    const previous = start.subtract(1, unit);
    return { ...range, startDate: previous.startOf(unit).toISOString(), endDate: previous.endOf(unit).toISOString() };
  }

  // Período livre: mesma duração, imediatamente antes.
  const days = dayjs(range.endDate).diff(start, 'day') + 1;
  return {
    ...range,
    startDate: start.subtract(days, 'day').toISOString(),
    endDate: start.subtract(1, 'millisecond').toISOString(),
  };
}

/** Os quatro números que o painel compara entre períodos. */
function periodTotals(rows: Weighing[]) {
  const weight = rows.reduce((acc, w) => acc + Number(w.weight_kg ?? 0), 0);
  const diverted = rows
    .reduce((acc, w) => acc + Number(w.weight_kg ?? 0) * treatmentDiversionFactor(w.treatment_type), 0);
  return {
    count: rows.length,
    weight,
    diversionRate: weight > 0 ? (diverted / weight) * 100 : 0,
    pending: rows.filter((w) => w.approval_status === 'pending').length,
  };
}

/**
 * Variação percentual entre dois valores.
 *
 * Sem base anterior não há variação percentual: de 0 para 5 não é "+500%" nem
 * "+100%", é uma grandeza nova. Devolve `null` para a interface omitir o selo
 * em vez de exibir um número inventado.
 */
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * Busca as pesagens que entram no painel para um recorte.
 *
 * O resíduo e o tratamento vêm com `*` e não com as colunas nomeadas: pedir
 * uma coluna que não existe faz o banco recusar a consulta inteira, e o painel
 * quebraria. É o caso de `is_divertible` (só existe a partir da migração 0012,
 * embora esta consulta o pedisse desde sempre) e do fator de desvio (0011).
 * Com `*` chega o que existir, e os cálculos caem no comportamento antigo
 * quando o campo não vem.
 */
async function fetchRows(range: DashboardRange): Promise<Weighing[]> {
  let q = supabase
    .from('weighings')
    .select(
      `id, weight_kg, approval_status, people_count, could_divert_from_landfill,
       waste_type:waste_types(*),
       treatment_type:treatment_types(*),
       recipient:recipients(name, is_landfill)`
    )
    .neq('approval_status', 'rejected')
    .is('canceled_at', null); // pesagens canceladas não entram no painel

  if (range.startDate) q = q.gte('weighing_date', range.startDate);
  if (range.endDate) q = q.lte('weighing_date', range.endDate);
  if (range.clientId) q = q.eq('client_id', range.clientId);
  if (range.unitId) q = q.eq('unit_id', range.unitId);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as Weighing[];
}

/**
 * Calcula os indicadores do painel a partir das pesagens no período.
 * Considera apenas pesagens aprovadas + pendentes (não rejeitadas) para peso.
 */
export async function getDashboardStats(range: DashboardRange = {}): Promise<DashboardStats> {
  const rows = await fetchRows(range);

  const totalWeighings = rows.length;
  const totalWeight = rows.reduce((acc, w) => acc + Number(w.weight_kg ?? 0), 0);

  // Taxa de desvio de aterro: peso desviado / peso total * 100.
  // Cada pesagem contribui com o peso vezes o fator do seu tratamento — 1
  // para quem considera desvio, 0 para quem não considera, e o percentual
  // cadastrado quando há um (migração 0011). Se o peso total for zero, 0%.
  const diverted = rows
    .reduce((acc, w) => acc + Number(w.weight_kg ?? 0) * treatmentDiversionFactor(w.treatment_type), 0);
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

  // Clientes e unidades ativos (cadastro) e o período anterior, em paralelo —
  // a comparação não deve custar um segundo round-trip em série.
  const previousRange = previousWindow(range);
  const [{ count: activeClients }, { count: activeUnits }, previousRows] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('active', true),
    supabase.from('units').select('id', { count: 'exact', head: true }).eq('active', true),
    previousRange ? fetchRows(previousRange) : Promise.resolve(null),
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

  // ── Variação contra o período anterior ──────────────────────────────────────
  // Só compara se o período anterior teve movimento; um mês vazio não é uma
  // base contra a qual medir crescimento.
  let trend = null as DashboardStats['trend'];
  if (previousRows && previousRows.length > 0) {
    const previous = periodTotals(previousRows);
    const current = periodTotals(rows);
    trend = {
      label: COMPARISON_LABEL[range.presetKey ?? 'custom'] ?? COMPARISON_LABEL.custom,
      weighings: pctChange(current.count, previous.count),
      weight: pctChange(current.weight, previous.weight),
      // Taxa contra taxa se mede em pontos percentuais, não em porcentagem de
      // porcentagem: de 24% para 18% é −6 p.p., não −25%.
      diversionPoints: current.diversionRate - previous.diversionRate,
      pending: pctChange(current.pending, previous.pending),
    };
  }

  return {
    trend,
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
