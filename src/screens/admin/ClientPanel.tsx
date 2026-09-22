import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Briefcase from 'lucide-react-native/icons/briefcase';
import Check from 'lucide-react-native/icons/check';
import Clock from 'lucide-react-native/icons/clock';
import MapPin from 'lucide-react-native/icons/map-pin';
import Phone from 'lucide-react-native/icons/phone';
import Trash from 'lucide-react-native/icons/trash';
import User from 'lucide-react-native/icons/user';
import X from 'lucide-react-native/icons/x';
import { Button, ConfirmModal, Input, Loading, Select } from '@/components';
import { BuildingIcon } from '@/components/MenuIcons';
import { Timeline } from '@/components/Operations';
import { AuditEntry, listClientHistory, saveClient, setClientActive } from '@/services/masters';
import { colors, radius, transition } from '@/theme';
import { showAlert } from '@/utils/alert';
import { formatDate, formatDateTime, formatDocument } from '@/utils/format';
import { ColumnCheck, missingColumns, onlyExisting } from '@/utils/columns';
import { Client, Unit } from '@/types';

/**
 * Segmentos oferecidos no cadastro.
 *
 * Lista fechada: se cada pessoa escrever o segmento à mão, "Indústria" e
 * "Industria" viram dois filtros diferentes e a coluna deixa de agrupar. Um
 * cliente já gravado com outro valor continua aparecendo — a opção dele entra
 * na lista em vez de ser silenciosamente trocada.
 */
export const SEGMENTS = [
  'Indústria',
  'Comércio',
  'Serviços',
  'Construção Civil',
  'Alimentos e Bebidas',
  'Logística',
  'Mineração',
  'Varejo',
  'Tecnologia',
  'Saúde',
  'Agronegócio',
  'Outro',
];

const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

const STATUS_OPTIONS = [
  { label: 'Ativo', value: 'active' },
  { label: 'Inativo', value: 'inactive' },
];

const NOTES_LIMIT = 500;

/**
 * Campos que só existem depois da migração 0009.
 *
 * Serve para o aviso do topo: em vez de uma frase fixa, ele conta quantos
 * campos estão esperando coluna — e desaparece quando não falta nenhum.
 */
const EXTENDED_COLUMNS = [
  'trade_name', 'state_registration', 'segment', 'contact_name', 'contact_role', 'city', 'state', 'notes',
];

/** Rótulo de cada campo no histórico — o log guarda o nome da coluna. */
const FIELD_LABELS: Record<string, string> = {
  name: 'Razão social',
  trade_name: 'Nome fantasia',
  document: 'CNPJ',
  state_registration: 'Inscrição estadual',
  segment: 'Segmento',
  contact_name: 'Responsável',
  contact_role: 'Cargo',
  email: 'E-mail',
  phone: 'Telefone',
  city: 'Cidade',
  state: 'UF',
  notes: 'Observações',
  active: 'Situação',
};

const ACTION_LABELS: Record<string, string> = {
  create_client: 'Cliente cadastrado',
  update_client: 'Cadastro alterado',
};

type Tab = 'details' | 'units' | 'history';

/**
 * Painel lateral de cliente: detalhes, unidades e histórico.
 *
 * Mesmo desenho do painel de usuários — a lista continua visível ao lado
 * enquanto se edita, e o mesmo painel cria e edita. Na criação as abas não
 * aparecem: unidades e histórico só existem depois que o cliente existe.
 */
