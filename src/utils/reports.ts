import type * as XLSX from 'xlsx';
import { Weighing } from '@/types';
import {
  approvalLabel,
  classifyDiversion,
  DiversionClass,
  formatDate,
  formatDateTime,
  formatPercent,
  formatTime,
  formatWeight,
} from './format';

export interface ReportContext {
  periodLabel: string;
  stats: {
    totalWeighings: number;
    totalWeight: number;
    activeClients: number;
    activeUnits: number;
    diversionRate: number;
    byWasteType: { name: string; color: string; weight: number }[];
    byTreatment: { name: string; weight: number }[];
  };
  weighings: Weighing[];
}

const SYSTEM = 'Eva Ambiental';
const TITLE = 'Relatório de Controle e Monitoramento';

// ─── PDF ──────────────────────────────────────────────────────────────────────

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

  const wasteRows = stats.byWasteType
    .map((w) => `<tr><td>${escapeHtml(w.name)}</td><td class="right">${formatWeight(w.weight)}</td></tr>`)
    .join('');
  const treatRows = stats.byTreatment
    .map((t) => `<tr><td>${escapeHtml(t.name)}</td><td class="right">${formatWeight(t.weight)}</td></tr>`)
    .join('');

  const weighingCards = weighings
    .map((w, i) => {
      const isCanceled = !!w.canceled_at; // nunca true quando ctx.weighings exclui canceladas
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
  const [Print, Sharing] = await Promise.all([
    import('expo-print'),
    import('expo-sharing'),
  ]);
  const html = buildHtml(ctx);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Relatório Eva Ambiental' });
  }
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

function csvCell(v: unknown): string {
  const s = String(v ?? '').replace(/"/g, '""');
  return `"${s}"`;
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(';');
}

/** Gera CSV estruturado (separador ; — compatível com Excel pt-BR) e compartilha. */
export async function generateCsvReport(ctx: ReportContext): Promise<void> {
  const [FileSystem, Sharing] = await Promise.all([
    import('expo-file-system/legacy'),
    import('expo-sharing'),
  ]);
  const { stats, weighings, periodLabel } = ctx;
  const cls = classifyDiversion(stats.diversionRate);
  const today = formatDate(new Date().toISOString());
  const lines: string[] = [];

  lines.push(csvRow([SYSTEM]));
  lines.push(csvRow([TITLE]));
  lines.push(csvRow(['Período', periodLabel]));
  lines.push(csvRow(['Data de geração', today]));
  lines.push(csvRow(['Total de pesagens', stats.totalWeighings]));
  lines.push(csvRow(['Peso total (kg)', Number(stats.totalWeight).toFixed(2).replace('.', ',')]));
  lines.push(csvRow(['Taxa de desvio de aterro', `${Number(stats.diversionRate).toFixed(1).replace('.', ',')}%`]));
  lines.push(csvRow(['Desempenho', cls.label]));
  lines.push('');
  lines.push(csvRow(['DISTRIBUIÇÃO POR TIPO DE RESÍDUO']));
  lines.push(csvRow(['Resíduo', 'Peso (kg)']));
  stats.byWasteType.forEach((w) => lines.push(csvRow([w.name, Number(w.weight).toFixed(2).replace('.', ',')])));
  lines.push('');
  lines.push(csvRow(['DISTRIBUIÇÃO POR TIPO DE TRATAMENTO']));
  lines.push(csvRow(['Tratamento', 'Peso (kg)']));
  stats.byTreatment.forEach((t) => lines.push(csvRow([t.name, Number(t.weight).toFixed(2).replace('.', ',')])));
  lines.push('');
  lines.push(csvRow(['DETALHAMENTO DAS PESAGENS']));
  lines.push(csvRow(['Data','Hora','Cliente','Unidade','Resíduo','Peso (kg)','Qtd de Pessoas','Tratamento','Destinatário','Destinatário é Aterro','Poderia Desviar do Aterro','Status de Aprovação','Aprovado por','Responsável','Qtd Fotos','Origem da Imagem','Nome do Local','Rua','Bairro','CEP','Cidade','Estado','Endereço Completo','Latitude','Longitude','Observações','Cancelada','Motivo do Cancelamento']));
  weighings.forEach((w) => {
    const isLandfill = w.recipient?.is_landfill ?? false;
    const couldDivert = w.could_divert_from_landfill;
    lines.push(csvRow([
      formatDate(w.weighing_date), formatTime(w.weighing_date),
      w.client?.name ?? '', w.unit?.name ?? '', w.waste_type?.name ?? '',
      Number(w.weight_kg ?? 0).toFixed(2).replace('.', ','),
      w.people_count != null ? w.people_count : '',
      w.treatment_type?.name ?? '', w.recipient?.name ?? '',
      isLandfill ? 'Sim' : 'Não',
      isLandfill ? (couldDivert === true ? 'Sim' : couldDivert === false ? 'Não' : 'Não informado') : 'Não se aplica',
      approvalLabel[w.approval_status] ?? w.approval_status,
      w.approver?.full_name ?? '', w.creator?.full_name ?? '',
      w.photos?.length ?? 0,
      w.image_source === 'camera' ? 'Câmera' : w.image_source === 'upload' ? 'Anexo' : '',
      w.location_place_name ?? '', w.location_street ?? '', w.location_neighborhood ?? '',
      w.location_postal_code ?? '', w.location_city ?? '', w.location_state ?? '',
      w.location_formatted_address ?? w.manual_location ?? '',
      w.gps_lat ?? '', w.gps_lng ?? '', w.notes ?? '',
      w.canceled_at ? 'Sim' : 'Não', w.cancellation_reason ?? '',
    ]));
  });

  const csv = '﻿' + lines.join('\r\n');
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileUri = `${FileSystem.cacheDirectory}eva-ambiental-relatorio-${dateStr}.csv`;
  await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'CSV Eva Ambiental' });
  }
}

