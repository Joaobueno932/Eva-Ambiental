import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import CircleQuestionMark from 'lucide-react-native/icons/circle-question-mark';
import Database from 'lucide-react-native/icons/database';
import Download from 'lucide-react-native/icons/download';
import FileText from 'lucide-react-native/icons/file-text';
import Funnel from 'lucide-react-native/icons/funnel';
import List from 'lucide-react-native/icons/list';
import Plus from 'lucide-react-native/icons/plus';
import RotateCcw from 'lucide-react-native/icons/rotate-ccw';
import Weight from 'lucide-react-native/icons/weight';
import {
  Button,
  Card,
  DateRangePicker,
  EmptyState,
  Header,
  LatestWeighingsTable,
  Loading,
  Select,
  Topbar,
} from '@/components';
import { CardHead, PageHeader } from '@/components/FormKit';
import { MetricStrip } from '@/components/Operations';
import { WeighingCard } from '@/components/WeighingCard';
import { useAuth } from '@/contexts/AuthContext';
import { useIsDesktop, useIsWide } from '@/hooks/useLayout';
import { PERIOD_OPTIONS, useOperationScope } from '@/hooks/useOperationScope';
import { usePermissions } from '@/hooks/usePermissions';
import type { MainTabsParamList } from '@/navigation/types';
import { colors, elevation, gradient, radius, spacing, transition } from '@/theme';
import { showAlert } from '@/utils/alert';
import { classifyDiversion, formatDate, formatNumber, formatPercent, formatWeight, roleLabel } from '@/utils/format';

/** Quantos registros a prévia mostra antes do "Ver todos". */
const PREVIEW_SIZE = 5;

/**
 * Central de relatórios.
 *
 * O painel acompanha a operação; aqui o assunto é o conjunto que vai sair
 * num arquivo. A tela responde três perguntas em ordem: qual o recorte
 * (escopo), quanto ele pesa (indicadores) e o que exatamente vai no arquivo
 * (conjunto e prévia). Por isso os filtros valem na hora, sem "Aplicar": a
 * prévia mudando a cada escolha é o retorno que se procura antes de exportar.
 */
