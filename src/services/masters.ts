import { supabase } from '@/lib/supabase';
import { columnsOf } from '@/utils/columns';
import { Client, Recipient, TreatmentType, Unit, WasteType } from '@/types';

// =================== CLIENTS ===================
export async function listClients(onlyActive = false) {
  let q = supabase.from('clients').select('*').order('name');
  if (onlyActive) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Client[];
}

export async function upsertClient(client: Partial<Client>) {
  const { data, error } = await supabase.from('clients').upsert(client).select().single();
  if (error) throw error;
  return data as Client;
}

/**
 * Clientes com as unidades de cada um.
 *
 * A lista mostra quantas unidades o cliente tem e o painel lista quais são;
 * os dois vêm da mesma leitura. As unidades chegam numa consulta separada em
 * vez de um `units(count)` agregado porque a tela precisa dos nomes, não só
 * do número — e porque uma contagem agregada exigiria outra ida ao banco para
 * obtê-los.
 *
 * `columns` são as colunas que a tabela tem de fato, lidas da resposta: é com
 * elas que a tela decide, campo por campo, o que dá para editar e o que
 * ainda espera migração.
 */
export async function listClientsWithUnits(): Promise<{
  clients: Client[];
  unitsByClient: Record<string, Unit[]>;
  columns: string[];
}> {
  const [clients, units] = await Promise.all([
    supabase.from('clients').select('*').order('name'),
    supabase.from('units').select('*').order('name'),
  ]);
  if (clients.error) throw clients.error;
  if (units.error) throw units.error;

  const rows = (clients.data ?? []) as Client[];
  const unitsByClient: Record<string, Unit[]> = {};
  for (const unit of (units.data ?? []) as Unit[]) {
    if (!unit.client_id) continue;
    (unitsByClient[unit.client_id] ??= []).push(unit);
  }
  return { clients: rows, unitsByClient, columns: columnsOf(rows) };
}

export async function setClientActive(id: string, active: boolean) {
  const { error } = await supabase.from('clients').update({ active }).eq('id', id);
  if (error) throw error;
}

/**
 * Salva o cliente e registra a alteração no histórico.
 *
 * O `audit_logs` é o único lugar em que a aba Histórico do painel pode ler o
 * que mudou e quem mudou — `updated_at` diz apenas quando. A gravação do log
 * não pode derrubar o salvamento: se ela falhar, o cliente já está salvo e a
 * tela não tem por que acusar erro, então o log falha em silêncio (como no
 * cancelamento de pesagem).
 */
export async function saveClient(
  patch: Partial<Client>,
  actor?: { id?: string | null; previous?: Client | null }
): Promise<Client> {
  const saved = await upsertClient(patch);
  await logChange('clients', saved.id, patch, actor);
  return saved;
}

/**
 * Registra a alteração no histórico.
 *
 * Guarda só os campos enviados: um log com o registro inteiro a cada gravação
 * não diz o que foi alterado. A gravação do log não pode derrubar o
 * salvamento, então falha em silêncio.
 */
/** Nome no singular de cada tabela, usado na ação registrada. */
const ENTITY_SINGULAR: Record<string, string> = {
  clients: 'client',
  units: 'unit',
  treatment_types: 'treatment',
  waste_types: 'waste',
  recipients: 'recipient',
};

async function logChange(
  entity: string,
  id: string,
  patch: Record<string, unknown>,
  actor?: { id?: string | null; previous?: Record<string, any> | null }
) {
  if (!actor?.id) return;
  const previous = actor.previous;
  await supabase.from('audit_logs').insert({
    user_id: actor.id,
    action: `${previous ? 'update' : 'create'}_${ENTITY_SINGULAR[entity] ?? entity}`,
    entity,
    entity_id: id,
    old_data: previous
      ? Object.fromEntries(Object.keys(patch).filter((k) => k !== 'id').map((k) => [k, previous[k] ?? null]))
      : null,
    new_data: Object.fromEntries(Object.entries(patch).filter(([k]) => k !== 'id')),
  });
}