// ─── EXCEL (.xlsx) ────────────────────────────────────────────────────────────
// SheetJS Community Edition (npm: xlsx) suporta: múltiplas abas, largura de colunas,
// AutoFilter, linhas congeladas, formatação numérica e mesclagem de células.
// Cores de células e negrito requerem a edição Pro; a estrutura e os formatos numéricos
// já produzem um arquivo profissional compatível com Excel, Sheets e LibreOffice.

type XCell = XLSX.CellObject | string | number | null | undefined;
// XLSXLib: tipo do módulo xlsx carregado dinamicamente — não importado em runtime.
type XLSXLib = typeof XLSX;

/** Célula numérica com código de formato de número Excel. */
function nc(v: number | null | undefined, z = '#,##0.00'): XCell {
  if (v == null) return null;
  return { v, t: 'n', z } as XLSX.CellObject;
}

/**
 * Célula de data/hora como string formatada.
 * Usar string garante exibição correta em qualquer versão do Excel / LibreOffice,
 * evitando o problema de datas exibidas como números seriais.
 */
function dc(iso: string | null | undefined, type: 'date' | 'time' = 'date'): string | null {
  if (!iso) return null;
  return type === 'date' ? formatDate(iso) : formatTime(iso);
}

/** Merge helper: referência 0-indexed de célula inicial até célula final na mesma linha. */
function mr(row: number, c1: number, c2: number): XLSX.Range {
  return { s: { r: row, c: c1 }, e: { r: row, c: c2 } };
}

// ── Aba 1: Resumo ──────────────────────────────────────────────────────────────

