import { supabase } from '@/lib/supabase';
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