export function ReportsScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabsParamList>>();
  const { canCreateWeighing } = usePermissions();
  const { profile, signOut } = useAuth();
  const isDesktop = useIsDesktop();
  const isWide = useIsWide();
  const {
    records, stats, operations, loading, loadError, refreshing, exporting,
    range, clientName, unitName, hasEntityFilter,
    draftRange, setDraftRange, draftClientId, draftUnitId, setDraftUnitId,
    clientOptions, unitOptions,
    onChangeClient, onChangePeriod, clearFilters,
    load, onRefresh, exportReport, deltaProps,
  } = useOperationScope({ autoApply: true });

  if (loading && !stats) return <Loading message="Carregando relatórios..." />;

  if (loadError) {
    return (
      <View style={styles.container}>
        <Header title="Central de relatórios" />
        <Card>
          <EmptyState icon="cloud-offline-outline" title="Não foi possível carregar os dados" message={loadError} />
          <Button title="Tentar novamente" onPress={load} />
        </Card>
      </View>
    );
  }

  // O arquivo leva os registros não cancelados — rejeitados inclusive —, e a
  // prévia e os totais do conjunto contam exatamente esses.
  const exportable = records.filter((r) => !r.canceled_at);
  const exportWeight = exportable.reduce((sum, r) => sum + Number(r.weight_kg ?? 0), 0);
  const cls = stats ? classifyDiversion(stats.diversionRate) : null;
  const periodRange = `${range.startDate ? formatDate(range.startDate) : '—'} – ${range.endDate ? formatDate(range.endDate) : '—'}`;
  const openWeighings = () => navigation.navigate('Pesagens', { screen: 'WeighingsList' });

  const showHelp = () =>
    showAlert(
      'Central de relatórios',
      'Defina o período, o cliente e a unidade no escopo: indicadores e prévia se atualizam na hora.\n\n' +
        'Os arquivos em PDF, CSV e XLSX levam os registros não cancelados do escopo, inclusive os rejeitados. ' +
        'Os indicadores consideram apenas pesagens pendentes e aprovadas.'
    );

  const headerActions = (
    <View style={styles.headerActions}>
      <Button
        title="Ajuda"
        variant="outline"
        iconComponent={CircleQuestionMark}
        fullWidth={false}
        onPress={showHelp}
        style={styles.headerButton}
      />
      {canCreateWeighing ? (
        <Button
          title="Registrar pesagem"
          variant="cta"
          iconComponent={Plus}
          fullWidth={false}
          onPress={() => navigation.navigate('Pesagens', { screen: 'WeighingForm' })}
          style={styles.headerButton}
        />
      ) : null}
    </View>
  );

  return (
    <View style={[styles.container, isDesktop && gradient(PAGE_TOP, colors.pageBg)]}>
      {isDesktop ? (
        <Topbar
          plain
          crumbs={[
            { label: 'Painel', icon: 'chevron-back', onPress: () => navigation.navigate('Painel') },
            { label: 'Relatórios' },
            { label: 'Central de relatórios' },
          ]}
          userName={profile?.full_name}
          userRole={roleLabel[profile?.role ?? 'viewer']}
          notificationCount={operations.status.pending}
          onNotifications={openWeighings}
          onUser={() => navigation.navigate('Perfil', { screen: 'ProfileHome' })}
          onSignOut={signOut}
        />
      ) : (
        <Header title="Central de relatórios" subtitle="Consolide, analise e exporte os registros" />
      )}

      <ScrollView
        contentContainerStyle={isDesktop ? styles.deskScroll : styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.green]} />}
      >
        {isDesktop ? (
          <PageHeader
            titleSize={33}
            seal={<FileText size={28} strokeWidth={2} color={colors.form.tileIcon} />}
            title="Central de relatórios"
            subtitle="Consolide, analise e exporte os registros da operação ambiental."
            right={headerActions}
          />
        ) : null}

        {/* ── Escopo ─────────────────────────────────────────────────── */}
        <View style={[styles.card, elevation('sm')]}>
          <CardHead
            icon={Funnel}
            title="Escopo da operação"
            description="Defina o período, o cliente e a unidade para gerar o seu relatório."
            right={isDesktop && (hasEntityFilter || range.key !== 'month') ? (
              <Button
                title="Limpar filtros"
                variant="outline"
                iconComponent={RotateCcw}
                fullWidth={false}
                onPress={clearFilters}
                style={styles.headerButton}
              />
            ) : undefined}
          />
          <View style={isDesktop ? styles.filterRow : undefined}>
            <View style={isDesktop ? styles.filterPeriod : undefined}>
              <Select
                label="Período"
                leftIcon="calendar"
                options={PERIOD_OPTIONS}
                value={draftRange.key}
                onChange={onChangePeriod}
              />
            </View>
            <View style={isDesktop ? styles.filterRange : undefined}>
              {/* Datas resolvidas do preset: "Este Mês" não diz onde o mês
                  começa nem termina. */}
              {isDesktop ? <Text style={styles.rangeLabel}> </Text> : null}
              <View style={styles.rangeBox}>
                <Text style={styles.rangeText} numberOfLines={1}>
                  {draftRange.startDate ? formatDate(draftRange.startDate) : '—'} – {draftRange.endDate ? formatDate(draftRange.endDate) : '—'}
                </Text>
              </View>
            </View>
            <View style={isDesktop ? styles.filterCell : undefined}>
              <Select label="Cliente" leftIcon="people" options={clientOptions} value={draftClientId} onChange={onChangeClient} />
            </View>
            <View style={isDesktop ? styles.filterCell : undefined}>
              <Select label="Unidade" leftIcon="location" options={unitOptions} value={draftUnitId} onChange={setDraftUnitId} />
            </View>
          </View>
          {draftRange.key === 'custom' ? (
            <View style={styles.customRange}>
              <DateRangePicker value={draftRange} onChange={setDraftRange} />
            </View>
          ) : null}
          {!isDesktop && (hasEntityFilter || range.key !== 'month') ? (
            <Button title="Limpar filtros" variant="outline" iconComponent={RotateCcw} onPress={clearFilters} />
          ) : null}
        </View>

        {/* ── Indicadores ────────────────────────────────────────────── */}
        <MetricStrip items={[
          {
            label: 'Registros encontrados', value: formatNumber(stats?.totalWeighings ?? 0),
            icon: 'documents-outline', ...deltaProps(stats?.trend?.weighings),
          },
          {
            label: 'Massa total registrada', value: formatWeight(stats?.totalWeight ?? 0),
            icon: 'scale-outline', ...deltaProps(stats?.trend?.weight),
          },
          {
            label: 'Desvio de aterro', value: formatPercent(stats?.diversionRate ?? 0),
            icon: 'leaf-outline', tone: cls?.color, valueTone: cls?.color,
            ...deltaProps(stats?.trend?.diversionPoints, 'points'),
          },
          {
            label: 'Aguardando validação', value: String(operations.status.pending),
            icon: 'hourglass-outline', tone: colors.pendingRing,
            // Fila de validação que cresce não é boa notícia: inverte as cores.
            invertDelta: true, ...deltaProps(stats?.trend?.pending),
          },
        ]} />

        <View style={isWide ? styles.split : undefined}>
          {/* ── Conjunto selecionado ─────────────────────────────────── */}
          <View style={[styles.card, isWide && styles.setCard, elevation('sm')]}>
            <CardHead icon={Database} title="Conjunto selecionado" description="Resumo dos dados que serão exportados." />

            <View style={[styles.scopeBox, !isDesktop && styles.scopeBoxStacked]}>
              <ScopeItem icon="calendar" label="Período" value={periodRange} hint={range.label} wide />
              <View style={isDesktop ? styles.scopeDivider : styles.scopeDividerH} />
              <ScopeItem icon="people" label="Cliente" value={clientName ?? 'Todos os clientes'} />
              <View style={isDesktop ? styles.scopeDivider : styles.scopeDividerH} />
              <ScopeItem icon="location" label="Unidade" value={unitName ?? 'Todas as unidades'} />
            </View>

            <View style={styles.totals}>
              <Total icon={FileText} label="Total de registros para exportação" value={`${formatNumber(exportable.length)} ${exportable.length === 1 ? 'registro' : 'registros'}`} />
              {/* Só faz sentido lado a lado; empilhado viraria um traço solto. */}
              {isDesktop ? <View style={styles.totalDivider} /> : null}
              <Total icon={Weight} label="Massa total (kg)" value={formatWeight(exportWeight)} />
            </View>

            <Text style={styles.exportNote}>
              Serão exportados apenas os registros não cancelados, incluindo rejeitados. Indicadores: apenas pendentes e aprovados.
            </Text>

            <View style={styles.exportRow}>
              {(['pdf', 'csv', 'xlsx'] as const).map((type) => (
                <View key={type} style={[styles.exportCell, !isDesktop && styles.exportCellFull]}>
                  <Button
                    title={`Exportar ${type.toUpperCase()}`}
                    variant={type === 'pdf' ? 'deep' : 'outline'}
                    iconComponent={Download}
                    loading={exporting}
                    disabled={!stats || exportable.length === 0}
                    onPress={() => exportReport(type)}
                    style={styles.exportButton}
                  />
                </View>
              ))}
            </View>
          </View>

          {/* ── Prévia dos registros ─────────────────────────────────── */}
          <View style={[styles.card, isWide && styles.previewCard, elevation('sm')]}>
            <CardHead
              icon={List}
              title="Prévia dos registros"
              description="Visualize os registros que serão incluídos na exportação."
              right={isDesktop ? (
                <Button
                  title={`Ver todos (${exportable.length})`}
                  variant="outline"
                  iconComponent={ArrowRight}
                  iconRight
                  fullWidth={false}
                  onPress={openWeighings}
                  style={styles.headerButton}
                />
              ) : undefined}
            />
            {exportable.length === 0 ? (
              <EmptyState icon="document-outline" title="Nenhum registro no escopo" message="Ajuste o período, o cliente ou a unidade." />
            ) : isDesktop ? (
              <LatestWeighingsTable
                compact
                items={exportable.slice(0, PREVIEW_SIZE)}
                onOpen={(id) => navigation.navigate('Pesagens', { screen: 'WeighingDetails', params: { id } })}
              />
            ) : (
              exportable.slice(0, PREVIEW_SIZE).map((item) => (
                <WeighingCard
                  key={item.id}
                  item={item}
                  onPress={() => navigation.navigate('Pesagens', { screen: 'WeighingDetails', params: { id: item.id } })}
                />
              ))
            )}
            {exportable.length > 0 ? (
              <View style={styles.previewFooter}>
                <Text style={styles.previewCount}>
                  Mostrando {Math.min(PREVIEW_SIZE, exportable.length)} de {exportable.length} {exportable.length === 1 ? 'registro' : 'registros'}
                </Text>
                {!isDesktop ? (
                  <Pressable onPress={openWeighings} style={({ hovered }: any) => [styles.seeAll, transition(), hovered && styles.seeAllHover]}>
                    <Text style={styles.seeAllText}>Ver todos</Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.brand[700]} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/** Uma coluna da caixa de escopo: ícone e rótulo pequenos, valor em destaque. */
function ScopeItem({ icon, label, value, hint, wide }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  hint?: string;
  /** O período é o valor mais longo ("01/09/2026 – 30/09/2026") e não deve quebrar. */
  wide?: boolean;
}) {
  return (
    <View style={[styles.scopeItem, wide && { flex: 1.45 }]}>
      <View style={styles.scopeLabelRow}>
        <Ionicons name={icon} size={14} color={colors.form.tileIcon} />
        <Text style={styles.scopeLabel}>{label}</Text>
      </View>
      <Text style={styles.scopeValue} numberOfLines={2}>{value}</Text>
      {hint ? <Text style={styles.scopeHint}>{hint}</Text> : null}
    </View>
  );
}

/** Total do conjunto: selo neutro, legenda e o número grande. */
function Total({ icon: Icon, label, value }: {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.total}>
      <View style={styles.totalSeal}>
        <Icon size={22} strokeWidth={2} color={colors.form.tileIcon} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.totalLabel}>{label}</Text>
        <Text style={styles.totalValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

/** Topo um tom mais claro que o fundo, sem faixa nem linha — como no formulário. */
const PAGE_TOP = `linear-gradient(180deg, #FAFBFC 0px, #FAFBFC 130px, ${colors.pageBg} 230px)`;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  deskScroll: { paddingHorizontal: 24, paddingTop: 6, paddingBottom: spacing.xxl },

  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerButton: { minHeight: 48, paddingHorizontal: 20, borderRadius: 10 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F1',
    padding: 22,
    marginBottom: 16,
  },

  filterRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 22 },
  filterPeriod: { width: 196 },
  filterRange: { width: 200, marginLeft: -12 },
  filterCell: { flex: 1, minWidth: 180 },
  rangeLabel: { fontSize: 12, marginBottom: 6 },
  rangeBox: {
    height: 43,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.md,
  },
  rangeText: { color: colors.textMuted, fontSize: 13.5, fontVariant: ['tabular-nums'] },
  customRange: { marginTop: spacing.sm },

  split: { flexDirection: 'row', alignItems: 'stretch', gap: 16 },
  // 46/54, como no desenho: a prévia leva mais largura porque é uma tabela
  // de seis colunas; o conjunto é texto e números grandes.
  setCard: { flex: 0.85, minWidth: 0 },
  previewCard: { flex: 1, minWidth: 0 },

  scopeBox: {
    flexDirection: 'row',
    backgroundColor: '#F3F8F5',
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 22,
  },
  scopeBoxStacked: { flexDirection: 'column', gap: 12 },
  scopeItem: { flex: 1, minWidth: 0 },
  scopeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  scopeLabel: { fontSize: 13, color: colors.form.muted },
  scopeValue: { fontSize: 15, fontWeight: '700', color: colors.text },
  scopeHint: { fontSize: 12, color: colors.form.soft, marginTop: 2 },
  scopeDivider: { width: 1, backgroundColor: '#DCE6E1', marginHorizontal: 18 },
  scopeDividerH: { height: 1, backgroundColor: '#DCE6E1' },

  totals: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 20, marginBottom: 18 },
  total: { flex: 1, minWidth: 200, flexDirection: 'row', alignItems: 'center', gap: 16 },
  totalSeal: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F1F4F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalLabel: { fontSize: 13.5, color: colors.form.muted },
  totalValue: { fontSize: 24, fontWeight: '700', color: colors.text, letterSpacing: -0.5, marginTop: 3 },
  totalDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.border },

  exportNote: { fontSize: 12, lineHeight: 17, color: colors.form.muted, marginBottom: 16 },
  exportRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  exportCell: { flex: 1, minWidth: 150 },
  exportCellFull: { flexBasis: '100%' },
  exportButton: { minHeight: 53, borderRadius: 10 },

  previewFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  previewCount: { fontSize: 13, color: colors.form.muted },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.sm },
  seeAllHover: { backgroundColor: colors.greenBg },
  seeAllText: { color: colors.brand[700], fontSize: 13, fontWeight: '700' },
});