function buildResumoSheet(ctx: ReportContext, cls: DiversionClass, xl: XLSXLib): XLSX.WorkSheet {
  const { stats, periodLabel } = ctx;
  const generatedAt = formatDateTime(new Date().toISOString());
  const totalWaste = stats.byWasteType.reduce((s, w) => s + w.weight, 0);
  const totalTreat = stats.byTreatment.reduce((s, t) => s + t.weight, 0);

  const rows: XCell[][] = [
    // 0 — Título (mesclado A1:D1)
    [SYSTEM, null, null, null],
    // 1 — Subtítulo (mesclado A2:D2)
    [TITLE, null, null, null],
    // 2 — Linha em branco
    [null],
    // 3 — Período
    ['Período', periodLabel, null, null],
    // 4 — Data de geração
    ['Gerado em', generatedAt, null, null],
    // 5 — Espaço
    [null],
    // 6 — Seção indicadores (mesclado)
    ['INDICADORES DO PERÍODO', null, null, null],
    // 7-10 — KPIs
    ['Total de Pesagens', nc(stats.totalWeighings, '#,##0'), null, null],
    ['Peso Total (kg)', nc(stats.totalWeight, '#,##0.00'), null, null],
    ['Taxa de Desvio de Aterro', nc(stats.diversionRate / 100, '0.0%'), null, null],
    ['Desempenho', cls.label, null, null],
    // 11 — Espaço
    [null],
    // 12 — Seção clientes/unidades (mesclado)
    ['CLIENTES E UNIDADES', null, null, null],
    // 13-14
    ['Clientes Ativos', nc(stats.activeClients, '#,##0'), null, null],
    ['Unidades Ativas', nc(stats.activeUnits, '#,##0'), null, null],
    // 15 — Espaço
    [null],
    // 16 — Seção totais de distribuição (mesclado)
    ['RESUMO DE DISTRIBUIÇÃO', null, null, null],
    // 17-18
    ['Total por Resíduos (kg)', nc(totalWaste, '#,##0.00'), null, null],
    ['Total por Tratamentos (kg)', nc(totalTreat, '#,##0.00'), null, null],
  ];

  const ws = xl.utils.aoa_to_sheet(rows as any[][]);
  ws['!merges'] = [
    mr(0, 0, 3),   // A1:D1
    mr(1, 0, 3),   // A2:D2
    mr(6, 0, 3),   // A7:D7 — INDICADORES
    mr(12, 0, 3),  // A13:D13 — CLIENTES E UNIDADES
    mr(16, 0, 3),  // A17:D17 — RESUMO DE DISTRIBUIÇÃO
  ];
  ws['!cols'] = [{ wch: 30 }, { wch: 24 }, { wch: 14 }, { wch: 14 }];
  return ws;
}

// ── Aba 2: Distribuição ────────────────────────────────────────────────────────

function buildDistSheet(ctx: ReportContext, xl: XLSXLib): XLSX.WorkSheet {
  const { stats, periodLabel } = ctx;
  const totalWaste = stats.byWasteType.reduce((s, w) => s + w.weight, 0);
  const totalTreat = stats.byTreatment.reduce((s, t) => s + t.weight, 0);

  const rows: XCell[][] = [];
  const merges: XLSX.Range[] = [];

  // Usa rows.length - 1 sempre após o push da linha a mesclar
  const push = (...row: XCell[]) => { rows.push(row); };
  const addMerge = (c1: number, c2: number) => merges.push(mr(rows.length - 1, c1, c2));

  // Cabeçalho
  push(`${SYSTEM} — Distribuição`, null, null); addMerge(0, 2);
  push('Período', periodLabel, null);
  push(null);

  // ─ Por Resíduo
  push('DISTRIBUIÇÃO POR TIPO DE RESÍDUO', null, null); addMerge(0, 2);
  push('Resíduo', 'Peso (kg)', '% do Total');
  if (stats.byWasteType.length === 0) {
    push('Nenhuma pesagem no período.', null, null); addMerge(0, 2);
  } else {
    stats.byWasteType.forEach((w) =>
      push(w.name, nc(w.weight), nc(totalWaste > 0 ? w.weight / totalWaste : 0, '0.0%'))
    );
    push('TOTAL', nc(totalWaste), nc(totalWaste > 0 ? 1 : 0, '0.0%'));
  }
  push(null);

  // ─ Por Tratamento
  push('DISTRIBUIÇÃO POR TIPO DE TRATAMENTO', null, null); addMerge(0, 2);
  push('Tratamento', 'Peso (kg)', '% do Total');
  if (stats.byTreatment.length === 0) {
    push('Nenhuma pesagem no período.', null, null); addMerge(0, 2);
  } else {
    stats.byTreatment.forEach((t) =>
      push(t.name, nc(t.weight), nc(totalTreat > 0 ? t.weight / totalTreat : 0, '0.0%'))
    );
    push('TOTAL', nc(totalTreat), nc(totalTreat > 0 ? 1 : 0, '0.0%'));
  }

  const ws = xl.utils.aoa_to_sheet(rows as any[][]);
  ws['!merges'] = merges;
  ws['!cols'] = [{ wch: 34 }, { wch: 14 }, { wch: 12 }];
  return ws;
}

