import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import Clock from 'lucide-react-native/icons/clock';
import Droplets from 'lucide-react-native/icons/droplets';
import Flame from 'lucide-react-native/icons/flame';
import Info from 'lucide-react-native/icons/info';
import Layers from 'lucide-react-native/icons/layers';
import Package from 'lucide-react-native/icons/package';
import Recycle from 'lucide-react-native/icons/recycle';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import Settings from 'lucide-react-native/icons/settings';
import Sprout from 'lucide-react-native/icons/sprout';
import Trash from 'lucide-react-native/icons/trash';
import X from 'lucide-react-native/icons/x';
import { Button, ConfirmModal, Input, Loading, Select } from '@/components';
import { Timeline } from '@/components/Operations';
import { AuditEntry, listTreatmentHistory, saveTreatment, setTreatmentActive, TreatmentUsage } from '@/services/masters';
import { colors, radius, transition } from '@/theme';
import { showAlert } from '@/utils/alert';
import { formatDateTime, formatNumber, formatWeightShort, treatmentDiversionFactor } from '@/utils/format';
import { ColumnCheck, missingColumns, onlyExisting } from '@/utils/columns';
import { TreatmentType } from '@/types';

/**
 * Categorias de tratamento.
 *
 * Lista fechada: escrita à mão, "Tratamento Térmico" e "tratamento termico"
 * viram duas categorias e a coluna deixa de agrupar. Uma categoria já gravada
 * fora da lista continua selecionável.
 */
export const TREATMENT_CATEGORIES = [
  'Reciclagem',
  'Tratamento Biológico',
  'Tratamento Térmico',
  'Tratamento Físico-Químico',
  'Reutilização',
  'Disposição Final',
  'Outro',
];

/**
 * Ícone e cores de cada categoria.
 *
 * O desenho dá um ícone diferente para cada tratamento, mas não existe coluna
 * de ícone no banco — e inventar um seletor de ícones criaria um campo a mais
 * para manter. A categoria é a informação que de fato agrupa os tratamentos,
 * então é ela que decide o símbolo: dois tratamentos térmicos compartilham a
 * chama porque são, de fato, a mesma família.
 */
const CATEGORY_LOOK: Record<string, { icon: React.ComponentType<any>; bg: string; fg: string }> = {
  'Reciclagem': { icon: Recycle, bg: '#E3F4E4', fg: '#015B26' },
  'Tratamento Biológico': { icon: Sprout, bg: '#E7F5E4', fg: '#2E7D32' },
  'Tratamento Térmico': { icon: Flame, bg: '#FDECE0', fg: '#C2410C' },
  'Tratamento Físico-Químico': { icon: Droplets, bg: '#E2F0F8', fg: '#0E5F80' },
  'Reutilização': { icon: RefreshCw, bg: '#DEF2EC', fg: '#1D6E57' },
  'Disposição Final': { icon: Layers, bg: '#E5EBF7', fg: '#2C4E8C' },
};

const FALLBACK_LOOK = { icon: Package, bg: colors.form.rowTile, fg: colors.form.muted };

export function categoryLook(category?: string | null) {
  return (category && CATEGORY_LOOK[category]) || FALLBACK_LOOK;
}

/** Selo quadrado com o ícone da categoria — na lista e no topo do painel. */
export function TreatmentSeal({ category, size = 30 }: { category?: string | null; size?: number }) {
  const look = categoryLook(category);
  const Icon = look.icon;
  return (
    <View style={[s.seal, { width: size, height: size, borderRadius: size / 3.4, backgroundColor: look.bg }]}>
      <Icon size={size * 0.56} strokeWidth={2} color={look.fg} />
    </View>
  );
}

const STATUS_OPTIONS = [
  { label: 'Ativo', value: 'active' },
  { label: 'Inativo', value: 'inactive' },
];

/** Como o fator de desvio é informado. */
const RULE_OPTIONS = [
  { label: 'Peso integral (100%)', value: 'full' },
  { label: 'Por percentual (%)', value: 'percent' },
];

const TEXT_LIMIT = 500;

/** Campos que só existem depois da migração 0011 — ver o aviso do topo. */
const EXTENDED_COLUMNS = ['category', 'description', 'application', 'notes', 'diversion_factor'];

