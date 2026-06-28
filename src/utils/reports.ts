import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { DashboardStats, Weighing } from '@/types';
import {
  approvalLabel,
  classifyDiversion,
  formatDate,
  formatDateTime,
  formatPercent,
  formatTime,
  formatWeight,
} from './format';

export interface ReportContext {
  periodLabel: string;
  stats: DashboardStats;
  weighings: Weighing[];
}

const SYSTEM = 'Eva Ambiental';
const TITLE = 'Relatório de Controle e Monitoramento';

function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildHtml(ctx: ReportContext): string {
  const { stats, weighings, periodLabel } = ctx;
  const cls = classifyDiversion(stats.diversionRate);

  const wasteRows = stats.byWasteType
    .map((w) => `<tr><td>${escapeHtml(w.name)}</td><td style="text-align:right">${formatWeight(w.weight)}</td></tr>`)
    .join('');
  const treatRows = stats.byTreatment
    .map((t) => `<tr><td>${escapeHtml(t.name)}</td><td style="text-align:right">${formatWeight(t.weight)}</td></tr>`)
    .join('');

  const detailRows = weighings
    .map(
      (w) => `
      <tr>
        <td>${formatDate(w.weighing_date)}</td>
        <td>${formatTime(w.weighing_date)}</td>
        <td>${escapeHtml(w.client?.name)}</td>
        <td>${escapeHtml(w.unit?.name)}</td>
        <td>${escapeHtml(w.waste_type?.name)}</td>
        <td style="text-align:right">${formatWeight(w.weight_kg)}</td>
        <td>${escapeHtml(w.treatment_type?.name)}</td>
        <td>${escapeHtml(w.recipient?.name ?? '-')}</td>
        <td>${escapeHtml(approvalLabel[w.approval_status])}</td>
        <td>${escapeHtml(w.creator?.full_name ?? '-')}</td>
        <td style="text-align:center">${w.photos?.length ?? 0}</td>
        <td>${escapeHtml(w.image_source ?? '-')}</td>
        <td>${escapeHtml(w.manual_location ?? (w.gps_lat ? `${w.gps_lat}, ${w.gps_lng}` : '-'))}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <style>
    * { font-family: -apple-system, Roboto, Arial, sans-serif; color: #1F2937; }
    body { padding: 24px; }
    .header { border-bottom: 4px solid #63B32E; padding-bottom: 12px; margin-bottom: 16px; }
    .brand { color: #4D8E26; font-size: 26px; font-weight: 800; }
    .title { font-size: 16px; font-weight: 600; margin-top: 2px; }
    .meta { color: #6B7280; font-size: 11px; margin-top: 6px; }
    h2 { color: #4D8E26; font-size: 14px; margin: 22px 0 8px; border-left: 4px solid #A7D86E; padding-left: 8px; }
    .cards { display: flex; flex-wrap: wrap; gap: 10px; }
    .card { background: #EEF8E7; border-radius: 12px; padding: 12px 14px; min-width: 150px; flex: 1; }
    .card .label { font-size: 10px; color: #4D8E26; text-transform: uppercase; }
    .card .value { font-size: 18px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 4px; }
    th { background: #63B32E; color: #fff; text-align: left; padding: 6px; }
    td { border-bottom: 1px solid #E5E7EB; padding: 5px 6px; }
    .badge { display:inline-block; padding:3px 8px; border-radius:999px; color:#fff; font-size:11px; font-weight:600; }
  </style></head>
  <body>
    <div class="header">
      <div class="brand">🌱 ${SYSTEM}</div>
      <div class="title">${TITLE}</div>
      <div class="meta">Período: ${escapeHtml(periodLabel)} &nbsp;•&nbsp; Gerado em: ${formatDateTime(new Date().toISOString())}</div>
    </div>

    <h2>Resumo Geral</h2>
    <div class="cards">
      <div class="card"><div class="label">Total de Pesagens</div><div class="value">${stats.totalWeighings}</div></div>
      <div class="card"><div class="label">Peso Total</div><div class="value">${formatWeight(stats.totalWeight)}</div></div>
      <div class="card"><div class="label">Clientes Ativos</div><div class="value">${stats.activeClients}</div></div>
      <div class="card"><div class="label">Unidades Ativas</div><div class="value">${stats.activeUnits}</div></div>
      <div class="card"><div class="label">Desvio de Aterro</div><div class="value">${formatPercent(stats.diversionRate)}</div>
        <span class="badge" style="background:${cls.color}">${cls.label}</span></div>
    </div>

    <h2>Distribuição por Tipo de Resíduo</h2>
    <table><thead><tr><th>Resíduo</th><th style="text-align:right">Peso</th></tr></thead><tbody>${wasteRows || '<tr><td colspan="2">Sem dados</td></tr>'}</tbody></table>

    <h2>Distribuição por Tipo de Tratamento</h2>
    <table><thead><tr><th>Tratamento</th><th style="text-align:right">Peso</th></tr></thead><tbody>${treatRows || '<tr><td colspan="2">Sem dados</td></tr>'}</tbody></table>

    <h2>Detalhamento das Pesagens (${weighings.length})</h2>
    <table>
      <thead><tr>
        <th>Data</th><th>Hora</th><th>Cliente</th><th>Unidade</th><th>Resíduo</th>
        <th>Peso</th><th>Tratamento</th><th>Destinatário</th><th>Status</th>
        <th>Responsável</th><th>Fotos</th><th>Origem</th><th>Localização</th>
      </tr></thead>
      <tbody>${detailRows || '<tr><td colspan="13">Nenhuma pesagem no período.</td></tr>'}</tbody>
    </table>
  </body></html>`;
}

/** Gera o PDF e abre o compartilhamento. */
export async function generatePdfReport(ctx: ReportContext): Promise<void> {
  const html = buildHtml(ctx);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Relatório Eva Ambiental' });
  }
}

const CSV_HEADERS = [
  'Data',
  'Hora',
  'Cliente',
  'Unidade',
  'Tipo de Resíduo',
  'Peso (kg)',
  'Tratamento',
  'Destinatário',
  'Status',
  'Aprovado por',
  'Responsável',
  'Qtd Fotos',
  'Origem Foto',
  'Localização',
  'Observações',
];

function csvCell(v: unknown): string {
  const s = String(v ?? '').replace(/"/g, '""');
  return `"${s}"`;
}

/** Gera CSV (separador ; — compatível com Excel pt-BR) e compartilha. */
export async function generateCsvReport(ctx: ReportContext): Promise<void> {
  const lines = [CSV_HEADERS.map(csvCell).join(';')];
  ctx.weighings.forEach((w) => {
    lines.push(
      [
        formatDate(w.weighing_date),
        formatTime(w.weighing_date),
        w.client?.name,
        w.unit?.name,
        w.waste_type?.name,
        Number(w.weight_kg ?? 0).toFixed(2).replace('.', ','),
        w.treatment_type?.name,
        w.recipient?.name ?? '-',
        approvalLabel[w.approval_status],
        w.approver?.full_name ?? '-',
        w.creator?.full_name ?? '-',
        w.photos?.length ?? 0,
        w.image_source ?? '-',
        w.manual_location ?? (w.gps_lat ? `${w.gps_lat}, ${w.gps_lng}` : '-'),
        w.notes ?? '',
      ]
        .map(csvCell)
        .join(';')
    );
  });

  const csv = '﻿' + lines.join('\n'); // BOM p/ acentuação no Excel
  const fileUri = `${FileSystem.cacheDirectory}eva-relatorio-${Date.now()}.csv`;
  await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'CSV Eva Ambiental' });
  }
}