// ── Aba 3: Detalhamento ────────────────────────────────────────────────────────

const DET_HEADERS: string[] = [
  'Data', 'Hora', 'Cliente', 'Unidade', 'Resíduo', 'Peso (kg)', 'Qtd de Pessoas',
  'Tratamento', 'Destinatário', 'Destinatário é Aterro', 'Poderia Desviar do Aterro',
  'Status de Aprovação', 'Aprovado por',
  'Responsável', 'Qtd Fotos', 'Origem da Imagem', 'Nome do Local',
  'Rua', 'Bairro', 'CEP', 'Cidade', 'Estado', 'Endereço Completo',
  'Latitude', 'Longitude', 'Observações', 'Cancelada', 'Motivo do Cancelamento',
];

const DET_COLS: XLSX.ColInfo[] = [
  { wch: 12 }, { wch: 8 },  { wch: 24 }, { wch: 24 }, { wch: 24 },
  { wch: 13 }, { wch: 14 }, { wch: 22 }, { wch: 24 }, { wch: 16 },
  { wch: 20 }, { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 10 },
  { wch: 16 }, { wch: 22 }, { wch: 26 }, { wch: 18 }, { wch: 10 },
  { wch: 16 }, { wch: 8 },  { wch: 36 }, { wch: 14 }, { wch: 14 },
  { wch: 30 }, { wch: 10 }, { wch: 30 },
];

