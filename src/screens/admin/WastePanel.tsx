import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import BrickWall from 'lucide-react-native/icons/brick-wall';
import Check from 'lucide-react-native/icons/check';
import Clock from 'lucide-react-native/icons/clock';
import FileText from 'lucide-react-native/icons/file-text';
import Monitor from 'lucide-react-native/icons/monitor';
import Package from 'lucide-react-native/icons/package';
import Recycle from 'lucide-react-native/icons/recycle';
import Shield from 'lucide-react-native/icons/shield';
import Sprout from 'lucide-react-native/icons/sprout';
import Trash from 'lucide-react-native/icons/trash';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import User from 'lucide-react-native/icons/user';
import X from 'lucide-react-native/icons/x';
import { Button, ConfirmModal, Input, Loading, Select } from '@/components';
import { Timeline } from '@/components/Operations';
import {
  AuditEntry, listWasteTypeHistory, saveWasteType, setWasteTypeActive, WasteUsage,
} from '@/services/masters';
import { colors, radius, transition } from '@/theme';
import { showAlert } from '@/utils/alert';
import { formatDate, formatDateTime, formatNumber, formatWeightShort } from '@/utils/format';
import { ColumnCheck, missingColumns, onlyExisting } from '@/utils/columns';
import { Recipient, TreatmentType, WasteType } from '@/types';

/**
 * Categorias de resíduo.
 *
 * Lista fechada: escrita à mão, "Eletroeletrônico" e "eletroeletronico" viram
 * duas categorias e a coluna deixa de agrupar. Uma categoria já gravada fora
 * da lista continua selecionável.
 */
export const WASTE_CATEGORIES = [
  'Reciclável',
  'Orgânico',
  'Perigoso',
  'Eletroeletrônico',
  'Construção Civil',
  'Rejeito',
  'Outro',
];

/** Classes da NBR 10004 — a norma que classifica resíduos sólidos. */
export const WASTE_CLASSES = ['Classe I', 'Classe II A', 'Classe II B'];

const CATEGORY_ICON: Record<string, React.ComponentType<any>> = {
  'Reciclável': Recycle,
  'Orgânico': Sprout,
  'Perigoso': TriangleAlert,
  'Eletroeletrônico': Monitor,
  'Construção Civil': BrickWall,
  'Rejeito': Trash,
};

/** Cor de reserva quando o resíduo não tem cor cadastrada. */
const DEFAULT_COLOR = '#5E7D6A';

/**
 * Selo do resíduo: glifo da categoria, cor do cadastro.
 *
 * O desenho dá um ícone diferente para cada resíduo, mas não existe coluna de
 * ícone — já existe, porém, a cor, que o painel e os gráficos usam. Então a
 * cor vem do cadastro (e por isso dois recicláveis podem ter tons diferentes)
 * e o glifo vem da categoria, que é o que de fato agrupa.
 */
export function WasteSeal({ waste, size = 32 }: { waste: Pick<WasteType, 'category' | 'color'>; size?: number }) {
  const Icon = (waste.category && CATEGORY_ICON[waste.category]) || Package;
  const color = waste.color || DEFAULT_COLOR;
  return (
    <View style={[s.seal, { width: size, height: size, borderRadius: size / 3.4, backgroundColor: color + '22' }]}>
      <Icon size={size * 0.55} strokeWidth={2} color={color} />
    </View>
  );
}

const STATUS_OPTIONS = [
  { label: 'Ativo', value: 'active' },
  { label: 'Inativo', value: 'inactive' },
];

const HAZARD_OPTIONS = [
  { label: 'Não perigoso', value: 'no' },
  { label: 'Perigoso', value: 'yes' },
];

const TEXT_LIMIT = 500;

/** Campos que só existem depois da migração 0012 — ver o aviso do topo. */
const EXTENDED_COLUMNS = [
  'code', 'category', 'waste_class', 'description', 'default_treatment_id',
  'suggested_recipient_id', 'is_hazardous', 'is_divertible', 'notes',
];

