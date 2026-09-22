import type { Weighing } from '../types';

/** Mirrors the existing dashboard scope without changing its calculations. */
export function operationSummary(records: Weighing[]) {
  const status = { pending: 0, approved: 0, rejected: 0, canceled: 0 };
  const daily = new Map<string, number>();
  for (const record of records) {
    if (record.canceled_at) { status.canceled++; continue; }
    status[record.approval_status]++;
    if (record.approval_status === 'rejected') continue;
    // Use local dates, consistent with the dates shown in the interface.
    const date = new Date(record.weighing_date);
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    daily.set(day, (daily.get(day) ?? 0) + Number(record.weight_kg));
  }
  return {
    status,
    exportCount: records.length - status.canceled,
    daily: [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, value]) => ({ label: day.split('-').reverse().join('/'), value })),
  };
}

/** Only persisted events; updated_at is not evidence of a specific decision. */
export function weighingEvents(w: Weighing) {
  const events = [{ label: 'Registro criado', date: w.created_at, detail: w.creator?.full_name }];
  if (w.approved_at && w.approval_status !== 'pending') {
    events.push({ label: w.approval_status === 'approved' ? 'Pesagem aprovada' : 'Pesagem rejeitada', date: w.approved_at,
      detail: [w.approver?.full_name, w.approval_status === 'rejected' ? w.rejection_reason : null].filter(Boolean).join(' • ') });
  }
  if (w.canceled_at) events.push({ label: 'Pesagem cancelada', date: w.canceled_at, detail: [w.canceler?.full_name, w.cancellation_reason].filter(Boolean).join(' • ') });
  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/** One day of the stacked column chart, counted by approval status. */
export interface DailyStatusPoint {
  /** Local day as `YYYY-MM-DD`. */
  day: string;
  /** Axis label as `DD/MM`. */
  label: string;
  approved: number;
  pending: number;
  rejected: number;
}

/** Local `YYYY-MM-DD` for a date-ish value, matching the dates shown in the interface. */
function localDay(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Counts per day and status for the evolution chart.
 *
 * Counted, not weighed: the chart answers how many weighings came in and how
 * their validation is going, so a single heavy load must not outrank a busy
 * day. Canceled records are left out, as they are everywhere else in the
 * panel.
 *
 * With `startDate`/`endDate` the series covers every day in the window,
 * including empty ones — a continuous axis is what makes a gap read as "no
 * weighings that day" instead of silently closing up.
 */
export function dailyStatusSeries(
  records: Weighing[],
  startDate?: string,
  endDate?: string
): DailyStatusPoint[] {
  const byDay = new Map<string, DailyStatusPoint>();

  const blank = (day: string): DailyStatusPoint => ({
    day,
    label: day.slice(5).split('-').reverse().join('/'),
    approved: 0,
    pending: 0,
    rejected: 0,
  });

  if (startDate && endDate) {
    // Walk the window in UTC so daylight-saving shifts cannot skip or repeat a day.
    const cursor = new Date(`${startDate.slice(0, 10)}T12:00:00Z`);
    const last = new Date(`${endDate.slice(0, 10)}T12:00:00Z`);
    let guard = 0;
    while (cursor <= last && guard++ < 400) {
      const day = cursor.toISOString().slice(0, 10);
      byDay.set(day, blank(day));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  for (const record of records) {
    if (record.canceled_at) continue;
    const day = localDay(record.weighing_date);
    const point = byDay.get(day) ?? blank(day);
    if (record.approval_status === 'approved') point.approved++;
    else if (record.approval_status === 'rejected') point.rejected++;
    else point.pending++;
    byDay.set(day, point);
  }

  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}
