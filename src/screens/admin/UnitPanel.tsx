import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { AuditEntry, listUnitHistory, saveUnit, setUnitActive, UnitStats } from '@/services/masters';
import { colors, radius, transition } from '@/theme';
import { showAlert } from '@/utils/alert';
import { formatDate, formatDateTime } from '@/utils/format';
import { ColumnCheck, missingColumns, onlyExisting } from '@/utils/columns';
import { Client, Unit } from '@/types';

/**
 * Tipos de operação da unidade.
 *
 * Lista fechada, como os segmentos de cliente: escrito à mão, "Transbordo" e
 * "transbordo" viram dois valores e a coluna deixa de agrupar. Um tipo já
 * gravado fora da lista continua selecionável.
 */
export const UNIT_TYPES = [
  'Industrial',
  'Central de Triagem',
  'Triagem',
  'Transbordo',
  'Armazenamento',
  'Comercial',
  'Administrativa',
  'Outro',
];

const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

const STATUS_OPTIONS = [
  { label: 'Ativa', value: 'active' },
  { label: 'Inativa', value: 'inactive' },
];

const NOTES_LIMIT = 500;

/** Campos que só existem depois da migração 0010 — ver o aviso do topo. */
const EXTENDED_COLUMNS = [
  'code', 'type', 'contact_name', 'phone', 'state', 'street', 'neighborhood', 'postal_code', 'notes',
];

/** Rótulo de cada campo no histórico — o log guarda o nome da coluna. */
const FIELD_LABELS: Record<string, string> = {
  name: 'Nome da unidade',
  client_id: 'Cliente vinculado',
  code: 'Código',
  type: 'Tipo de operação',
  contact_name: 'Responsável',
  phone: 'Telefone',
  city: 'Cidade',
  state: 'Estado',
  address: 'Endereço completo',
  street: 'Logradouro',
  neighborhood: 'Bairro',
  postal_code: 'CEP',
  notes: 'Observações',
  active: 'Situação',
};

const ACTION_LABELS: Record<string, string> = {
  create_unit: 'Unidade cadastrada',
  update_unit: 'Cadastro alterado',
};

type Tab = 'details' | 'address' | 'history';

/**
 * Painel lateral de unidade: detalhes, endereço e histórico.
 *
 * Mesmo desenho dos painéis de cliente e de usuário — a lista continua
 * visível ao lado enquanto se edita, e o mesmo painel cria e edita. Na
 * criação o histórico não aparece: ele só existe depois da unidade.
 */