/** Rótulo de cada campo no histórico — o log guarda o nome da coluna. */
const FIELD_LABELS: Record<string, string> = {
  name: 'Nome do tratamento',
  category: 'Categoria',
  counts_as_diversion: 'Considera desvio de aterro',
  diversion_factor: 'Fator de desvio',
  description: 'Descrição',
  application: 'Aplicação principal',
  notes: 'Observações',
  active: 'Situação',
};

const ACTION_LABELS: Record<string, string> = {
  create_treatment: 'Tratamento cadastrado',
  update_treatment: 'Cadastro alterado',
};

type Tab = 'details' | 'rules' | 'history';

/**
 * Painel lateral de tipo de tratamento: detalhes, regras e histórico.
 *
 * Mesmo desenho dos painéis de cliente, unidade e usuário. A aba Regras não
 * tem campo nenhum: ela lê a configuração da aba Detalhes e diz, em número e
 * em frase, o que essa configuração faz com a taxa de desvio — e com quanto
 * peso ela já mexeu.
 */
export function TreatmentPanel({ treatment, usage, can, onClose, onSaved, actorId }: {
  /** `null` abre em modo de criação. */
  treatment: TreatmentType | null;
  usage?: TreatmentUsage;
  /** A coluna de cada campo existe no banco? (migração 0011) */
  can: ColumnCheck;
  onClose: () => void;
  onSaved: () => void;
  /** Quem está salvando — vai para o histórico. */
  actorId?: string | null;
}) {
  const creating = !treatment;
  const [tab, setTab] = useState<Tab>('details');
  const [name, setName] = useState(treatment?.name ?? '');
  const [category, setCategory] = useState(treatment?.category ?? '');
  const [diverts, setDiverts] = useState(treatment?.counts_as_diversion ?? true);
  const [description, setDescription] = useState(treatment?.description ?? '');
  const [application, setApplication] = useState(treatment?.application ?? '');
  const [notes, setNotes] = useState(treatment?.notes ?? '');
  const [status, setStatus] = useState(treatment?.active === false ? 'inactive' : 'active');
  // Fator: "peso integral" quando não há percentual gravado, que é o
  // comportamento de sempre.
  const [rule, setRule] = useState<'full' | 'percent'>(
    typeof treatment?.diversion_factor === 'number' && treatment.diversion_factor !== 100 ? 'percent' : 'full'
  );
  const [percent, setPercent] = useState(
    typeof treatment?.diversion_factor === 'number' ? String(treatment.diversion_factor) : '100'
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [busyOff, setBusyOff] = useState(false);

  const [history, setHistory] = useState<AuditEntry[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!treatment) return;
    try {
      setHistory(await listTreatmentHistory(treatment.id));
    } catch (e: any) {
      setHistoryError(e?.message ?? 'Falha ao carregar o histórico.');
      setHistory([]);
    }
  }, [treatment]);

  useEffect(() => {
    if (tab === 'history' && history === null) loadHistory();
  }, [tab, history, loadHistory]);

  /** Percentual que será gravado, já validado. */
  const factorValue = (): number | null => {
    if (!diverts) return 0;
    if (rule === 'full') return 100;
    const n = Number(percent.replace(',', '.'));
    return Number.isFinite(n) ? Math.round(n) : null;
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Informe o nome do tratamento.';
    if (diverts && rule === 'percent') {
      const n = factorValue();
      if (n === null || n < 0 || n > 100) e.percent = 'Informe um percentual de 0 a 100.';
    }
    if (description.length > TEXT_LIMIT) e.description = `Máximo de ${TEXT_LIMIT} caracteres.`;
    if (notes.length > TEXT_LIMIT) e.notes = `Máximo de ${TEXT_LIMIT} caracteres.`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const base: Partial<TreatmentType> = {
        ...(creating ? {} : { id: treatment!.id }),
        name: name.trim(),
        counts_as_diversion: diverts,
        active: status === 'active',
      };
      // Cada campo entra no envio só se a coluna dele existir: uma coluna
      // inexistente faria o banco recusar a gravação inteira, inclusive os
      // campos que existem.
      const patch: Partial<TreatmentType> = {
        ...base,
        ...onlyExisting({
          category: category || null,
          description: description.trim() || null,
          application: application.trim() || null,
          notes: notes.trim() || null,
          diversion_factor: factorValue(),
        }, can),
      };
      await saveTreatment(patch, { id: actorId, previous: treatment });
      onSaved();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao salvar tratamento.');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    setBusyOff(true);
    try {
      await setTreatmentActive(treatment!.id, false);
      setConfirmOff(false);
      onSaved();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao desativar tratamento.');
    } finally {
      setBusyOff(false);
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ComponentType<any> }[] = [
    { key: 'details', label: 'Detalhes', icon: Info },
    { key: 'rules', label: 'Regras', icon: Settings },
    { key: 'history', label: 'Histórico', icon: Clock },
  ];

  // Quais campos estão sem coluna — o aviso do topo fala em número.
  const locked = missingColumns(EXTENDED_COLUMNS, can);

  const categoryOptions = [
    { label: 'Não informada', value: '' },
    ...(category && !TREATMENT_CATEGORIES.includes(category) ? [{ label: category, value: category }] : []),
    ...TREATMENT_CATEGORIES.map((c) => ({ label: c, value: c })),
  ];

  // O que vale hoje, como a conta do painel enxerga.
  const savedFactor = treatment ? treatmentDiversionFactor(treatment) : (diverts ? 1 : 0);
  const pendingFactor = (factorValue() ?? 0) / 100;

  return (
    <View style={s.panel}>
      {/* ── Identificação ──────────────────────────────────────────── */}
      <View style={s.head}>
        <View style={s.headRow}>
          <TreatmentSeal category={creating ? null : treatment!.category} size={56} />
          <View style={s.grow}>
            <View style={s.nameRow}>
              <Text style={s.name} numberOfLines={2}>{creating ? 'Novo tratamento' : treatment!.name}</Text>
              {!creating ? (
                <View style={[s.statusPill, { backgroundColor: treatment!.active ? '#EEF8F1' : colors.surfaceSunken }]}>
                  <View style={[s.dot, { backgroundColor: treatment!.active ? colors.success : colors.textMuted }]} />
                  <Text style={[s.statusText, { color: treatment!.active ? colors.success : colors.textMuted }]}>
                    {treatment!.active ? 'Ativo' : 'Inativo'}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={s.sub} numberOfLines={3}>
              {creating
                ? 'Defina como o tratamento entra na taxa de desvio'
                : treatment!.description || treatment!.category || 'Sem descrição cadastrada'}
            </Text>
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
                  {' '}Aplique a migração 0011 para liberá-los; o que está editável já é gravado normalmente.
                </Text>
              </View>
            ) : null}

            <Input size="form" label="Nome do tratamento" required value={name} onChangeText={setName} error={errors.name} />

            <View style={s.row}>
              <View style={s.cell}>
                <Select
                  size="form"
                  label="Categoria"
                  options={categoryOptions}
                  value={category}
                  onChange={setCategory}
                  disabled={!can('category')}
                />
              </View>
              {/* Mais largo que a categoria: o rótulo do interruptor é a frase
                  mais comprida do formulário e quebrado em duas linhas ele
                  desalinharia o interruptor do campo ao lado. */}
              <View style={s.cellWide}>
                <Text style={s.switchLabel}>Considera desvio de aterro</Text>
                <View style={s.switchRow}>
                  <Switch
                    value={diverts}
                    onValueChange={setDiverts}
                    trackColor={{ false: colors.form.stepIdle, true: '#22A45D' }}
                    thumbColor={colors.white}
                    accessibilityLabel="Considera desvio de aterro"
                  />
                  <Text style={s.switchText}>{diverts ? 'Sim, considera' : 'Não considera'}</Text>
                </View>
              </View>
            </View>

            <View style={s.countBlock}>
              <Input
                size="form"
                label="Descrição"
                placeholder={can('description') ? 'O que este tratamento faz com o resíduo...' : 'Após a migração 0011'}
                value={description}
                onChangeText={(v) => setDescription(v.slice(0, TEXT_LIMIT))}
                editable={can('description')}
                multiline
                numberOfLines={3}
                style={s.textArea}
                error={errors.description}
              />
              {can('description') ? <Text style={s.counter}>{description.length}/{TEXT_LIMIT}</Text> : null}
            </View>

            <View style={s.row}>
              <View style={s.cell}>
                <Input
                  size="form"
                  label="Aplicação principal"
                  value={application}
                  onChangeText={setApplication}
                  editable={can('application')}
                  placeholder={can('application') ? 'Resíduos recicláveis' : 'Após a migração 0011'}
                  hint="Ex.: papel, plástico, metal, vidro, etc."
                />
              </View>
              <View style={s.cell}>
                <Select
                  size="form"
                  label="Fator / Regra de cálculo"
                  options={RULE_OPTIONS}
                  value={rule}
                  onChange={(v) => setRule(v as 'full' | 'percent')}
                  disabled={!can('diversion_factor') || !diverts}
                />
                {rule === 'percent' && diverts ? (
                  <Input
                    size="form"
                    value={percent}
                    onChangeText={setPercent}
                    editable={can('diversion_factor')}
                    keyboardType="numeric"
                    error={errors.percent}
                    hint="Percentual do peso que conta como desvio."
                  />
                ) : null}
              </View>
            </View>

            {/* O fator é o único campo desta tela com efeito em número; dizer
                qual é esse efeito evita que ele seja mexido no escuro. */}
            <View style={s.factorNote}>
              <Info size={15} strokeWidth={2} color={colors.form.infoText} />
              <Text style={s.factorNoteText}>
                {diverts
                  ? `Cada quilo registrado com este tratamento conta ${Math.round(pendingFactor * 100)}% como desvio de aterro.`
                  : 'Nada do peso registrado com este tratamento conta como desvio de aterro.'}
              </Text>
            </View>

            <View style={s.row}>
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
              <View style={[s.cell, s.countBlock]}>
                <Input
                  size="form"
                  label="Observações (opcional)"
                  placeholder={can('notes') ? 'Anote algo relevante...' : 'Após a migração 0011'}
                  value={notes}
                  onChangeText={(v) => setNotes(v.slice(0, TEXT_LIMIT))}
                  editable={can('notes')}
                  multiline
                  numberOfLines={2}
                  style={s.textAreaShort}
                  error={errors.notes}
                />
                {can('notes') ? <Text style={s.counter}>{notes.length}/{TEXT_LIMIT}</Text> : null}
              </View>
            </View>
          </>
        ) : null}

        {tab === 'rules' && !creating ? (
          <View>
            <Text style={s.blockTitle}>O que esta configuração faz</Text>
            <Text style={s.blockHint}>
              Lido do cadastro ao lado, não de uma lista à parte: é a mesma regra que o painel e os
              relatórios aplicam ao calcular a taxa de desvio de aterro.
            </Text>

            <View style={s.ruleRow}>
              <Text style={s.ruleLabel}>Conta como desvio</Text>
              <Text style={s.ruleValue}>
                {savedFactor === 0
                  ? 'Não'
                  : savedFactor === 1
                    ? 'Sim, o peso inteiro'
                    : `Sim, ${Math.round(savedFactor * 100)}% do peso`}
              </Text>
            </View>
            <View style={s.ruleRow}>
              <Text style={s.ruleLabel}>Pesagens com este tratamento</Text>
              <Text style={s.ruleValue}>{formatNumber(usage?.weighings ?? 0)}</Text>
            </View>
            <View style={s.ruleRow}>
              <Text style={s.ruleLabel}>Peso acumulado</Text>
              <Text style={s.ruleValue}>{formatWeightShort(usage?.kg ?? 0)}</Text>
            </View>
            <View style={s.ruleRow}>
              <Text style={s.ruleLabel}>Peso que contou como desvio</Text>
              <Text style={s.ruleValue}>{formatWeightShort((usage?.kg ?? 0) * savedFactor)}</Text>
            </View>
            <View style={[s.ruleRow, s.ruleLast]}>
              <Text style={s.ruleLabel}>Última pesagem</Text>
              <Text style={s.ruleValue}>{usage?.last ? formatDateTime(usage.last) : 'Nenhuma'}</Text>
            </View>

            {treatment!.active ? null : (
              <Text style={s.blockHint}>
                Inativo, o tratamento não aparece na escolha de novas pesagens. As pesagens já
                registradas com ele continuam contando na taxa de desvio.
              </Text>
            )}
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
                  ...(can('updated_at') && treatment!.updated_at && history.length === 0
                    ? [{ label: 'Última alteração no cadastro', date: formatDateTime(treatment!.updated_at), detail: null }]
                    : []),
                  { label: 'Tratamento cadastrado', date: formatDateTime(treatment!.created_at), detail: null },
                ]}
              />
            )}
          </View>
        ) : null}
      </ScrollView>

      {/* ── Ações ──────────────────────────────────────────────────── */}
      <View style={s.actions}>
        {!creating && treatment!.active ? (
          <View style={s.cell}>
            <Button
              // "Desativar tratamento" quebra em duas linhas na largura do
              // painel; o nome do tratamento está no topo, e a confirmação
              // repete o que sai do ar.
              title="Desativar"
              variant="dangerOutline"
              iconComponent={Trash}
              onPress={() => setConfirmOff(true)}
              style={s.dangerButton}
            />
          </View>
        ) : null}
        <View style={s.cell}>
          <Button
            title={creating ? 'Criar tratamento' : 'Salvar alterações'}
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
        title="Desativar tratamento?"
        message={`${treatment?.name} deixa de aparecer na escolha de novas pesagens. As ${formatNumber(usage?.weighings ?? 0)} pesagens já registradas com ele continuam contando na taxa de desvio.`}
        confirmLabel="Desativar"
        destructive
        loading={busyOff}
        onConfirm={deactivate}
        onCancel={() => setConfirmOff(false)}
      />
    </View>
  );
}

