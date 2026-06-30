/**
 * Serviço de importação de dados via planilha Excel (.xlsx).
 * Admin-only: verificação por `usePermissions` na tela + assertAdmin() em cada execute.
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { supabase } from '@/lib/supabase';
import {
  listClients,
  listUnits,
  listWasteTypes,
  listTreatmentTypes,
  listRecipients,
} from './masters';
import { Client } from '@/types';

dayjs.extend(customParseFormat);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normaliza string para comparação: sem acento, minúscula, sem espaços extras. */
function normalize(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Normaliza documento (CNPJ/CPF): mantém apenas dígitos para comparação. */
function normalizeDoc(d: unknown): string {
  return String(d ?? '').replace(/\D/g, '');
}

/**
 * Interpreta um valor booleano de célula Excel/CSV.
 * Aceita: Sim/Não, S/N, true/false, 1/0, Yes/No (qualquer capitalização).
 * Retorna null se a célula estiver vazia.
 */
function parseBool(s: unknown): boolean | null {
  const v = String(s ?? '').trim().toLowerCase();
  if (!v) return null;
  return v === 'sim' || v === 's' || v === 'true' || v === '1' || v === 'yes';
}

/** Lê um arquivo .xlsx e retorna as linhas como array de strings (sem linhas vazias). */
async function readXlsxRows(uri: string): Promise<string[][]> {
  const XLSX = await import('xlsx');
  const content = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const wb = XLSX.read(content, { type: 'base64' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, {
    header: 1,
    raw: false,
    defval: '',
  });
  return (rows as string[][]).filter((r) => r.some((c) => String(c).trim() !== ''));
}

/**
 * Verifica via banco que o usuário autenticado é admin ativo.
 * Lança erro se não for — impede execução mesmo que a tela seja bypassada.
 */
async function assertAdmin(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sessão expirada. Faça login novamente.');
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, active')
    .eq('id', user.id)
    .single();
  if (!profile || profile.role !== 'admin' || !profile.active) {
    throw new Error('Apenas administradores podem realizar importações.');
  }
}

/** Abre o seletor de arquivo e retorna URI + nome. Retorna null se cancelado. */
export async function pickXlsxFile(): Promise<{ uri: string; name: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset) return null;
  return { uri: asset.uri, name: asset.name ?? 'arquivo.xlsx' };
}

// ─── IMPORTAÇÃO DE PESAGENS ────────────────────────────────────────────────────
// Colunas da planilha: Data | Cliente | Unidade | Destinatário | Tipo de Resíduo
//                      | Tipo de Tratamento | Peso (kg) | Qtd de Pessoas
//                      | Poderia desviar do aterro? | Observações
// Imagens nunca são importadas: pesagens são criadas sem foto para anexo posterior.

export interface WeighingRowParsed {
  date: string;
  clientId: string;
  unitId: string;
  recipientId: string | null;
  recipientIsLandfill: boolean;
  wasteTypeId: string;
  treatmentTypeId: string;
  weight: number;
  peopleCount: number | null;
  couldDivertFromLandfill: boolean | null;
  notes: string | null;
  _wasteTypeName: string;
  _treatmentTypeName: string;
}

export interface WeighingsValidation {
  totalRows: number;
  validRows: WeighingRowParsed[];
  missingClients: string[];
  missingUnits: string[];
  missingRecipients: string[];
  newWasteTypes: string[];
  newTreatmentTypes: string[];
  parseErrors: string[];
  /** true somente quando sem bloqueantes e há ao menos uma linha válida */
  canImport: boolean;
}

/** Analisa planilha de pesagens. Não modifica o banco. */
export async function validateWeighingsFile(uri: string): Promise<WeighingsValidation> {
  const allRows = await readXlsxRows(uri);
  const dataRows = allRows.slice(1); // pula cabeçalho

  const [clients, units, wasteTypes, treatmentTypes, recipients] = await Promise.all([
    listClients(),
    listUnits(),
    listWasteTypes(),
    listTreatmentTypes(),
    listRecipients(),
  ]);

  const missingClientsSet = new Set<string>();
  const missingUnitsSet = new Set<string>();
  const missingRecipientsSet = new Set<string>();
  const newWasteTypesSet = new Set<string>();
  const newTreatmentTypesSet = new Set<string>();
  const parseErrors: string[] = [];
  const validRows: WeighingRowParsed[] = [];

  dataRows.forEach((row, idx) => {
    const lineNum = idx + 2;
    const [
      dateRaw = '',
      clientName = '',
      unitName = '',
      recipientName = '',
      wasteTypeName = '',
      treatmentTypeName = '',
      weightRaw = '',
      peopleCountRaw = '',
      couldDivertRaw = '',
      notesRaw = '',
    ] = row;

    // Ignora linha que tem apenas células vazias
    if (!String(clientName).trim() && !String(unitName).trim()) return;

    // ── Data ──
    const dateStr = String(dateRaw).trim();
    const parsed = dayjs(dateStr, ['DD/MM/YYYY', 'D/M/YYYY', 'YYYY-MM-DD'], true);
    if (!parsed.isValid()) {
      parseErrors.push(`Linha ${lineNum}: data inválida "${dateStr}" — use DD/MM/AAAA.`);
      return;
    }

    // ── Cliente ──
    const clientStr = String(clientName).trim();
    const client = clients.find((c) => normalize(c.name) === normalize(clientStr));
    if (!client) {
      missingClientsSet.add(clientStr);
      return; // bloqueia; não valida restante desta linha
    }

    // ── Unidade ──
    const unitStr = String(unitName).trim();
    const unit = units.find(
      (u) => normalize(u.name) === normalize(unitStr) && u.client_id === client.id,
    );
    if (!unit) {
      missingUnitsSet.add(`${unitStr} (cliente: ${clientStr})`);
      return;
    }

    // ── Destinatário (opcional) ──
    let recipientId: string | null = null;
    let recipientIsLandfill = false;
    const recipientStr = String(recipientName).trim();
    if (recipientStr) {
      const recipient = recipients.find((r) => normalize(r.name) === normalize(recipientStr));
      if (!recipient) {
        missingRecipientsSet.add(recipientStr);
        return;
      }
      recipientId = recipient.id;
      recipientIsLandfill = recipient.is_landfill === true;
    }

    // ── Tipo de Resíduo (auto-cria se ausente) ──
    const wasteStr = String(wasteTypeName).trim();
    if (!wasteStr) {
      parseErrors.push(`Linha ${lineNum}: Tipo de Resíduo não informado.`);
      return;
    }
    const wasteType = wasteTypes.find((w) => normalize(w.name) === normalize(wasteStr));
    if (!wasteType) newWasteTypesSet.add(wasteStr);

    // ── Tipo de Tratamento (auto-cria se ausente) ──
    const treatStr = String(treatmentTypeName).trim();
    if (!treatStr) {
      parseErrors.push(`Linha ${lineNum}: Tipo de Tratamento não informado.`);
      return;
    }
    const treatType = treatmentTypes.find((t) => normalize(t.name) === normalize(treatStr));
    if (!treatType) newTreatmentTypesSet.add(treatStr);

    // ── Peso ──
    const weightStr = String(weightRaw).replace(',', '.').trim();
    const weight = parseFloat(weightStr);
    if (isNaN(weight) || weight <= 0) {
      parseErrors.push(`Linha ${lineNum}: peso inválido "${weightRaw}".`);
      return;
    }

    // ── Qtd de Pessoas (opcional) ──
    const pcStr = String(peopleCountRaw).trim();
    let peopleCount: number | null = null;
    if (pcStr) {
      const pc = parseInt(pcStr, 10);
      if (!isNaN(pc) && pc > 0) peopleCount = pc;
    }

    // ── Poderia desviar do aterro? (apenas quando destinatário for aterro) ──
    const couldDivertParsed = parseBool(couldDivertRaw);
    const couldDivertFromLandfill: boolean | null = recipientIsLandfill ? (couldDivertParsed ?? null) : null;

    validRows.push({
      date: parsed.toISOString(),
      clientId: client.id,
      unitId: unit.id,
      recipientId,
      recipientIsLandfill,
      wasteTypeId: wasteType?.id ?? '',
      treatmentTypeId: treatType?.id ?? '',
      weight,
      peopleCount,
      couldDivertFromLandfill,
      notes: String(notesRaw).trim() || null,
      _wasteTypeName: wasteStr,
      _treatmentTypeName: treatStr,
    });
  });

  const missingClients = [...missingClientsSet];
  const missingUnits = [...missingUnitsSet];
  const missingRecipients = [...missingRecipientsSet];
  const newWasteTypes = [...newWasteTypesSet];
  const newTreatmentTypes = [...newTreatmentTypesSet];

  const canImport =
    missingClients.length === 0 &&
    missingUnits.length === 0 &&
    missingRecipients.length === 0 &&
    validRows.length > 0;

  return {
    totalRows: dataRows.length,
    validRows,
    missingClients,
    missingUnits,
    missingRecipients,
    newWasteTypes,
    newTreatmentTypes,
    parseErrors,
    canImport,
  };
}

/**
 * Executa a importação de pesagens.
 * Verifica se o usuário autenticado é admin antes de qualquer escrita.
 * Auto-cria tipos de resíduo/tratamento ausentes (não bloqueantes).
 * Insere pesagens em lote único: ou tudo ou nada.
 * Pesagens importadas não têm imagem — podem receber foto posteriormente.
 */
export async function executeWeighingsImport(
  validation: WeighingsValidation,
  userId: string,
): Promise<number> {
  await assertAdmin();
  if (!validation.canImport) throw new Error('Importação bloqueada: cadastros faltando.');

  const [wasteTypes, treatmentTypes] = await Promise.all([listWasteTypes(), listTreatmentTypes()]);

  const wasteMap = new Map(wasteTypes.map((w) => [normalize(w.name), w.id]));
  const treatMap = new Map(treatmentTypes.map((t) => [normalize(t.name), t.id]));

  // Auto-cria tipos de resíduo faltantes
  for (const name of validation.newWasteTypes) {
    if (!wasteMap.has(normalize(name))) {
      const { data, error } = await supabase
        .from('waste_types')
        .insert({ name, active: true })
        .select('id')
        .single();
      if (error) throw error;
      wasteMap.set(normalize(name), data.id);
    }
  }

  // Auto-cria tipos de tratamento faltantes (não conta como desvio por padrão)
  for (const name of validation.newTreatmentTypes) {
    if (!treatMap.has(normalize(name))) {
      const { data, error } = await supabase
        .from('treatment_types')
        .insert({ name, counts_as_diversion: false, active: true })
        .select('id')
        .single();
      if (error) throw error;
      treatMap.set(normalize(name), data.id);
    }
  }

  // Monta lote de inserções (pesagens sem imagem)
  const inserts = validation.validRows.map((row) => ({
    client_id: row.clientId,
    unit_id: row.unitId,
    waste_type_id: row.wasteTypeId || wasteMap.get(normalize(row._wasteTypeName)) || '',
    treatment_type_id: row.treatmentTypeId || treatMap.get(normalize(row._treatmentTypeName)) || '',
    recipient_id: row.recipientId,
    weighing_date: row.date,
    weight_kg: row.weight,
    people_count: row.peopleCount,
    could_divert_from_landfill: row.couldDivertFromLandfill,
    notes: row.notes,
    created_by: userId,
    approval_status: 'pending',
    status: 'completed',
    // image_source, gps_lat, gps_lng: null — foto é anexada manualmente depois
  }));

  // Inserção atômica: ou todas ou nenhuma (PostgreSQL INSERT em lote é transacional)
  const { error } = await supabase.from('weighings').insert(inserts);
  if (error) throw error;

  await supabase.from('audit_logs').insert({
    user_id: userId,
    action: 'import_weighings',
    entity: 'weighings',
    new_data: { count: inserts.length, source: 'xlsx' },
  });

  return inserts.length;
}

// ─── IMPORTAÇÃO DE CLIENTES + UNIDADES ────────────────────────────────────────
// Colunas: Cliente | CNPJ/CPF | Unidade/Localidade | Rua/Logradouro | Bairro | Cidade | Estado | CEP
// Duplicidade: verificada por CNPJ/CPF (prioritário) OU nome normalizado.

export interface ClientsParseResult {
  groups: Array<{
    clientName: string;
    document: string | null;
    units: Array<{
      name: string;
      street: string | null;
      neighborhood: string | null;
      city: string | null;
      state: string | null;
      postal_code: string | null;
    }>;
    isNew: boolean;
  }>;
  preview: {
    totalRows: number;
    newClients: string[];
    existingClients: string[];
    newUnits: number;
    existingUnits: number;
  };
}

/** Analisa planilha de clientes e retorna preview sem inserir nada. */
export async function validateClientsFile(uri: string): Promise<ClientsParseResult> {
  const allRows = await readXlsxRows(uri);
  const dataRows = allRows.slice(1);

  const [allClients, allUnits] = await Promise.all([listClients(), listUnits()]);

  // Mapa por nome normalizado
  const clientByName = new Map(allClients.map((c) => [normalize(c.name), c]));
  // Mapa por documento normalizado (apenas dígitos)
  const clientByDoc = new Map<string, Client>();
  allClients.forEach((c) => {
    const nd = normalizeDoc(c.document);
    if (nd) clientByDoc.set(nd, c);
  });

  const unitKey = (cId: string, uName: string) => `${cId}::${normalize(uName)}`;
  const unitSet = new Set(allUnits.map((u) => unitKey(u.client_id, u.name)));

  const groupMap = new Map<
    string,
    {
      clientName: string;
      document: string | null;
      units: Array<{ name: string; street: string | null; neighborhood: string | null; city: string | null; state: string | null; postal_code: string | null }>;
      isNew: boolean;
    }
  >();

  for (const row of dataRows) {
    const [
      clientName = '',
      document = '',
      unitName = '',
      street = '',
      neighborhood = '',
      city = '',
      state = '',
      postal_code = '',
    ] = row;
    const cName = String(clientName).trim();
    if (!cName) continue;

    const normName = normalize(cName);
    const normDoc = normalizeDoc(document);
    const existingClient = (normDoc ? clientByDoc.get(normDoc) : undefined) ?? clientByName.get(normName);

    if (!groupMap.has(normName)) {
      groupMap.set(normName, {
        clientName: cName,
        document: String(document).trim() || null,
        units: [],
        isNew: !existingClient,
      });
    }

    const uName = String(unitName).trim();
    if (uName) {
      groupMap.get(normName)!.units.push({
        name: uName,
        street: String(street).trim() || null,
        neighborhood: String(neighborhood).trim() || null,
        city: String(city).trim() || null,
        state: String(state).trim() || null,
        postal_code: String(postal_code).trim() || null,
      });
    }
  }

  const newClients: string[] = [];
  const existingClients: string[] = [];
  let newUnits = 0;
  let existingUnits = 0;

  for (const [normName, group] of groupMap) {
    if (group.isNew) {
      newClients.push(group.clientName);
    } else {
      existingClients.push(group.clientName);
    }
    const normDoc = normalizeDoc(group.document);
    const existingClient =
      (normDoc ? clientByDoc.get(normDoc) : undefined) ?? clientByName.get(normName);
    const cId = existingClient?.id ?? '__NEW__';
    for (const u of group.units) {
      if (unitSet.has(unitKey(cId, u.name))) existingUnits++;
      else newUnits++;
    }
  }

  return {
    groups: [...groupMap.values()],
    preview: { totalRows: dataRows.length, newClients, existingClients, newUnits, existingUnits },
  };
}

/** Executa importação de clientes e unidades. Verifica admin. */
export async function executeClientsImport(
  result: ClientsParseResult,
): Promise<{ clients: number; units: number }> {
  await assertAdmin();

  const [allClients, allUnits] = await Promise.all([listClients(), listUnits()]);

  const clientByName = new Map(allClients.map((c) => [normalize(c.name), c]));
  const clientByDoc = new Map<string, Client>();
  allClients.forEach((c) => {
    const nd = normalizeDoc(c.document);
    if (nd) clientByDoc.set(nd, c);
  });

  const unitKey = (cId: string, uName: string) => `${cId}::${normalize(uName)}`;
  const unitSet = new Set(allUnits.map((u) => unitKey(u.client_id, u.name)));

  let clientsInserted = 0;
  let unitsInserted = 0;

  for (const group of result.groups) {
    const normName = normalize(group.clientName);
    const normDoc = normalizeDoc(group.document);
    let client =
      (normDoc ? clientByDoc.get(normDoc) : undefined) ?? clientByName.get(normName);

    if (!client) {
      const { data, error } = await supabase
        .from('clients')
        .insert({ name: group.clientName, document: group.document, active: true })
        .select()
        .single();
      if (error) throw error;
      client = data as Client;
      clientByName.set(normName, client);
      if (normDoc) clientByDoc.set(normDoc, client);
      clientsInserted++;
    }

    for (const unit of group.units) {
      const key = unitKey(client.id, unit.name);
      if (!unitSet.has(key)) {
        const { error } = await supabase.from('units').insert({
          client_id: client.id,
          name: unit.name,
          street: unit.street,
          neighborhood: unit.neighborhood,
          city: unit.city,
          state: unit.state,
          postal_code: unit.postal_code,
          active: true,
        });
        if (error) throw error;
        unitSet.add(key);
        unitsInserted++;
      }
    }
  }

  return { clients: clientsInserted, units: unitsInserted };
}

// ─── IMPORTAÇÃO DE DESTINATÁRIOS ───────────────────────────────────────────────
// Colunas: Nome/Razão Social | CNPJ/CPF | É aterro?
// Duplicidade: verificada por CNPJ/CPF (prioritário) OU nome normalizado.

export interface RecipientsParseResult {
  rows: Array<{ name: string; document: string | null; is_landfill: boolean; isNew: boolean }>;
  preview: { totalRows: number; newRecipients: string[]; existingRecipients: string[] };
}

/** Analisa planilha de destinatários e retorna preview sem inserir nada. */
export async function validateRecipientsFile(uri: string): Promise<RecipientsParseResult> {
  const allRows = await readXlsxRows(uri);
  const dataRows = allRows.slice(1);

  const allRecipients = await listRecipients();
  const byName = new Map(allRecipients.map((r) => [normalize(r.name), r]));
  const byDoc = new Map<string, (typeof allRecipients)[number]>();
  allRecipients.forEach((r) => {
    const nd = normalizeDoc(r.document);
    if (nd) byDoc.set(nd, r);
  });

  const rows: RecipientsParseResult['rows'] = [];
  const newRecipients: string[] = [];
  const existingRecipients: string[] = [];
  const seen = new Set<string>();

  for (const row of dataRows) {
    const [name = '', document = '', isLandfillRaw = ''] = row;
    const nameStr = String(name).trim();
    if (!nameStr) continue;

    const normName = normalize(nameStr);
    const normDoc = normalizeDoc(document);

    // Deduplicação dentro da própria planilha (por nome ou documento)
    const dedupKey = normDoc || normName;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    const existing = (normDoc ? byDoc.get(normDoc) : undefined) ?? byName.get(normName);
    const isNew = !existing;
    const is_landfill = parseBool(isLandfillRaw) ?? false;
    rows.push({ name: nameStr, document: String(document).trim() || null, is_landfill, isNew });
    if (isNew) newRecipients.push(nameStr);
    else existingRecipients.push(nameStr);
  }

  return { rows, preview: { totalRows: dataRows.length, newRecipients, existingRecipients } };
}

/** Executa importação de destinatários. Verifica admin. */
export async function executeRecipientsImport(result: RecipientsParseResult): Promise<number> {
  await assertAdmin();
  let inserted = 0;
  for (const row of result.rows) {
    if (!row.isNew) continue;
    const { error } = await supabase
      .from('recipients')
      .insert({ name: row.name, document: row.document, is_landfill: row.is_landfill, active: true });
    if (error) throw error;
    inserted++;
  }
  return inserted;
}
