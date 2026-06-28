import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

export type PresetKey = 'today' | 'week' | 'month' | 'year' | 'custom';

export interface DateRange {
  key: PresetKey;
  label: string;
  startDate?: string; // ISO
  endDate?: string; // ISO
}

export function buildPreset(key: Exclude<PresetKey, 'custom'>): DateRange {
  const now = dayjs();
  switch (key) {
    case 'today':
      return { key, label: 'Hoje', startDate: now.startOf('day').toISOString(), endDate: now.endOf('day').toISOString() };
    case 'week':
      return {
        key,
        label: 'Esta Semana',
        startDate: now.startOf('week').toISOString(),
        endDate: now.endOf('week').toISOString(),
      };
    case 'month':
      return {
        key,
        label: 'Este Mês',
        startDate: now.startOf('month').toISOString(),
        endDate: now.endOf('month').toISOString(),
      };
    case 'year':
      return {
        key,
        label: 'Este Ano',
        startDate: now.startOf('year').toISOString(),
        endDate: now.endOf('year').toISOString(),
      };
  }
}

/** Converte "DD/MM/YYYY" em ISO; retorna undefined se inválido. */
export function parseBrDate(input: string, endOfDay = false): string | undefined {
  const d = dayjs(input, 'DD/MM/YYYY', true);
  if (!d.isValid()) return undefined;
  return (endOfDay ? d.endOf('day') : d.startOf('day')).toISOString();
}

export function customRange(startBr: string, endBr: string): DateRange | null {
  const startDate = parseBrDate(startBr, false);
  const endDate = parseBrDate(endBr, true);
  if (!startDate || !endDate) return null;
  return { key: 'custom', label: `${startBr} a ${endBr}`, startDate, endDate };
}