export function ClientPanel({ client, units, can, onClose, onSaved, actorId }: {
  /** `null` abre em modo de criação. */
  client: Client | null;
  units: Unit[];
  /** A coluna de cada campo existe no banco? (migração 0009) */
  can: ColumnCheck;
  onClose: () => void;
  onSaved: () => void;
  /** Quem está salvando — vai para o histórico. */
  actorId?: string | null;
}) {
  const creating = !client;
  const [tab, setTab] = useState<Tab>('details');
  const [name, setName] = useState(client?.name ?? '');
  const [tradeName, setTradeName] = useState(client?.trade_name ?? '');
  const [document, setDocument] = useState(formatDocument(client?.document));
  const [stateRegistration, setStateRegistration] = useState(client?.state_registration ?? '');
  const [segment, setSegment] = useState(client?.segment ?? '');
  const [status, setStatus] = useState(client?.active === false ? 'inactive' : 'active');
  const [contactName, setContactName] = useState(client?.contact_name ?? '');
  const [contactRole, setContactRole] = useState(client?.contact_role ?? '');
  const [email, setEmail] = useState(client?.email ?? '');
  const [phone, setPhone] = useState(client?.phone ?? '');
  const [city, setCity] = useState(client?.city ?? '');
  const [uf, setUf] = useState(client?.state ?? '');
  const [notes, setNotes] = useState(client?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [busyOff, setBusyOff] = useState(false);

  const [history, setHistory] = useState<AuditEntry[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // O histórico só é lido quando a aba é aberta: é a única parte do painel que
  // custa uma ida ao banco, e a maioria das edições não passa por ela.
  const loadHistory = useCallback(async () => {
    if (!client) return;
    try {
      setHistory(await listClientHistory(client.id));
    } catch (e: any) {
      setHistoryError(e?.message ?? 'Falha ao carregar o histórico.');
      setHistory([]);
    }
  }, [client]);

  useEffect(() => {
    if (tab === 'history' && history === null) loadHistory();
  }, [tab, history, loadHistory]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Informe a razão social.';
    const digits = digitsOf(document) ?? '';
    // Documento é opcional, mas se vier tem que ser um CNPJ ou um CPF: com 9
    // dígitos ninguém consegue emitir nota nem cruzar com o cadastro fiscal.
    if (digits && digits.length !== 14 && digits.length !== 11) {
      e.document = 'Informe um CNPJ (14 dígitos) ou CPF (11 dígitos).';
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'E-mail inválido.';
    if (notes.length > NOTES_LIMIT) e.notes = `Máximo de ${NOTES_LIMIT} caracteres.`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const base: Partial<Client> = {
        ...(creating ? {} : { id: client!.id }),
        name: name.trim(),
        // Grava so os digitos: o campo mostra o documento pontuado, mas
        // guardar a pontuacao faria o mesmo CNPJ existir em duas formas no
        // banco — e a importacao de planilhas casa cliente por documento.
        document: digitsOf(document),
        email: email.trim() || null,
        phone: phone.trim() || null,
        active: status === 'active',
      };
      // Cada campo entra no envio só se a coluna dele existir: uma coluna
      // inexistente faria o banco recusar a gravação inteira, inclusive os
      // campos que existem.
      const patch: Partial<Client> = {
        ...base,
        ...onlyExisting({
          trade_name: tradeName.trim() || null,
          state_registration: stateRegistration.trim() || null,
          segment: segment || null,
          contact_name: contactName.trim() || null,
          contact_role: contactRole.trim() || null,
          city: city.trim() || null,
          state: uf || null,
          notes: notes.trim() || null,
        }, can),
      };
      await saveClient(patch, { id: actorId, previous: client });
      onSaved();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao salvar cliente.');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    setBusyOff(true);
    try {
      await setClientActive(client!.id, false);
      setConfirmOff(false);
      onSaved();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao desativar cliente.');
    } finally {
      setBusyOff(false);
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ComponentType<any> }[] = [
    { key: 'details', label: 'Detalhes', icon: User },
    { key: 'units', label: 'Unidades', icon: BuildingIcon },
    { key: 'history', label: 'Histórico', icon: Clock },
  ];

  // Quais campos estão sem coluna — o aviso do topo fala em número, não em
  // "os demais campos".
  const locked = missingColumns(EXTENDED_COLUMNS, can);

  const segmentOptions = [
    { label: 'Não informado', value: '' },
    // Um segmento gravado fora da lista continua selecionável — apagá-lo ao
    // salvar outro campo seria perder dado sem avisar.
    ...(segment && !SEGMENTS.includes(segment) ? [segment] : []),
    ...SEGMENTS,
  ].map((o) => (typeof o === 'string' ? { label: o, value: o } : o));

  const ufOptions = [{ label: '—', value: '' }, ...UFS.map((u) => ({ label: u, value: u }))];

  const activeUnits = units.filter((u) => u.active).length;

  return (
    <View style={s.panel}>
      {/* ── Identificação ──────────────────────────────────────────── */}
      <View style={s.head}>
        <View style={s.headRow}>
          {creating ? (
            <View style={[s.avatar, s.avatarNew]}>
              <BuildingIcon size={26} strokeWidth={2} color={colors.form.tileIcon} />
            </View>
          ) : (
            <View style={[s.avatar, { backgroundColor: colors.avatars[avatarIndex(client!.id)].bg }]}>
              <Text style={[s.avatarText, { color: colors.avatars[avatarIndex(client!.id)].fg }]}>
                {initials(client!.name)}
              </Text>
            </View>
          )}
          <View style={s.grow}>
            <View style={s.nameRow}>
              <Text style={s.name} numberOfLines={2}>{creating ? 'Novo cliente' : client!.name}</Text>
              {!creating ? (
                <View style={[s.statusPill, { backgroundColor: client!.active ? '#EEF8F1' : colors.surfaceSunken }]}>
                  <View style={[s.dot, { backgroundColor: client!.active ? colors.success : colors.textMuted }]} />
                  <Text style={[s.statusText, { color: client!.active ? colors.success : colors.textMuted }]}>
                    {client!.active ? 'Ativo' : 'Inativo'}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={s.sub} numberOfLines={1}>
              {creating ? 'Preencha os dados do cadastro' : formatDocument(client!.document) || 'Documento não informado'}
            </Text>
            {!creating && client!.created_at ? (
              <Text style={s.since}>Cliente desde {formatDate(client!.created_at)}</Text>
            ) : null}
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fechar painel"
            style={({ hovered }: any) => [s.close, transition(), hovered && s.closeHover]}
          >
            <X size={20} strokeWidth={2} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      {/* ── Abas ───────────────────────────────────────────────────── */}
      {creating ? null : (
        <View style={s.tabs}>
          {tabs.map((t) => {
            const on = tab === t.key;
            const Icon = t.icon;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={({ hovered }: any) => [s.tab, on && s.tabOn, transition(), hovered && !on && s.tabHover]}
              >
                <Icon size={17} strokeWidth={2} color={on ? colors.text : colors.form.muted} />
                <Text style={[s.tabText, on && s.tabTextOn]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {tab === 'details' || creating ? (
          <>
            {locked.length > 0 ? (
              <View style={s.warning}>
                <Text style={s.warningText}>
                  {locked.length === 1
                    ? 'Um campo está desabilitado porque a coluna dele ainda não existe no banco.'
                    : `${locked.length} campos estão desabilitados porque as colunas deles ainda não existem no banco.`}
                  {' '}Aplique a migração 0009 para liberá-los; o que está editável já é gravado normalmente.
                </Text>
              </View>
            ) : null}

            <View style={s.row}>
              <View style={s.cell}>
                <Input size="form" label="Razão social" required value={name} onChangeText={setName} error={errors.name} />
              </View>
              <View style={s.cell}>
                <Input
                  size="form"
                  label="Nome fantasia"
                  value={tradeName}
                  onChangeText={setTradeName}
                  editable={can('trade_name')}
                  placeholder={can('trade_name') ? 'Como o cliente é conhecido' : 'Após a migração 0009'}
                />
              </View>
            </View>

            <View style={s.row}>
              <View style={s.cell}>
                <Input
                  size="form"
                  label="CNPJ"
                  value={document}
                  onChangeText={setDocument}
                  onBlur={() => setDocument((v) => formatDocument(v) || v)}
                  placeholder="00.000.000/0001-00"
                  error={errors.document}
                />
              </View>
              <View style={s.cell}>
                <Input
                  size="form"
                  label="Inscrição estadual"
                  value={stateRegistration}
                  onChangeText={setStateRegistration}
                  editable={can('state_registration')}
                  placeholder={can('state_registration') ? 'Isento, se não houver' : 'Após a migração 0009'}
                />
              </View>
            </View>

            <View style={s.row}>
              <View style={s.cellWide}>
                <Select
                  size="form"
                  label="Segmento"
                  leftIconComponent={BuildingIcon}
                  options={segmentOptions}
                  value={segment}
                  onChange={setSegment}
                  disabled={!can('segment')}
                />
              </View>
              <View style={s.cell}>
                <Select
                  size="form"
                  label="Situação"
                  leftIcon="ellipse"
                  leftIconColor={status === 'active' ? colors.success : colors.textMuted}
                  options={STATUS_OPTIONS}
                  value={status}
                  onChange={setStatus}
                />
              </View>
            </View>

            <View style={s.row}>
              <View style={s.cell}>
                <Input
                  size="form"
                  label="Responsável"
                  value={contactName}
                  onChangeText={setContactName}
                  editable={can('contact_name')}
                  placeholder={can('contact_name') ? 'Quem atende pelo cliente' : 'Após a migração 0009'}
                />
              </View>
              <View style={s.cell}>
                <Input
                  size="form"
                  label="Cargo"
                  leftIconComponent={can('contact_role') ? Briefcase : undefined}
                  value={contactRole}
                  onChangeText={setContactRole}
                  editable={can('contact_role')}
                  placeholder={can('contact_role') ? 'Cargo do responsável' : 'Após a migração 0009'}
                />
              </View>
            </View>

            <View style={s.row}>
              <View style={s.cell}>
                <Input
                  size="form"
                  label="E-mail"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  error={errors.email}
                  placeholder="contato@cliente.com.br"
                />
              </View>
              <View style={s.cell}>
                <Input
                  size="form"
                  label="Telefone"
                  leftIconComponent={Phone}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="(00) 0000-0000"
                />
              </View>
            </View>

            {/* Cidade e UF em campos separados, não num só como no desenho: a
                UF tem duas letras no banco, e um campo único obrigaria a
                adivinhar onde termina a cidade em "Rio Branco - AC". */}
            <View style={s.row}>
              <View style={s.cellCity}>
                <Input
                  size="form"
                  label="Cidade"
                  leftIconComponent={MapPin}
                  value={city}
                  onChangeText={setCity}
                  editable={can('city')}
                  placeholder={can('city') ? 'Cidade da sede' : 'Após a migração 0009'}
                />
              </View>
              <View style={s.cellUf}>
                <Select size="form" label="UF" options={ufOptions} value={uf} onChange={setUf} disabled={!can('state')} />
              </View>
            </View>

            <View style={s.notesBlock}>
              <Input
                size="form"
                label="Observações (opcional)"
                placeholder={can('notes') ? 'Anote algo relevante sobre este cliente...' : 'Disponível após a migração 0009.'}
                value={notes}
                onChangeText={(v) => setNotes(v.slice(0, NOTES_LIMIT))}
                editable={can('notes')}
                multiline
                numberOfLines={3}
                style={s.notesInput}
                error={errors.notes}
              />
              {can('notes') ? <Text style={s.counter}>{notes.length}/{NOTES_LIMIT}</Text> : null}
            </View>
          </>
        ) : null}

        {tab === 'units' && !creating ? (
          <View>
            <Text style={s.blockTitle}>
              {units.length === 0
                ? 'Nenhuma unidade vinculada'
                : `${units.length} ${units.length === 1 ? 'unidade vinculada' : 'unidades vinculadas'}`}
            </Text>
            <Text style={s.blockHint}>
              {units.length === 0
                ? 'As pesagens são lançadas por unidade. Cadastre a primeira em Cadastros › Unidades.'
                : `${activeUnits} ${activeUnits === 1 ? 'ativa' : 'ativas'}. As unidades são cadastradas em Cadastros › Unidades.`}
            </Text>
            {units.map((u) => (
              <View key={u.id} style={s.unitRow}>
                <View style={s.unitSeal}>
                  <BuildingIcon size={20} strokeWidth={2} color={colors.form.tileIcon} />
                </View>
                <View style={s.grow}>
                  <Text style={s.unitName} numberOfLines={1}>{u.name}</Text>
                  <Text style={s.unitPlace} numberOfLines={1}>
                    {[u.city, u.state].filter(Boolean).join(' - ') || u.address || 'Endereço não informado'}
                  </Text>
                </View>
                <View style={[s.statusPill, { backgroundColor: u.active ? '#EEF8F1' : colors.surfaceSunken }]}>
                  <View style={[s.dot, { backgroundColor: u.active ? colors.success : colors.textMuted }]} />
                  <Text style={[s.statusText, { color: u.active ? colors.success : colors.textMuted }]}>
                    {u.active ? 'Ativa' : 'Inativa'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {tab === 'history' && !creating ? (
          <View>
            <Text style={s.blockTitle}>Histórico do cadastro</Text>
            <Text style={s.blockHint}>
              {history && history.length > 0
                ? 'Cada alteração salva por aqui registra quais campos mudaram.'
                : 'Ainda não há alterações registradas. As próximas edições feitas neste painel entram aqui com os campos que mudaram.'}
            </Text>
            {historyError ? <Text style={s.historyError}>{historyError}</Text> : null}
            {history === null ? (
              <Loading />
            ) : (
              <Timeline
                events={[
                  ...history.map((h) => ({
                    label: ACTION_LABELS[h.action] ?? h.action,
                    date: formatDateTime(h.created_at),
                    detail: changedFields(h),
                  })),
                  ...(can('updated_at') && client!.updated_at && history.length === 0
                    ? [{ label: 'Última alteração no cadastro', date: formatDateTime(client!.updated_at), detail: null }]
                    : []),
                  { label: 'Cliente cadastrado', date: formatDateTime(client!.created_at), detail: null },
                ]}
              />
            )}
          </View>
        ) : null}
      </ScrollView>

      {/* ── Ações ──────────────────────────────────────────────────── */}
      <View style={s.actions}>
        {!creating && client!.active ? (
          <View style={s.cell}>
            <Button
              title="Desativar cliente"
              variant="dangerOutline"
              iconComponent={Trash}
              onPress={() => setConfirmOff(true)}
              style={s.dangerButton}
            />
          </View>
        ) : null}
        <View style={s.cell}>
          <Button
            title={creating ? 'Criar cliente' : 'Salvar alterações'}
            variant="deep"
            iconComponent={Check}
            loading={saving}
            onPress={save}
            style={s.saveButton}
          />
        </View>
      </View>

      <ConfirmModal
        visible={confirmOff}
        title="Desativar cliente?"
        message={`${client?.name} deixa de aparecer para novas pesagens. As pesagens já registradas e as unidades continuam intactas.`}
        confirmLabel="Desativar"
        destructive
        loading={busyOff}
        onConfirm={deactivate}
        onCancel={() => setConfirmOff(false)}
      />
    </View>
  );
}

/**
 * Quais campos a alteração mexeu.
 *
 * O log guarda valor antigo e novo; aqui interessa o nome dos campos — a
 * lista de valores caberia mal na linha do tempo e o valor atual está no
 * formulário, a uma aba de distância.
 */
function changedFields(entry: AuditEntry): string | null {
  const keys = Object.keys(entry.new_data ?? {}).filter((k) => {
    if (!entry.old_data) return true;
    return JSON.stringify((entry.old_data as any)[k] ?? null) !== JSON.stringify((entry.new_data as any)[k] ?? null);
  });
  if (keys.length === 0) return null;
  const labels = keys.map((k) => FIELD_LABELS[k] ?? k);
  return labels.join(', ');
}

/** Só os dígitos do documento, ou `null` quando o campo está vazio. */
function digitsOf(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  return digits || null;
}

/** Iniciais das duas primeiras palavras: "Ambiental Santos LTDA" → "AS". */
function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || '?';
}

/** Mesma cor de avatar da lista: derivada do cliente, não da posição. */
function avatarIndex(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % colors.avatars.length;
}

const s = StyleSheet.create({
  panel: { flex: 1, backgroundColor: colors.surface },
  grow: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', gap: 16 },
  cell: { flex: 1, minWidth: 0 },
  cellWide: { flex: 1.3, minWidth: 0 },
  cellCity: { flex: 2.4, minWidth: 0 },
  cellUf: { flex: 1, minWidth: 0 },

  head: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 18 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarNew: { backgroundColor: colors.form.tile },
  avatarText: { fontSize: 20, fontWeight: '700' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  name: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.3, flexShrink: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  statusText: { fontSize: 12.5, fontWeight: '700' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  sub: { fontSize: 14, color: colors.form.muted, marginTop: 4 },
  since: { fontSize: 13, color: colors.form.soft, marginTop: 2 },
  close: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  closeHover: { backgroundColor: colors.surfaceSunken },

  tabs: { flexDirection: 'row', paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: colors.form.divider },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 4, marginRight: 24, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabHover: { opacity: 0.75 },
  tabOn: { borderBottomColor: colors.form.action },
  tabText: { fontSize: 14.5, color: colors.form.muted },
  tabTextOn: { color: colors.text, fontWeight: '700' },

  body: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 },

  warning: {
    backgroundColor: colors.form.infoBg,
    borderWidth: 1,
    borderColor: colors.form.infoBorder,
    borderRadius: 10,
    padding: 12,
    marginBottom: 18,
  },
  warningText: { fontSize: 12.5, lineHeight: 18, color: colors.form.infoText },

  notesBlock: { position: 'relative' },
  notesInput: { height: 96, paddingTop: 12, textAlignVertical: 'top' },
  counter: { position: 'absolute', right: 12, bottom: 30, fontSize: 12, color: colors.form.soft },

  blockTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  blockHint: { fontSize: 13.5, lineHeight: 19, color: colors.form.muted, marginTop: 4, marginBottom: 18 },
  historyError: { fontSize: 13, color: colors.danger, marginBottom: 12 },

  unitRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  unitSeal: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.form.rowTile, alignItems: 'center', justifyContent: 'center' },
  unitName: { fontSize: 14.5, fontWeight: '700', color: colors.text },
  unitPlace: { fontSize: 13, color: colors.form.muted, marginTop: 2 },

  actions: {
    flexDirection: 'row', gap: 16,
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 22,
    borderTopWidth: 1, borderTopColor: colors.form.divider,
  },
  dangerButton: { minHeight: 50, borderRadius: 10 },
  saveButton: { minHeight: 50, borderRadius: 10 },
});