export function UnitPanel({ unit, clients, stats, can, onClose, onSaved, actorId }: {
  /** `null` abre em modo de criação. */
  unit: Unit | null;
  clients: Client[];
  stats?: UnitStats;
  /** A coluna de cada campo existe no banco? (migração 0010) */
  can: ColumnCheck;
  onClose: () => void;
  onSaved: () => void;
  /** Quem está salvando — vai para o histórico. */
  actorId?: string | null;
}) {
  const creating = !unit;
  const [tab, setTab] = useState<Tab>('details');
  const [name, setName] = useState(unit?.name ?? '');
  const [clientId, setClientId] = useState(unit?.client_id ?? '');
  const [code, setCode] = useState(unit?.code ?? '');
  const [type, setType] = useState(unit?.type ?? '');
  const [contactName, setContactName] = useState(unit?.contact_name ?? '');
  const [phone, setPhone] = useState(unit?.phone ?? '');
  const [city, setCity] = useState(unit?.city ?? '');
  const [uf, setUf] = useState(unit?.state ?? '');
  const [address, setAddress] = useState(unit?.address ?? '');
  const [street, setStreet] = useState(unit?.street ?? '');
  const [neighborhood, setNeighborhood] = useState(unit?.neighborhood ?? '');
  const [postalCode, setPostalCode] = useState(unit?.postal_code ?? '');
  const [status, setStatus] = useState(unit?.active === false ? 'inactive' : 'active');
  const [notes, setNotes] = useState(unit?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [busyOff, setBusyOff] = useState(false);

  const [history, setHistory] = useState<AuditEntry[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // O histórico só é lido quando a aba é aberta: é a única parte do painel que
  // custa uma ida ao banco, e a maioria das edições não passa por ela.
  const loadHistory = useCallback(async () => {
    if (!unit) return;
    try {
      setHistory(await listUnitHistory(unit.id));
    } catch (e: any) {
      setHistoryError(e?.message ?? 'Falha ao carregar o histórico.');
      setHistory([]);
    }
  }, [unit]);

  useEffect(() => {
    if (tab === 'history' && history === null) loadHistory();
  }, [tab, history, loadHistory]);

  const client = clients.find((c) => c.id === clientId);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Informe o nome da unidade.';
    if (!clientId) e.clientId = 'Escolha o cliente da unidade.';
    if (notes.length > NOTES_LIMIT) e.notes = `Máximo de ${NOTES_LIMIT} caracteres.`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const base: Partial<Unit> = {
        ...(creating ? {} : { id: unit!.id }),
        name: name.trim(),
        client_id: clientId,
        city: city.trim() || null,
        address: address.trim() || null,
        active: status === 'active',
      };
      // Cada campo entra no envio só se a coluna dele existir: uma coluna
      // inexistente faria o banco recusar a gravação inteira, inclusive os
      // campos que existem.
      const patch: Partial<Unit> = {
        ...base,
        ...onlyExisting({
          code: code.trim() || null,
          type: type || null,
          contact_name: contactName.trim() || null,
          phone: phone.trim() || null,
          state: uf || null,
          street: street.trim() || null,
          neighborhood: neighborhood.trim() || null,
          postal_code: postalCode.trim() || null,
          notes: notes.trim() || null,
        }, can),
      };
      await saveUnit(patch, { id: actorId, previous: unit });
      onSaved();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao salvar unidade.');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    setBusyOff(true);
    try {
      await setUnitActive(unit!.id, false);
      setConfirmOff(false);
      onSaved();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao desativar unidade.');
    } finally {
      setBusyOff(false);
    }
  };

  /** Monta o endereço completo com o que está preenchido aqui. */
  const composeAddress = () => {
    const line1 = [street.trim(), neighborhood.trim()].filter(Boolean).join(' — ');
    const line2 = [[city.trim(), uf].filter(Boolean).join(', '), postalCode.trim() ? `CEP ${postalCode.trim()}` : '']
      .filter(Boolean).join(' — ');
    const text = [line1, line2].filter(Boolean).join('\n');
    if (!text) {
      showAlert('Nada a compor', 'Preencha o CEP, o logradouro ou o bairro para montar o endereço.');
      return;
    }
    setAddress(text);
    setTab('details');
  };

  const tabs: { key: Tab; label: string; icon: React.ComponentType<any> }[] = [
    { key: 'details', label: 'Detalhes', icon: User },
    { key: 'address', label: 'Endereço', icon: MapPin },
    { key: 'history', label: 'Histórico', icon: Clock },
  ];

  // Quais campos estão sem coluna — o aviso do topo fala em número.
  const locked = missingColumns(EXTENDED_COLUMNS, can);

  const clientOptions = clients.map((c) => ({ label: c.name, value: c.id }));

  const typeOptions = [
    { label: 'Não informado', value: '' },
    // Um tipo gravado fora da lista continua selecionável — apagá-lo ao salvar
    // outro campo seria perder dado sem avisar.
    ...(type && !UNIT_TYPES.includes(type) ? [{ label: type, value: type }] : []),
    ...UNIT_TYPES.map((t) => ({ label: t, value: t })),
  ];

  const ufOptions = [{ label: '—', value: '' }, ...UFS.map((u) => ({ label: u, value: u }))];

  return (
    <View style={s.panel}>
      {/* ── Identificação ──────────────────────────────────────────── */}
      <View style={s.head}>
        <View style={s.headRow}>
          {creating ? (
            <View style={[s.avatar, s.avatarNew]}>
              <MapPin size={26} strokeWidth={2} color={colors.form.tileIcon} />
            </View>
          ) : (
            <View style={[s.avatar, { backgroundColor: colors.avatars[avatarIndex(unit!.id)].bg }]}>
              <Text style={[s.avatarText, { color: colors.avatars[avatarIndex(unit!.id)].fg }]}>
                {unitInitials(unit!.name)}
              </Text>
            </View>
          )}
          <View style={s.grow}>
            <View style={s.nameRow}>
              <Text style={s.name} numberOfLines={2}>{creating ? 'Nova unidade' : unit!.name}</Text>
              {!creating ? (
                <View style={[s.statusPill, { backgroundColor: unit!.active ? '#EEF8F1' : colors.surfaceSunken }]}>
                  <View style={[s.dot, { backgroundColor: unit!.active ? colors.success : colors.textMuted }]} />
                  <Text style={[s.statusText, { color: unit!.active ? colors.success : colors.textMuted }]}>
                    {unit!.active ? 'Ativa' : 'Inativa'}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={s.sub} numberOfLines={1}>
              {creating ? 'Preencha os dados da unidade' : client?.name ?? 'Cliente não encontrado'}
            </Text>
            {!creating ? (
              <Text style={s.since}>
                {unit!.code ? `Código: ${unit!.code}` : `Cadastrada em ${formatDate(unit!.created_at)}`}
              </Text>
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
                  {' '}Aplique a migração 0010 para liberá-los; o que está editável já é gravado normalmente.
                </Text>
              </View>
            ) : null}

            <Input size="form" label="Nome da unidade" required value={name} onChangeText={setName} error={errors.name} />

            <View style={s.row}>
              <View style={s.cellWide}>
                <Select
                  size="form"
                  label="Cliente vinculado"
                  required
                  leftIconComponent={BuildingIcon}
                  placeholder="Escolha o cliente"
                  options={clientOptions}
                  value={clientId}
                  onChange={setClientId}
                  error={errors.clientId}
                />
              </View>
              <View style={s.cell}>
                <Input
                  size="form"
                  label="Código da unidade"
                  value={code}
                  onChangeText={setCode}
                  editable={can('code')}
                  placeholder={can('code') ? 'Ex.: UP-001' : 'Após a migração 0010'}
                />
              </View>
            </View>

            {/* O desenho tem a coluna "Tipo" na lista mas não mostra o campo:
                sem ele a coluna não teria como ser preenchida. */}
            <Select
              size="form"
              label="Tipo de operação"
              leftIconComponent={BuildingIcon}
              options={typeOptions}
              value={type}
              onChange={setType}
              disabled={!can('type')}
            />

            <View style={s.row}>
              <View style={s.cell}>
                <Input
                  size="form"
                  label="Responsável"
                  value={contactName}
                  onChangeText={setContactName}
                  editable={can('contact_name')}
                  placeholder={can('contact_name') ? 'Quem responde pela unidade' : 'Após a migração 0010'}
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
                  editable={can('phone')}
                  placeholder={can('phone') ? '(00) 00000-0000' : 'Após a migração 0010'}
                />
              </View>
            </View>

            <View style={s.row}>
              <View style={s.cellCity}>
                <Input size="form" label="Cidade" leftIconComponent={MapPin} value={city} onChangeText={setCity} placeholder="Cidade da unidade" />
              </View>
              <View style={s.cellUf}>
                <Select size="form" label="Estado" options={ufOptions} value={uf} onChange={setUf} disabled={!can('state')} />
              </View>
            </View>

            <Input
              size="form"
              label="Endereço completo"
              placeholder="Rua, número, bairro, cidade e CEP"
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={2}
              style={s.addressInput}
            />

            <Select
              size="form"
              label="Situação"
              leftIcon="ellipse"
              leftIconColor={status === 'active' ? colors.success : colors.textMuted}
              options={STATUS_OPTIONS}
              value={status}
              onChange={setStatus}
            />

            <View style={s.notesBlock}>
              <Input
                size="form"
                label="Observações (opcional)"
                placeholder={can('notes') ? 'Anote algo relevante sobre esta unidade...' : 'Disponível após a migração 0010.'}
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

        {tab === 'address' && !creating ? (
          <View>
            <Text style={s.blockTitle}>Endereço detalhado</Text>
            <Text style={s.blockHint}>
              Opcional. Quem só tem o endereço num texto pode deixar tudo em "Endereço completo",
              na aba Detalhes — é esse texto que aparece nas listas e nos relatórios.
            </Text>

            <View style={s.row}>
              <View style={s.cell}>
                <Input
                  size="form"
                  label="CEP"
                  value={postalCode}
                  onChangeText={setPostalCode}
                  editable={can('postal_code')}
                  placeholder={can('postal_code') ? '00000-000' : 'Após a migração 0010'}
                />
              </View>
              <View style={s.cell} />
            </View>
            <Input
              size="form"
              label="Logradouro"
              value={street}
              onChangeText={setStreet}
              editable={can('street')}
              placeholder={can('street') ? 'Rua, avenida ou rodovia, com número' : 'Após a migração 0010'}
            />
            <Input
              size="form"
              label="Bairro"
              value={neighborhood}
              onChangeText={setNeighborhood}
              editable={can('neighborhood')}
              placeholder={can('neighborhood') ? 'Bairro ou distrito' : 'Após a migração 0010'}
            />

            {/* Resolve a duplicidade entre o texto livre e os campos: em vez de
                manter dois endereços que podem discordar, monta um a partir do
                outro quando se pede. */}
            <Button
              title="Compor endereço completo"
              variant="outline"
              iconComponent={MapPin}
              onPress={composeAddress}
              style={s.composeButton}
            />
            <Text style={s.blockHint}>
              Escreve o endereço completo com o que está preenchido aqui, na cidade e no estado.
              O texto anterior é substituído, e nada é gravado antes de salvar.
            </Text>
          </View>
        ) : null}

        {tab === 'history' && !creating ? (
          <View>
            <Text style={s.blockTitle}>Histórico da unidade</Text>
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
                  ...(stats?.last
                    ? [{
                        label: 'Última pesagem registrada',
                        date: formatDateTime(stats.last),
                        detail: stats.month > 0
                          ? `${stats.month} ${stats.month === 1 ? 'pesagem' : 'pesagens'} neste mês.`
                          : 'Nenhuma pesagem neste mês.',
                      }]
                    : [{ label: 'Nenhuma pesagem registrada', date: '—', detail: 'A unidade existe, mas ainda não recebeu pesagem.' }]),
                  ...history.map((h) => ({
                    label: ACTION_LABELS[h.action] ?? h.action,
                    date: formatDateTime(h.created_at),
                    detail: changedFields(h),
                  })),
                  ...(can('updated_at') && unit!.updated_at && history.length === 0
                    ? [{ label: 'Última alteração no cadastro', date: formatDateTime(unit!.updated_at), detail: null }]
                    : []),
                  { label: 'Unidade cadastrada', date: formatDateTime(unit!.created_at), detail: null },
                ]}
              />
            )}
          </View>
        ) : null}
      </ScrollView>

      {/* ── Ações ──────────────────────────────────────────────────── */}
      <View style={s.actions}>
        {!creating && unit!.active ? (
          <View style={s.cell}>
            <Button
              title="Desativar unidade"
              variant="dangerOutline"
              iconComponent={Trash}
              onPress={() => setConfirmOff(true)}
              style={s.dangerButton}
            />
          </View>
        ) : null}
        <View style={s.cell}>
          <Button
            title={creating ? 'Criar unidade' : 'Salvar alterações'}
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
        title="Desativar unidade?"
        message={`${unit?.name} deixa de aparecer na escolha de unidade das novas pesagens. As pesagens já registradas continuam intactas.`}
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
  return keys.map((k) => FIELD_LABELS[k] ?? k).join(', ');
}

