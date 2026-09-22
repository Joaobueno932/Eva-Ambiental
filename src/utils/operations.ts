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
