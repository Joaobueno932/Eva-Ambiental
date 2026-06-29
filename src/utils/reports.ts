import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
// SDK 54: a API clássica (writeAsStringAsync, cacheDirectory) vive em "expo-file-system/legacy".
import * as FileSystem from 'expo-file-system/legacy';
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

function weighingAddress(w: Weighing): string {
  return w.location_formatted_address || w.manual_location || w.location_place_name || 'Não informado';
}
function weighingCoords(w: Weighing): string {
  return w.gps_lat != null ? `${w.gps_lat}, ${w.gps_lng}` : '-';
}

function statusBadgeHtml(status: string): string {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    pending:  { bg: '#FEF3C7', text: '#92400E', label: 'Pendente' },
    approved: { bg: '#DCFCE7', text: '#166534', label: 'Aprovada' },
    rejected: { bg: '#FEE2E2', text: '#991B1B', label: 'Rejeitada' },
  };
  const c = map[status] ?? map.pending;
  return `<span class="badge" style="background:${c.bg};color:${c.text}">${c.label}</span>`;
}

function buildHtml(ctx: ReportContext): string {
  const { stats, weighings, periodLabel } = ctx;
  const cls = classifyDiversion(stats.diversionRate);
  const generatedAt = formatDateTime(new Date().toISOString());

  // Pesagens ativas (não canceladas) para os totais do resumo
  const activeWeighings = weighings.filter((w) => !w.canceled_at);
  const canceledCount = weighings.length - activeWeighings.length;

  const wasteRows = stats.byWasteType
    .map((w) => `<tr><td>${escapeHtml(w.name)}</td><td class="right">${formatWeight(w.weight)}</td></tr>`)
    .join('');
  const treatRows = stats.byTreatment
    .map((t) => `<tr><td>${escapeHtml(t.name)}</td><td class="right">${formatWeight(t.weight)}</td></tr>`)
    .join('');

  const weighingCards = weighings
    .map((w, i) => {
      const isCanceled = !!w.canceled_at;
      const addr = weighingAddress(w);
      const coords = weighingCoords(w);

      const canceledBadge = isCanceled
        ? `<span class="badge" style="background:#FEE2E2;color:#991B1B">Cancelada</span>`
        : '';

      const canceledInfo = isCanceled
        ? `<div class="cancel-box">
            <div class="cancel-row">
              <span class="cancel-label">Cancelada por:</span>
              <span class="cancel-value">${escapeHtml(w.canceler?.full_name ?? '-')} em ${formatDateTime(w.canceled_at!)}</span>
            </div>
            <div class="cancel-row">
              <span class="cancel-label">Motivo:</span>
              <span class="cancel-value">${escapeHtml(w.cancellation_reason ?? '-')}</span>
            </div>
          </div>`
        : '';

      return `
      <div class="wcard${isCanceled ? ' wcard-canceled' : ''}">
        <div class="wcard-header">
          <span class="wcard-num">Pesagem #${i + 1}</span>
          <div class="wcard-badges">${statusBadgeHtml(w.approval_status)}${canceledBadge}</div>
        </div>
        <div class="wcard-grid">
          <div class="wfield"><span class="wlabel">Data / Hora</span><span class="wvalue">${formatDate(w.weighing_date)} ${formatTime(w.weighing_date)}</span></div>
          <div class="wfield"><span class="wlabel">Peso</span><span class="wvalue">${formatWeight(w.weight_kg)}</span></div>
          <div class="wfield"><span class="wlabel">Cliente</span><span class="wvalue">${escapeHtml(w.client?.name ?? '-')}</span></div>
          <div class="wfield"><span class="wlabel">Unidade</span><span class="wvalue">${escapeHtml(w.unit?.name ?? '-')}</span></div>
          <div class="wfield"><span class="wlabel">Resíduo</span><span class="wvalue">${escapeHtml(w.waste_type?.name ?? '-')}</span></div>
          <div class="wfield"><span class="wlabel">Tratamento</span><span class="wvalue">${escapeHtml(w.treatment_type?.name ?? '-')}</span></div>
          <div class="wfield"><span class="wlabel">Destinatário</span><span class="wvalue">${escapeHtml(w.recipient?.name ?? 'Não informado')}</span></div>
          <div class="wfield"><span class="wlabel">Responsável</span><span class="wvalue">${escapeHtml(w.creator?.full_name ?? '-')}</span></div>
          <div class="wfield"><span class="wlabel">Fotos</span><span class="wvalue">${w.photos?.length ?? 0}</span></div>
          <div class="wfield"><span class="wlabel">Origem da imagem</span><span class="wvalue">${w.image_source === 'camera' ? 'Câmera' : w.image_source === 'upload' ? 'Anexo' : '-'}</span></div>
          <div class="wfield wfield-full"><span class="wlabel">Endereço</span><span class="wvalue">${escapeHtml(addr)}</span></div>
          <div class="wfield wfield-full"><span class="wlabel">Coordenadas</span><span class="wvalue">${escapeHtml(coords)}</span></div>
          ${w.notes ? `<div class="wfield wfield-full"><span class="wlabel">Observações</span><span class="wvalue">${escapeHtml(w.notes)}</span></div>` : ''}
        </div>
        ${canceledInfo}
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <style>
    * { font-family: -apple-system, Roboto, Arial, sans-serif; color: #1F2937; box-sizing: border-box; }
    body { padding: 24px; font-size: 11px; }
    .header { border-bottom: 4px solid #63B32E; padding-bottom: 12px; margin-bottom: 16px; }
    .brand { color: #4D8E26; font-size: 26px; font-weight: 800; }
    .title { font-size: 15px; font-weight: 600; margin-top: 2px; }
    .meta { color: #6B7280; font-size: 10px; margin-top: 6px; }
    h2 { color: #4D8E26; font-size: 13px; margin: 22px 0 8px; border-left: 4px solid #A7D86E; padding-left: 8px; }
    .cards { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 8px; }
    .card { background: #EEF8E7; border-radius: 10px; padding: 12px 14px; min-width: 130px; flex: 1; }
    .card .label { font-size: 9px; color: #4D8E26; text-transform: uppercase; letter-spacing: .5px; }
    .card .value { font-size: 17px; font-weight: 700; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 4px; }
    th { background: #63B32E; color: #fff; text-align: left; padding: 6px 8px; }
    td { border-bottom: 1px solid #E5E7EB; padding: 5px 8px; }
    .right { text-align: right; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; margin-left: 4px; }
    /* Weighing cards */
    .wcard { border: 1px solid #E5E7EB; border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; page-break-inside: avoid; }
    .wcard-canceled { border-color: #FECACA; background: #FFFAFA; }
    .wcard-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #63B32E; padding-bottom: 7px; margin-bottom: 10px; }
    .wcard-canceled .wcard-header { border-bottom-color: #FECACA; }
    .wcard-num { color: #4D8E26; font-weight: 700; font-size: 12px; }
    .wcard-canceled .wcard-num { color: #991B1B; }
    .wcard-badges { display: flex; gap: 4px; flex-wrap: wrap; }
    .wcard-grid { display: flex; flex-wrap: wrap; gap: 8px 12px; }
    .wfield { min-width: 45%; flex: 1; }
    .wfield-full { min-width: 100%; flex: 1 0 100%; }
    .wlabel { font-size: 9px; color: #6B7280; text-transform: uppercase; letter-spacing: .4px; display: block; margin-bottom: 1px; }
    .wvalue { font-size: 11px; color: #1F2937; font-weight: 600; display: block; }
    .cancel-box { margin-top: 10px; padding: 8px 10px; background: #FEE2E2; border-radius: 7px; }
    .cancel-row { display: flex; gap: 6px; margin-bottom: 3px; }
    .cancel-label { font-size: 10px; color: #991B1B; font-weight: 700; white-space: nowrap; }
    .cancel-value { font-size: 10px; color: #991B1B; }
  </style></head>
  <body>
    <div class="header">
      <div class="brand">🌱 ${SYSTEM}</div>
      <div class="title">${TITLE}</div>
      <div class="meta">
        Período: ${escapeHtml(periodLabel)}
        &nbsp;•&nbsp;
        Gerado em: ${generatedAt}
        ${canceledCount > 0 ? `&nbsp;•&nbsp; <span style="color:#991B1B">${canceledCount} cancelada(s) exibida(s)</span>` : ''}
      </div>
    </div>

    <h2>Resumo Geral</h2>
    <div class="cards">
      <div class="card"><div class="label">Total de Pesagens</div><div class="value">${stats.totalWeighings}</div></div>
      <div class="card"><div class="label">Peso Total</div><div class="value">${formatWeight(stats.totalWeight)}</div></div>
      <div class="card"><div class="label">Clientes Ativos</div><div class="value">${stats.activeClients}</div></div>
      <div class="card"><div class="label">Unidades Ativas</div><div class="value">${stats.activeUnits}</div></div>
      <div class="card">
        <div class="label">Desvio de Aterro</div>
        <div class="value">${formatPercent(stats.diversionRate)}</div>
        <span class="badge" style="background:${cls.color};color:#fff;margin-left:0">${cls.label}</span>
      </div>
    </div>

    <h2>Distribuição por Tipo de Resíduo</h2>
    <table>
      <thead><tr><th>Resíduo</th><th class="right">Peso</th></tr></thead>
      <tbody>${wasteRows || '<tr><td colspan="2">Sem dados</td></tr>'}</tbody>
    </table>

    <h2>Distribuição por Tipo de Tratamento</h2>
    <table>
      <thead><tr><th>Tratamento</th><th class="right">Peso</th></tr></thead>
      <tbody>${treatRows || '<tr><td colspan="2">Sem dados</td></tr>'}</tbody>
    </table>

    <h2>Detalhamento das Pesagens (${weighings.length})</h2>
    ${weighingCards || '<p style="color:#6B7280;font-style:italic">Nenhuma pesagem no período.</p>'}
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

// ─── CSV ─────────────────────────────────────────────────────────────────────

function csvCell(v: unknown): string {
  const s = String(v ?? '').replace(/"/g, '""');
  return `"${s}"`;
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(';');
}

function csvBlank(): string {
  return ';;;;;;;;;;;;;;;;;;;;;;;;;;';
}

/** Gera CSV estruturado (separador ; — compatível com Excel pt-BR) e compartilha. */
export async function generateCsvReport(ctx: ReportContext): Promise<void> {
  const { stats, weighings, periodLabel } = ctx;
  const cls = classifyDiversion(stats.diversionRate);
  const today = formatDate(new Date().toISOString());

  const lines: string[] = [];

  // ── Cabeçalho ──────────────────────────────────────────────
  lines.push(csvRow([SYSTEM]));
  lines.push(csvRow([TITLE]));
  lines.push(csvRow(['Período', periodLabel]));
  lines.push(csvRow(['Data de geração', today]));
  lines.push(csvRow(['Total de pesagens', stats.totalWeighings]));
  lines.push(csvRow(['Peso total (kg)', Number(stats.totalWeight).toFixed(2).replace('.', ',')]));
  lines.push(csvRow(['Taxa de desvio de aterro', `${Number(stats.diversionRate).toFixed(1).replace('.', ',')}%`]));
  lines.push(csvRow(['Desempenho', cls.label]));
  lines.push('');
  lines.push('');

  // ── Resumo por resíduo ─────────────────────────────────────
  lines.push(csvRow(['DISTRIBUIÇÃO POR TIPO DE RESÍDUO']));
  lines.push(csvRow(['Resíduo', 'Peso (kg)']));
  stats.byWasteType.forEach((w) => {
    lines.push(csvRow([w.name, Number(w.weight).toFixed(2).replace('.', ',')]));
  });
  lines.push('');
  lines.push('');

  // ── Resumo por tratamento ──────────────────────────────────
  lines.push(csvRow(['DISTRIBUIÇÃO POR TIPO DE TRATAMENTO']));
  lines.push(csvRow(['Tratamento', 'Peso (kg)']));
  stats.byTreatment.forEach((t) => {
    lines.push(csvRow([t.name, Number(t.weight).toFixed(2).replace('.', ',')]));
  });
  lines.push('');
  lines.push('');

  // ── Detalhamento ───────────────────────────────────────────
  lines.push(csvRow(['DETALHAMENTO DAS PESAGENS']));
  lines.push(
    csvRow([
      'Data',
      'Hora',
      'Cliente',
      'Unidade',
      'Resíduo',
      'Peso (kg)',
      'Tratamento',
      'Destinatário',
      'Status de Aprovação',
      'Aprovado por',
      'Responsável',
      'Qtd Fotos',
      'Origem da Imagem',
      'Nome do Local',
      'Rua',
      'Bairro',
      'CEP',
      'Cidade',
      'Estado',
      'Endereço Completo',
      'Latitude',
      'Longitude',
      'Observações',
      'Cancelada',
      'Motivo do Cancelamento',
    ])
  );

  weighings.forEach((w) => {
    lines.push(
      csvRow([
        formatDate(w.weighing_date),
        formatTime(w.weighing_date),
        w.client?.name ?? '',
        w.unit?.name ?? '',
        w.waste_type?.name ?? '',
        Number(w.weight_kg ?? 0).toFixed(2).replace('.', ','),
        w.treatment_type?.name ?? '',
        w.recipient?.name ?? '',
        approvalLabel[w.approval_status] ?? w.approval_status,
        w.approver?.full_name ?? '',
        w.creator?.full_name ?? '',
        w.photos?.length ?? 0,
        w.image_source === 'camera' ? 'Câmera' : w.image_source === 'upload' ? 'Anexo' : '',
        w.location_place_name ?? '',
        w.location_street ?? '',
        w.location_neighborhood ?? '',
        w.location_postal_code ?? '',
        w.location_city ?? '',
        w.location_state ?? '',
        w.location_formatted_address ?? w.manual_location ?? '',
        w.gps_lat ?? '',
        w.gps_lng ?? '',
        w.notes ?? '',
        w.canceled_at ? 'Sim' : 'Não',
        w.cancellation_reason ?? '',
      ])
    );
  });

  // BOM UTF-8 + conteúdo
  const csv = '﻿' + lines.join('\r\n');
  const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const fileUri = `${FileSystem.cacheDirectory}eva-ambiental-relatorio-${dateStr}.csv`;
  await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'CSV Eva Ambiental' });
  }
}