/** Alterações registradas para um registro, da mais recente para a mais antiga. */
export async function listHistory(entity: string, id: string): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, action, user_id, old_data, new_data, created_at')
    .eq('entity', entity)
    .eq('entity_id', id)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as AuditEntry[];
}

export const listClientHistory = (clientId: string) => listHistory('clients', clientId);
export const listUnitHistory = (unitId: string) => listHistory('units', unitId);

export interface AuditEntry {
  id: string;
  action: string;
  user_id?: string | null;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  created_at: string;
}

// =================== UNITS ===================
export async function listUnits(onlyActive = false, clientId?: string) {
  let q = supabase.from('units').select('*, client:clients(*)').order('name');
  if (onlyActive) q = q.eq('active', true);
  if (clientId) q = q.eq('client_id', clientId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Unit[];
}

export async function upsertUnit(unit: Partial<Unit>) {
  const payload = { ...unit };
  delete (payload as any).client;
  const { data, error } = await supabase.from('units').upsert(payload).select().single();
  if (error) throw error;
  return data as Unit;
}

export async function setUnitActive(id: string, active: boolean) {
  const { error } = await supabase.from('units').update({ active }).eq('id', id);
  if (error) throw error;
}

export async function saveUnit(
  patch: Partial<Unit>,
  actor?: { id?: string | null; previous?: Unit | null }
): Promise<Unit> {
  const saved = await upsertUnit(patch);
  await logChange('units', saved.id, patch, actor);
  return saved;
}

/** Atividade de pesagem de uma unidade. */
export interface UnitStats {
  /** Data da pesagem mais recente; `null` quando a unidade nunca recebeu uma. */
  last: string | null;
  /** Pesagens no mês corrente. */
  month: number;
}

/**
 * Unidades, com os clientes e a atividade de pesagem de cada uma.
 *
 * A lista mostra a data da última pesagem e um indicador conta quantas
 * unidades receberam pesagem no mês; as duas coisas saem da função
 * `unit_weighing_stats` (migração 0010), que agrega no banco. Sem ela a conta
 * é feita aqui, baixando data e unidade de cada pesagem — funciona, mas cresce
 * com o histórico, e por isso é o caminho de reserva e não o principal.
 *
 * `columns` são as colunas que a tabela tem de fato, lidas da resposta: é com
 * elas que a tela decide, campo por campo, o que dá para editar.
 */
export async function listUnitsWithStats(): Promise<{
  units: Unit[];
  clients: Client[];
  stats: Record<string, UnitStats>;
  columns: string[];
}> {
  const [units, clients] = await Promise.all([
    supabase.from('units').select('*').order('name'),
    supabase.from('clients').select('*').order('name'),
  ]);
  if (units.error) throw units.error;
  if (clients.error) throw clients.error;

  const rows = (units.data ?? []) as Unit[];
  return {
    units: rows,
    clients: (clients.data ?? []) as Client[],
    stats: await unitStats(),
    columns: columnsOf(rows),
  };
}

/**
 * A função agregadora existe? `null` enquanto não se sabe.
 *
 * Sem esta lembrança, cada abertura da tela tentaria a função e deixaria um
 * 404 no console enquanto a migração 0010 não for aplicada.
 */
let hasUnitStatsRpc: boolean | null = null;

async function unitStats(): Promise<Record<string, UnitStats>> {
  const stats: Record<string, UnitStats> = {};
  const rpc = hasUnitStatsRpc === false
    ? { error: true as any, data: null }
    : await supabase.rpc('unit_weighing_stats');
  if (!rpc.error && Array.isArray(rpc.data)) {
    hasUnitStatsRpc = true;
    for (const row of rpc.data as { unit_id: string; last_weighing: string | null; weighings_this_month: number }[]) {
      stats[row.unit_id] = { last: row.last_weighing, month: Number(row.weighings_this_month) || 0 };
    }
    return stats;
  }

  // Reserva: sem a função agregadora, soma-se aqui.
  hasUnitStatsRpc = false;
  const { data } = await supabase
    .from('weighings')
    .select('unit_id, weighing_date, canceled_at')
    .is('canceled_at', null);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  for (const row of (data ?? []) as { unit_id: string | null; weighing_date: string }[]) {
    if (!row.unit_id) continue;
    const entry = (stats[row.unit_id] ??= { last: null, month: 0 });
    if (!entry.last || row.weighing_date > entry.last) entry.last = row.weighing_date;
    if (new Date(row.weighing_date) >= monthStart) entry.month += 1;
  }
  return stats;
}

// =================== WASTE TYPES ===================
export async function listWasteTypes(onlyActive = false) {
  let q = supabase.from('waste_types').select('*').order('name');
  if (onlyActive) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as WasteType[];
}

export async function upsertWasteType(wt: Partial<WasteType>) {
  const { data, error } = await supabase.from('waste_types').upsert(wt).select().single();
  if (error) throw error;
  return data as WasteType;
}

export async function setWasteTypeActive(id: string, active: boolean) {
  const { error } = await supabase.from('waste_types').update({ active }).eq('id', id);
  if (error) throw error;
}

export async function saveWasteType(
  patch: Partial<WasteType>,
  actor?: { id?: string | null; previous?: WasteType | null }
): Promise<WasteType> {
  const saved = await upsertWasteType(patch);
  await logChange('waste_types', saved.id, patch, actor);
  return saved;
}

export const listWasteTypeHistory = (id: string) => listHistory('waste_types', id);

/** Uso acumulado de um tipo de resíduo. */
export interface WasteUsage {
  weighings: number;
  kg: number;
  last: string | null;
}

/**
 * Tipos de resíduo, com os cadastros que a tela precisa para mostrá-los.
 *
 * O tratamento padrão e o destinatário sugerido são referências a outras
 * tabelas; a tela mostra o nome deles e oferece a lista na hora de escolher,
 * então as três leituras saem juntas.
 *
 * `columns` são as colunas que a tabela tem de fato, lidas da resposta.
 */
export async function listWasteTypesWithRefs(): Promise<{
  wasteTypes: WasteType[];
  treatments: TreatmentType[];
  recipients: Recipient[];
  usage: Record<string, WasteUsage>;
  columns: string[];
}> {
  const [waste, treatments, recipients] = await Promise.all([
    supabase.from('waste_types').select('*').order('name'),
    supabase.from('treatment_types').select('*').order('name'),
    supabase.from('recipients').select('*').order('name'),
  ]);
  if (waste.error) throw waste.error;
  if (treatments.error) throw treatments.error;
  if (recipients.error) throw recipients.error;

  const rows = (waste.data ?? []) as WasteType[];
  return {
    wasteTypes: rows,
    treatments: (treatments.data ?? []) as TreatmentType[],
    recipients: (recipients.data ?? []) as Recipient[],
    usage: await wasteUsage(),
    columns: columnsOf(rows),
  };
}

/** A função agregadora existe? `null` enquanto não se sabe. */
let hasWasteUsageRpc: boolean | null = null;

async function wasteUsage(): Promise<Record<string, WasteUsage>> {
  const usage: Record<string, WasteUsage> = {};
  const rpc = hasWasteUsageRpc === false
    ? { error: true as any, data: null }
    : await supabase.rpc('waste_usage_stats');
  if (!rpc.error && Array.isArray(rpc.data)) {
    hasWasteUsageRpc = true;
    for (const row of rpc.data as { waste_type_id: string; weighings: number; total_kg: number; last_used: string | null }[]) {
      usage[row.waste_type_id] = {
        weighings: Number(row.weighings) || 0,
        kg: Number(row.total_kg) || 0,
        last: row.last_used,
      };
    }
    return usage;
  }

  hasWasteUsageRpc = false;
  const { data } = await supabase
    .from('weighings')
    .select('waste_type_id, weight_kg, weighing_date, canceled_at')
    .is('canceled_at', null);
  for (const row of (data ?? []) as { waste_type_id: string | null; weight_kg: number; weighing_date: string }[]) {
    if (!row.waste_type_id) continue;
    const entry = (usage[row.waste_type_id] ??= { weighings: 0, kg: 0, last: null });
    entry.weighings += 1;
    entry.kg += Number(row.weight_kg ?? 0);
    if (!entry.last || row.weighing_date > entry.last) entry.last = row.weighing_date;
  }
  return usage;
}

// =================== TREATMENT TYPES ===================
export async function listTreatmentTypes(onlyActive = false) {
  let q = supabase.from('treatment_types').select('*').order('name');
  if (onlyActive) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as TreatmentType[];
}

export async function upsertTreatmentType(tt: Partial<TreatmentType>) {
  const { data, error } = await supabase.from('treatment_types').upsert(tt).select().single();
  if (error) throw error;
  return data as TreatmentType;
}

export async function setTreatmentActive(id: string, active: boolean) {
  const { error } = await supabase.from('treatment_types').update({ active }).eq('id', id);
  if (error) throw error;
}

export async function saveTreatment(
  patch: Partial<TreatmentType>,
  actor?: { id?: string | null; previous?: TreatmentType | null }
): Promise<TreatmentType> {
  const saved = await upsertTreatmentType(patch);
  await logChange('treatment_types', saved.id, patch, actor);
  return saved;
}

export const listTreatmentHistory = (id: string) => listHistory('treatment_types', id);

/** Uso acumulado de um tratamento. */
export interface TreatmentUsage {
  /** Pesagens registradas com este tratamento (canceladas não contam). */
  weighings: number;
  /** Peso total em quilos. */
  kg: number;
  /** Data da pesagem mais recente; `null` quando nunca foi usado. */
  last: string | null;
}

/**
 * Tipos de tratamento, com o uso de cada um.
 *
 * O indicador "Mais utilizado" e a aba de regras precisam saber quanto peso
 * passou por cada tratamento; a função `treatment_usage_stats` (migração 0011)
 * agrega no banco. Sem ela, a conta é feita aqui — funciona, mas cresce com o
 * histórico, e por isso é o caminho de reserva.
 *
 * `columns` são as colunas que a tabela tem de fato, lidas da resposta.
 */
export async function listTreatmentTypesWithUsage(): Promise<{
  treatments: TreatmentType[];
  usage: Record<string, TreatmentUsage>;
  columns: string[];
}> {
  const { data, error } = await supabase.from('treatment_types').select('*').order('name');
  if (error) throw error;

  const rows = (data ?? []) as TreatmentType[];
  return { treatments: rows, usage: await treatmentUsage(), columns: columnsOf(rows) };
}

/** A função agregadora existe? `null` enquanto não se sabe. */
let hasTreatmentUsageRpc: boolean | null = null;

async function treatmentUsage(): Promise<Record<string, TreatmentUsage>> {
  const usage: Record<string, TreatmentUsage> = {};
  const rpc = hasTreatmentUsageRpc === false
    ? { error: true as any, data: null }
    : await supabase.rpc('treatment_usage_stats');
  if (!rpc.error && Array.isArray(rpc.data)) {
    hasTreatmentUsageRpc = true;
    for (const row of rpc.data as { treatment_type_id: string; weighings: number; total_kg: number; last_used: string | null }[]) {
      usage[row.treatment_type_id] = {
        weighings: Number(row.weighings) || 0,
        kg: Number(row.total_kg) || 0,
        last: row.last_used,
      };
    }
    return usage;
  }

  hasTreatmentUsageRpc = false;
  const { data: weighings } = await supabase
    .from('weighings')
    .select('treatment_type_id, weight_kg, weighing_date, canceled_at')
    .is('canceled_at', null);
  for (const row of (weighings ?? []) as { treatment_type_id: string | null; weight_kg: number; weighing_date: string }[]) {
    if (!row.treatment_type_id) continue;
    const entry = (usage[row.treatment_type_id] ??= { weighings: 0, kg: 0, last: null });
    entry.weighings += 1;
    entry.kg += Number(row.weight_kg ?? 0);
    if (!entry.last || row.weighing_date > entry.last) entry.last = row.weighing_date;
  }
  return usage;
}

// =================== RECIPIENTS ===================
export async function listRecipients(onlyActive = false) {
  let q = supabase.from('recipients').select('*').order('name');
  if (onlyActive) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Recipient[];
}

export async function upsertRecipient(r: Partial<Recipient>) {
  const { data, error } = await supabase.from('recipients').upsert(r).select().single();
  if (error) throw error;
  return data as Recipient;
}

/**
 * Ativa ou desativa um destinatário.
 *
 * Com a migração 0014 quem manda é `status`, e o gatilho do banco acerta
 * `active` a partir dele — gravar os dois aqui abriria a porta para eles
 * discordarem. Sem a migração, a coluna `status` não existe e o banco
 * recusaria o campo, então resta escrever `active` direto.
 */
export async function setRecipientActive(id: string, active: boolean, supportsStatus = false) {
  const patch = supportsStatus ? { status: active ? 'active' : 'inactive' } : { active };
  const { error } = await supabase.from('recipients').update(patch).eq('id', id);
  if (error) throw error;
}

export async function saveRecipient(
  patch: Partial<Recipient>,
  actor?: { id?: string | null; previous?: Recipient | null }
): Promise<Recipient> {
  const saved = await upsertRecipient(patch);
  await logChange('recipients', saved.id, patch, actor);
  return saved;
}

export const listRecipientHistory = (id: string) => listHistory('recipients', id);

/** Uso acumulado de um destinatário. */
export interface RecipientUsage {
  weighings: number;
  kg: number;
  last: string | null;
  /** Pesagens no mês corrente — o indicador "com vínculo no mês". */
  month: number;
}

/**
 * Destinatários, com o uso de cada um.
 *
 * `columns` são as colunas que a tabela tem de fato, lidas da resposta.
 */
export async function listRecipientsWithUsage(): Promise<{
  recipients: Recipient[];
  usage: Record<string, RecipientUsage>;
  columns: string[];
}> {
  const { data, error } = await supabase.from('recipients').select('*').order('name');
  if (error) throw error;

  const rows = (data ?? []) as Recipient[];
  return { recipients: rows, usage: await recipientUsage(), columns: columnsOf(rows) };
}

/** A função agregadora existe? `null` enquanto não se sabe. */
let hasRecipientUsageRpc: boolean | null = null;

async function recipientUsage(): Promise<Record<string, RecipientUsage>> {
  const usage: Record<string, RecipientUsage> = {};
  const rpc = hasRecipientUsageRpc === false
    ? { error: true as any, data: null }
    : await supabase.rpc('recipient_usage_stats');
  if (!rpc.error && Array.isArray(rpc.data)) {
    hasRecipientUsageRpc = true;
    for (const row of rpc.data as {
      recipient_id: string; weighings: number; total_kg: number; last_used: string | null; weighings_this_month: number;
    }[]) {
      usage[row.recipient_id] = {
        weighings: Number(row.weighings) || 0,
        kg: Number(row.total_kg) || 0,
        last: row.last_used,
        month: Number(row.weighings_this_month) || 0,
      };
    }
    return usage;
  }

  hasRecipientUsageRpc = false;
  const { data: weighings } = await supabase
    .from('weighings')
    .select('recipient_id, weight_kg, weighing_date, canceled_at')
    .is('canceled_at', null);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  for (const row of (weighings ?? []) as { recipient_id: string | null; weight_kg: number; weighing_date: string }[]) {
    if (!row.recipient_id) continue;
    const entry = (usage[row.recipient_id] ??= { weighings: 0, kg: 0, last: null, month: 0 });
    entry.weighings += 1;
    entry.kg += Number(row.weight_kg ?? 0);
    if (!entry.last || row.weighing_date > entry.last) entry.last = row.weighing_date;
    if (new Date(row.weighing_date) >= monthStart) entry.month += 1;
  }
  return usage;
}

/**
 * Contagens do topo da tela de administração.
 *
 * Usa `head: true` com `count: 'exact'`: a resposta traz só o número no
 * cabeçalho, sem as linhas — a tela mostra três totais e não precisa dos
 * registros.
 */
export async function getAdminCounts(): Promise<{ activeUsers: number; clients: number; units: number }> {
  const [users, clients, units] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('active', true),
    supabase.from('clients').select('id', { count: 'exact', head: true }),
    supabase.from('units').select('id', { count: 'exact', head: true }),
  ]);
  return {
    activeUsers: users.count ?? 0,
    clients: clients.count ?? 0,
    units: units.count ?? 0,
  };
}