function buildDetSheet(ctx: ReportContext, xl: XLSXLib): XLSX.WorkSheet {
  const { weighings, periodLabel } = ctx;
  const N = DET_HEADERS.length;
  const lastCol = xl.utils.encode_col(N - 1);
  const empty = Array<null>(N - 1).fill(null);

  const rows: XCell[][] = [];
  const merges: XLSX.Range[] = [];

  // Linha 0: Título (A1:Y1)
  rows.push(['Detalhamento das Pesagens — Eva Ambiental', ...empty]);
  merges.push(mr(0, 0, N - 1));

  // Linha 1: Info do período + totais
  rows.push(['Período', periodLabel, null, 'Total de pesagens', nc(weighings.length, '#,##0'), ...Array<null>(N - 5).fill(null)]);

  // Linha 2: Espaço
  rows.push([...Array<null>(N).fill(null)]);

  // Linha 3: Cabeçalhos (row 4 no Excel — AutoFilter aqui)
  rows.push(DET_HEADERS as XCell[]);
  const headerRowXlsx = rows.length; // 4 (1-indexed para Excel)

  // Linhas de dados
  if (weighings.length === 0) {
    rows.push(['Nenhuma pesagem encontrada para o período selecionado.', ...empty]);
    merges.push(mr(rows.length - 1, 0, N - 1));
  } else {
    weighings.forEach((w) => {
      const isLandfill = w.recipient?.is_landfill ?? false;
      const couldDivert = w.could_divert_from_landfill;
      const couldDivertLabel = isLandfill
        ? (couldDivert === true ? 'Sim' : couldDivert === false ? 'Não' : 'Não informado')
        : 'Não se aplica';
      rows.push([
        dc(w.weighing_date, 'date'),                 // Data
        dc(w.weighing_date, 'time'),                 // Hora
        w.client?.name ?? '',                        // Cliente
        w.unit?.name ?? '',                          // Unidade
        w.waste_type?.name ?? '',                    // Resíduo
        nc(w.weight_kg, '#,##0.00'),                 // Peso (kg)
        w.people_count != null ? nc(w.people_count, '#,##0') : null, // Qtd de Pessoas
        w.treatment_type?.name ?? '',                // Tratamento
        w.recipient?.name ?? '',                     // Destinatário
        isLandfill ? 'Sim' : 'Não',                 // Destinatário é Aterro
        couldDivertLabel,                            // Poderia Desviar do Aterro
        approvalLabel[w.approval_status] ?? w.approval_status, // Status
        w.approver?.full_name ?? '',                 // Aprovado por
        w.creator?.full_name ?? '',                  // Responsável
        nc(w.photos?.length ?? 0, '#,##0'),          // Qtd Fotos
        w.image_source === 'camera' ? 'Câmera'       // Origem
          : w.image_source === 'upload' ? 'Anexo' : '',
        w.location_place_name ?? '',                 // Nome do Local
        w.location_street ?? '',                     // Rua
        w.location_neighborhood ?? '',               // Bairro
        w.location_postal_code ?? '',                // CEP
        w.location_city ?? '',                       // Cidade
        w.location_state ?? '',                      // Estado
        w.location_formatted_address ?? w.manual_location ?? '', // Endereço Completo
        w.gps_lat != null ? nc(w.gps_lat, '0.000000') : null,   // Latitude
        w.gps_lng != null ? nc(w.gps_lng, '0.000000') : null,   // Longitude
        w.notes ?? '',                               // Observações
        w.canceled_at ? 'Sim' : 'Não',              // Cancelada
        w.cancellation_reason ?? '',                 // Motivo do Cancelamento
      ]);
    });
  }

  const ws = xl.utils.aoa_to_sheet(rows as any[][]);
  ws['!merges'] = merges;
  ws['!cols'] = DET_COLS;

  // AutoFilter na linha de cabeçalho (linha 4 do Excel = índice 3 base-0)
  ws['!autofilter'] = { ref: `A${headerRowXlsx}:${lastCol}${headerRowXlsx}` };

  // Congelar as 4 primeiras linhas (título, info, espaço, cabeçalho)
  // para que o cabeçalho fique fixo ao rolar
  ws['!freeze'] = { xSplit: 0, ySplit: headerRowXlsx } as any;

  return ws;
}

// ── Entry point ────────────────────────────────────────────────────────────────

/**
 * Gera relatório Excel (.xlsx) formatado em 3 abas e compartilha.
 * Compatível com Microsoft Excel, Google Sheets e LibreOffice.
 *
 * Estrutura:
 *  • Resumo       — KPIs do período com indicador de desempenho
 *  • Distribuição — tabelas de peso por resíduo e por tratamento com percentuais
 *  • Detalhamento — listagem completa com 25 colunas, AutoFilter e cabeçalho fixo
 */
export async function generateXlsxReport(ctx: ReportContext): Promise<void> {
  const [xl, FileSystem, Sharing] = await Promise.all([
    import('xlsx'),
    import('expo-file-system/legacy'),
    import('expo-sharing'),
  ]);
  const cls = classifyDiversion(ctx.stats.diversionRate);
  const dateStr = new Date().toISOString().slice(0, 10);

  const wb = xl.utils.book_new();
  xl.utils.book_append_sheet(wb, buildResumoSheet(ctx, cls, xl), 'Resumo');
  xl.utils.book_append_sheet(wb, buildDistSheet(ctx, xl), 'Distribuição');
  xl.utils.book_append_sheet(wb, buildDetSheet(ctx, xl), 'Detalhamento');

  const b64 = xl.write(wb, { type: 'base64', bookType: 'xlsx' });
  const fileUri = `${FileSystem.cacheDirectory}relatorio-controle-monitoramento-${dateStr}.xlsx`;
  await FileSystem.writeAsStringAsync(fileUri, b64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Relatório Excel — Eva Ambiental',
    });
  }
}