/** Quais campos a alteração mexeu. */
function changedFields(entry: AuditEntry): string | null {
  const keys = Object.keys(entry.new_data ?? {}).filter((k) => {
    if (!entry.old_data) return true;
    return JSON.stringify((entry.old_data as any)[k] ?? null) !== JSON.stringify((entry.new_data as any)[k] ?? null);
  });
  if (keys.length === 0) return null;
  return keys.map((k) => FIELD_LABELS[k] ?? k).join(', ');
}

const s = StyleSheet.create({
  panel: { flex: 1, backgroundColor: colors.surface },
  grow: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', gap: 16 },
  cell: { flex: 1, minWidth: 0 },
  cellWide: { flex: 1.3, minWidth: 0 },

  seal: { alignItems: 'center', justifyContent: 'center' },

  head: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 18 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  name: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.3, flexShrink: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  statusText: { fontSize: 12.5, fontWeight: '700' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  sub: { fontSize: 13.5, lineHeight: 19, color: colors.form.muted, marginTop: 4 },
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

  // O interruptor ocupa o lugar de um campo, e por isso repete o rótulo e a
  // altura dos campos ao lado.
  switchLabel: { fontSize: 16, fontWeight: '500', color: colors.form.label, marginBottom: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 50 },
  switchText: { fontSize: 14.5, color: colors.text, fontWeight: '600' },

  textArea: { height: 88, paddingTop: 12, textAlignVertical: 'top' },
  textAreaShort: { height: 74, paddingTop: 12, textAlignVertical: 'top' },
  countBlock: { position: 'relative' },
  counter: { position: 'absolute', right: 12, bottom: 30, fontSize: 12, color: colors.form.soft },

  factorNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: colors.form.infoBg,
    borderWidth: 1, borderColor: colors.form.infoBorder,
    borderRadius: 10, padding: 12, marginBottom: 20,
  },
  factorNoteText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: colors.form.infoText },

  blockTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  blockHint: { fontSize: 13.5, lineHeight: 19, color: colors.form.muted, marginTop: 4, marginBottom: 18 },
  historyError: { fontSize: 13, color: colors.danger, marginBottom: 12 },

  ruleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.form.divider,
  },
  ruleLast: { borderBottomWidth: 0 },
  ruleLabel: { fontSize: 13.5, color: colors.form.muted, flexShrink: 1 },
  ruleValue: { fontSize: 14.5, fontWeight: '700', color: colors.text, textAlign: 'right' },

  actions: {
    flexDirection: 'row', gap: 16,
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 22,
    borderTopWidth: 1, borderTopColor: colors.form.divider,
  },
  dangerButton: { minHeight: 50, borderRadius: 10 },
  saveButton: { minHeight: 50, borderRadius: 10 },
});