/** Rótulo de cada campo no histórico — o log guarda o nome da coluna. */
const FIELD_LABELS: Record<string, string> = {
  name: 'Nome do resíduo',
  code: 'Código',
  category: 'Categoria',
  waste_class: 'Classe',
  description: 'Descrição',
  default_treatment_id: 'Tratamento padrão',
  suggested_recipient_id: 'Destinatário sugerido',
  is_hazardous: 'Periculosidade',
  is_divertible: 'Potencial de desvio',
  color: 'Cor',
  notes: 'Observações',
  active: 'Situação',
};

const ACTION_LABELS: Record<string, string> = {
  create_waste: 'Resíduo cadastrado',
  update_waste: 'Cadastro alterado',
};

type Tab = 'details' | 'rules' | 'history';

/**
 * Painel lateral de tipo de resíduo: detalhes, regras e histórico.
 *
 * Mesmo desenho dos demais painéis de cadastro. A aba Regras reúne o que este
 * resíduo leva para dentro de uma pesagem — o tratamento e o destinatário que
 * ele sugere — e a marca de potencial de desvio, que é a única configuração
 * daqui com efeito em indicador.
 */
export function WastePanel({ waste, treatments, recipients, usage, can, onClose, onSaved, actorId }: {
  /** `null` abre em modo de criação. */
  waste: WasteType | null;
  treatments: TreatmentType[];
  recipients: Recipient[];
  usage?: WasteUsage;
  /** A coluna de cada campo existe no banco? (migração 0012) */
  can: ColumnCheck;
  onClose: () => void;
  onSaved: () => void;
  /** Quem está salvando — vai para o histórico. */
  actorId?: string | null;
}) {
  const creating = !waste;
  const [tab, setTab] = useState<Tab>('details');
  const [name, setName] = useState(waste?.name ?? '');
  const [code, setCode] = useState(waste?.code ?? '');
  const [category, setCategory] = useState(waste?.category ?? '');
  const [wasteClass, setWasteClass] = useState(waste?.waste_class ?? '');
  const [description, setDescription] = useState(waste?.description ?? '');
  const [treatmentId, setTreatmentId] = useState(waste?.default_treatment_id ?? '');
  const [recipientId, setRecipientId] = useState(waste?.suggested_recipient_id ?? '');
  const [hazard, setHazard] = useState(waste?.is_hazardous ? 'yes' : 'no');
  const [divertible, setDivertible] = useState(waste?.is_divertible ?? false);
  const [notes, setNotes] = useState(waste?.notes ?? '');
  const [status, setStatus] = useState(waste?.active === false ? 'inactive' : 'active');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [busyOff, setBusyOff] = useState(false);

  const [history, setHistory] = useState<AuditEntry[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!waste) return;
    try {
      setHistory(await listWasteTypeHistory(waste.id));
    } catch (e: any) {
      setHistoryError(e?.message ?? 'Falha ao carregar o histórico.');
      setHistory([]);
    }
  }, [waste]);

  useEffect(() => {
    if (tab === 'history' && history === null) loadHistory();
  }, [tab, history, loadHistory]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Informe o nome do resíduo.';
    if (description.length > TEXT_LIMIT) e.description = `Máximo de ${TEXT_LIMIT} caracteres.`;
    if (notes.length > TEXT_LIMIT) e.notes = `Máximo de ${TEXT_LIMIT} caracteres.`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const base: Partial<WasteType> = {
        ...(creating ? {} : { id: waste!.id }),
        name: name.trim(),
        active: status === 'active',
      };
      // Cada campo entra no envio só se a coluna dele existir: uma coluna
      // inexistente faria o banco recusar a gravação inteira, inclusive os
      // campos que existem. `is_divertible` está entre esses — ele também
      // nunca existiu no banco antes da 0012.
      const patch: Partial<WasteType> = {
        ...base,
        ...onlyExisting({
          code: code.trim() || null,
          category: category || null,
          waste_class: wasteClass || null,
          description: description.trim() || null,
          default_treatment_id: treatmentId || null,
          suggested_recipient_id: recipientId || null,
          is_hazardous: hazard === 'yes',
          is_divertible: divertible,
          notes: notes.trim() || null,
        }, can),
      };
      await saveWasteType(patch, { id: actorId, previous: waste });
      onSaved();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao salvar tipo de resíduo.');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    setBusyOff(true);
    try {
      await setWasteTypeActive(waste!.id, false);
      setConfirmOff(false);
      onSaved();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao desativar tipo de resíduo.');
    } finally {
      setBusyOff(false);
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ComponentType<any> }[] = [
    { key: 'details', label: 'Detalhes', icon: User },
    { key: 'rules', label: 'Regras', icon: FileText },
    { key: 'history', label: 'Histórico', icon: Clock },
  ];

  // Quais campos estão sem coluna — o aviso do topo fala em número.
  const locked = missingColumns(EXTENDED_COLUMNS, can);

  const categoryOptions = [
    { label: 'Não informada', value: '' },
    ...(category && !WASTE_CATEGORIES.includes(category) ? [{ label: category, value: category }] : []),
    ...WASTE_CATEGORIES.map((c) => ({ label: c, value: c })),
  ];
  const classOptions = [
    { label: 'Não informada', value: '' },
    ...WASTE_CLASSES.map((c) => ({ label: c, value: c })),
  ];
  // Só cadastros ativos entram na escolha; um tratamento desativado não deve
  // ser sugerido para pesagem nova. O já gravado continua aparecendo.
  const treatmentOptions = [
    { label: 'Nenhum', value: '' },
    ...treatments
      .filter((t) => t.active || t.id === treatmentId)
      .map((t) => ({ label: t.name, value: t.id })),
  ];
  const recipientOptions = [
    { label: 'Nenhum', value: '' },
    ...recipients
      .filter((r) => r.active || r.id === recipientId)
      .map((r) => ({ label: r.name, value: r.id })),
  ];

  const treatment = treatments.find((t) => t.id === treatmentId);
  const recipient = recipients.find((r) => r.id === recipientId);

  return (
    <View style={s.panel}>
      {/* ── Identificação ──────────────────────────────────────────── */}
      <View style={s.head}>
        <View style={s.headRow}>
          <WasteSeal
            waste={creating ? { category: null, color: null } : waste!}
            size={56}
          />
          <View style={s.grow}>
            <View style={s.nameRow}>
              <Text style={s.name} numberOfLines={2}>{creating ? 'Novo tipo de resíduo' : waste!.name}</Text>
              {!creating ? (
                <View style={[s.statusPill, { backgroundColor: waste!.active ? '#EEF8F1' : colors.surfaceSunken }]}>
                  <View style={[s.dot, { backgroundColor: waste!.active ? colors.success : colors.textMuted }]} />
                  <Text style={[s.statusText, { color: waste!.active ? colors.success : colors.textMuted }]}>
                    {waste!.active ? 'Ativo' : 'Inativo'}
                  </Text>
                </View>
              ) : null}
            </View>
            {creating ? (
              <Text style={s.sub}>Classifique o resíduo e defina o que ele sugere</Text>
            ) : (
              <>
                {waste!.code ? <Text style={s.sub}>Código: {waste!.code}</Text> : null}
                <Text style={s.since}>Cadastrado em {formatDate(waste!.created_at)}</Text>
              </>
            )}
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
                  {' '}Aplique a migração 0012 para liberá-los; o que está editável já é gravado normalmente.
                </Text>
              </View>
            ) : null}

            <View style={s.row}>
              <View style={s.cellWide}>
                <Input size="form" label="Nome do resíduo" required value={name} onChangeText={setName} error={errors.name} />
              </View>
              <View style={s.cell}>
                <Input
                  size="form"
                  label="Código"
                  value={code}
                  onChangeText={setCode}
                  editable={can('code')}
                  placeholder={can('code') ? 'RES-001' : 'Após a migração 0012'}
                />
              </View>
            </View>

            <View style={s.row}>
              <View style={s.cell}>
                <Select size="form" label="Categoria" options={categoryOptions} value={category}
                  onChange={setCategory} disabled={!can('category')} />
              </View>
              <View style={s.cell}>
                <Select size="form" label="Classe (NBR 10004)" options={classOptions} value={wasteClass}
                  onChange={setWasteClass} disabled={!can('waste_class')} />
              </View>
            </View>

            <View style={s.countBlock}>
              <Input
                size="form"
                label="Descrição"
                placeholder={can('description') ? 'O que este tipo de resíduo abrange...' : 'Após a migração 0012'}
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
                <Select
                  size="form"
                  label="Tratamento padrão"
                  leftIconComponent={Recycle}
                  options={treatmentOptions}
                  value={treatmentId}
                  onChange={setTreatmentId}
                  disabled={!can('default_treatment_id')}
                />
              </View>
              <View style={s.cell}>
                <Select
                  size="form"
                  label="Destinatário sugerido"
                  leftIconComponent={User}
                  options={recipientOptions}
                  value={recipientId}
                  onChange={setRecipientId}
                  disabled={!can('suggested_recipient_id')}
                />
              </View>
            </View>

            <View style={s.row}>
              {/* Mais larga que a situação: com o ícone do escudo à esquerda,
                  "Não perigoso" não cabe em meia largura do painel. */}
              <View style={s.cellHazard}>
                <Select
                  size="form"
                  label="Periculosidade"
                  leftIconComponent={hazard === 'yes' ? TriangleAlert : Shield}
                  leftIconColor={hazard === 'yes' ? colors.danger : colors.form.tileIcon}
                  options={HAZARD_OPTIONS}
                  value={hazard}
                  onChange={setHazard}
                  disabled={!can('is_hazardous')}
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

            <View style={s.countBlock}>
              <Input
                size="form"
                label="Observações (opcional)"
                placeholder={can('notes') ? 'Adicione uma observação sobre este tipo de resíduo...' : 'Após a migração 0012'}
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
          </>
        ) : null}

        {tab === 'rules' && !creating ? (
          <View>
            <Text style={s.blockTitle}>O que este resíduo leva para a pesagem</Text>
            <Text style={s.blockHint}>
              O tratamento e o destinatário abaixo são sugestões de cadastro: quem registra a
              pesagem pode trocá-los. Mudá-los aqui não altera pesagem já registrada.
            </Text>

            <View style={s.ruleRow}>
              <Text style={s.ruleLabel}>Tratamento padrão</Text>
              <Text style={s.ruleValue}>{treatment?.name ?? 'Nenhum'}</Text>
            </View>
            <View style={s.ruleRow}>
              <Text style={s.ruleLabel}>Destinatário sugerido</Text>
              <Text style={s.ruleValue}>{recipient?.name ?? 'Nenhum'}</Text>
            </View>
            <View style={[s.ruleRow, s.ruleLast]}>
              <Text style={s.ruleLabel}>Classe e periculosidade</Text>
              <Text style={s.ruleValue}>
                {[waste!.waste_class, waste!.is_hazardous ? 'perigoso' : 'não perigoso']
                  .filter(Boolean).join(' · ')}
              </Text>
            </View>

            {/* `is_divertible` não aparece no desenho, mas é a única marca
                daqui que muda indicador: sem ela, o "desvio perdido" do painel
                não tem como saber o que poderia ter sido desviado. */}
            <View style={s.divertBlock}>
              <View style={s.divertRow}>
                <Switch
                  value={divertible}
                  onValueChange={setDivertible}
                  disabled={!can('is_divertible')}
                  trackColor={{ false: colors.form.stepIdle, true: '#22A45D' }}
                  thumbColor={colors.white}
                  accessibilityLabel="Tem potencial de ser desviado do aterro"
                />
                <View style={s.grow}>
                  <Text style={s.divertLabel}>Tem potencial de ser desviado do aterro</Text>
                  <Text style={s.divertHint}>
                    {divertible
                      ? 'Quando uma pesagem deste resíduo vai para aterro, ela entra no indicador de desvio perdido do painel.'
                      : 'Pesagens deste resíduo que vão para aterro não são contadas como desvio perdido.'}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={s.blockTitle}>Uso em pesagens</Text>
            <View style={s.ruleRow}>
              <Text style={s.ruleLabel}>Pesagens com este resíduo</Text>
              <Text style={s.ruleValue}>{formatNumber(usage?.weighings ?? 0)}</Text>
            </View>
            <View style={s.ruleRow}>
              <Text style={s.ruleLabel}>Peso acumulado</Text>
              <Text style={s.ruleValue}>{formatWeightShort(usage?.kg ?? 0)}</Text>
            </View>
            <View style={[s.ruleRow, s.ruleLast]}>
              <Text style={s.ruleLabel}>Última pesagem</Text>
              <Text style={s.ruleValue}>{usage?.last ? formatDateTime(usage.last) : 'Nenhuma'}</Text>
            </View>
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
                  ...(can('updated_at') && waste!.updated_at && history.length === 0
                    ? [{ label: 'Última alteração no cadastro', date: formatDateTime(waste!.updated_at), detail: null }]
                    : []),
                  { label: 'Resíduo cadastrado', date: formatDateTime(waste!.created_at), detail: null },
                ]}
              />
            )}
          </View>
        ) : null}
      </ScrollView>

      {/* ── Ações ──────────────────────────────────────────────────── */}
      <View style={s.actions}>
        {!creating && waste!.active ? (
          <View style={s.cell}>
            <Button
              title="Desativar tipo"
              variant="dangerOutline"
              iconComponent={Trash}
              onPress={() => setConfirmOff(true)}
              style={s.dangerButton}
            />
          </View>
        ) : null}
        <View style={s.cell}>
          <Button
            title={creating ? 'Criar resíduo' : 'Salvar alterações'}
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
        title="Desativar tipo de resíduo?"
        message={`${waste?.name} deixa de aparecer na escolha de novas pesagens. As ${formatNumber(usage?.weighings ?? 0)} pesagens já registradas com ele continuam nos relatórios.`}
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
  cellWide: { flex: 1.6, minWidth: 0 },
  cellHazard: { flex: 1.35, minWidth: 0 },

  seal: { alignItems: 'center', justifyContent: 'center' },

  head: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 18 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
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

  textArea: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
  textAreaShort: { height: 70, paddingTop: 12, textAlignVertical: 'top' },
  countBlock: { position: 'relative' },
  counter: { position: 'absolute', right: 12, bottom: 30, fontSize: 12, color: colors.form.soft },

  blockTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  blockHint: { fontSize: 13.5, lineHeight: 19, color: colors.form.muted, marginTop: 4, marginBottom: 14 },
  historyError: { fontSize: 13, color: colors.danger, marginBottom: 12 },

  ruleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.form.divider,
  },
  ruleLast: { borderBottomWidth: 0 },
  ruleLabel: { fontSize: 13.5, color: colors.form.muted, flexShrink: 1 },
  ruleValue: { fontSize: 14.5, fontWeight: '700', color: colors.text, textAlign: 'right', flexShrink: 1 },

  divertBlock: {
    backgroundColor: colors.form.safeBg,
    borderWidth: 1, borderColor: colors.form.safeBorder,
    borderRadius: 10, padding: 14, marginVertical: 18,
  },
  divertRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  divertLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  divertHint: { fontSize: 12.5, lineHeight: 18, color: colors.form.infoText, marginTop: 4 },

  actions: {
    flexDirection: 'row', gap: 16,
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 22,
    borderTopWidth: 1, borderTopColor: colors.form.divider,
  },
  dangerButton: { minHeight: 50, borderRadius: 10 },
  saveButton: { minHeight: 50, borderRadius: 10 },
});