/**
 * Iniciais da unidade: "Unidade São Bernardo" → "SB".
 *
 * As duas primeiras letras não servem aqui: quase toda unidade começa com a
 * palavra "Unidade", e uma lista de avatares todos escritos "UN" não
 * distingue nada. As palavras genéricas do começo do nome são descartadas, e
 * o que sobra dá as iniciais — com uma palavra só, as duas primeiras letras
 * dela.
 */
const GENERIC_WORDS = ['unidade', 'unidades', 'filial', 'planta', 'centro', 'cd', 'base', 'polo', 'pólo', 'de', 'da', 'do'];

export function unitInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const meaningful = words.filter((w) => !GENERIC_WORDS.includes(w.toLocaleLowerCase()));
  const use = meaningful.length > 0 ? meaningful : words;
  if (use.length === 1) return use[0].slice(0, 2).toUpperCase();
  return use.slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || '?';
}

/** Mesma cor de avatar da lista: derivada da unidade, não da posição. */
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

  addressInput: { height: 74, paddingTop: 12, textAlignVertical: 'top' },
  notesBlock: { position: 'relative' },
  notesInput: { height: 96, paddingTop: 12, textAlignVertical: 'top' },
  counter: { position: 'absolute', right: 12, bottom: 30, fontSize: 12, color: colors.form.soft },

  blockTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  blockHint: { fontSize: 13.5, lineHeight: 19, color: colors.form.muted, marginTop: 4, marginBottom: 18 },
  historyError: { fontSize: 13, color: colors.danger, marginBottom: 12 },
  composeButton: { minHeight: 46, borderRadius: 10 },

  actions: {
    flexDirection: 'row', gap: 16,
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 22,
    borderTopWidth: 1, borderTopColor: colors.form.divider,
  },
  dangerButton: { minHeight: 50, borderRadius: 10 },
  saveButton: { minHeight: 50, borderRadius: 10 },
});
