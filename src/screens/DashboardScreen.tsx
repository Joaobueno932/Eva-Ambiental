import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { showAlert } from '@/utils/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BarChart, Button, Card, DateRangePicker, EmptyState, Header, Loading, Select, Tag } from '@/components';
import { MetricStrip, SectionHeading } from '@/components/Operations';
import { usePermissions } from '@/hooks/usePermissions';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { MainTabsParamList } from '@/navigation/types';
import { operationSummary } from '@/utils/operations';
import { WeighingTable } from '@/components/WeighingTable';
import { WeighingCard } from '@/components/WeighingCard';
import { colors, elevation, gradient, gradients, layout, radius, spacing, transition } from '@/theme';
import { useIsDesktop } from '@/hooks/useLayout';
import { useAuth } from '@/contexts/AuthContext';
import { getDashboardStats } from '@/services/dashboard';
import { listWeighings } from '@/services/weighings';
import { listClients, listUnits } from '@/services/masters';
import { Client, DashboardStats, Unit, Weighing } from '@/types';
import { buildPreset, DateRange } from '@/utils/dateRanges';
import { classifyDiversion, formatNumber, formatPercent, formatWeight, roleLabel } from '@/utils/format';
import { generateCsvReport, generatePdfReport, generateXlsxReport } from '@/utils/reports';

export function DashboardScreen({ reportsOnly = false }: { reportsOnly?: boolean }) {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabsParamList>>();
  const { canCreateWeighing } = usePermissions();
  const loadVersion = useRef(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [records, setRecords] = useState<Weighing[]>([]);
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();
  const [range, setRange] = useState<DateRange>(buildPreset('month'));
  const [clientId, setClientId] = useState<string>('');
  const [unitId, setUnitId] = useState<string>('');
  const [clients, setClients] = useState<Client[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadMasters = useCallback(async () => {
    try {
      const [c, u] = await Promise.all([listClients(true), listUnits(true)]);
      setClients(c);
      setUnits(u);
    } catch {
      /* silencioso — filtros opcionais */
    }
  }, []);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getDashboardStats({
        startDate: range.startDate,
        endDate: range.endDate,
        clientId: clientId || undefined,
        unitId: unitId || undefined,
      });
      const rows = await listWeighings({ startDate: range.startDate, endDate: range.endDate, clientId: clientId || undefined, unitId: unitId || undefined });
      if (version !== loadVersion.current) return;
      setRecords(rows);
      setStats(data);
    } catch (e: any) {
      if (version === loadVersion.current) setLoadError(e?.message ?? 'Falha ao carregar o painel.');
    } finally {
      if (version === loadVersion.current) { setLoading(false); setRefreshing(false); }
    }
  }, [range, clientId, unitId]);

  useFocusEffect(
    useCallback(() => {
      loadMasters();
      load();
    }, [loadMasters, load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  // Unidades exibidas no filtro: todas, ou apenas as do cliente selecionado.
  const filteredUnits = useMemo(
    () => (clientId ? units.filter((u) => u.client_id === clientId) : units),
    [units, clientId]
  );
  const clientOptions = useMemo(
    () => [{ label: 'Todos os clientes', value: '' }, ...clients.map((c) => ({ label: c.name, value: c.id }))],
    [clients]
  );
  const unitOptions = useMemo(
    () => [{ label: 'Todas as unidades', value: '' }, ...filteredUnits.map((u) => ({ label: u.name, value: u.id }))],
    [filteredUnits]
  );

  const onChangeClient = (v: string) => {
    setClientId(v);
    // Se a unidade selecionada não pertence ao novo cliente, limpa a seleção.
    if (v && unitId) {
      const stillValid = units.some((u) => u.id === unitId && u.client_id === v);
      if (!stillValid) setUnitId('');
    }
  };

  const clearFilters = () => {
    setClientId('');
    setUnitId('');
    setRange(buildPreset('month'));
  };

  const clientName = clients.find((c) => c.id === clientId)?.name;
  const unitName = units.find((u) => u.id === unitId)?.name;
  const hasEntityFilter = !!clientId || !!unitId;

  const exportReport = async (type: 'xlsx' | 'pdf' | 'csv') => {
    if (!stats) return;
    setExporting(true);
    try {
      const weighings = await listWeighings({
        startDate: range.startDate,
        endDate: range.endDate,
        clientId: clientId || undefined,
        unitId: unitId || undefined,
        excludeCanceled: true,
      });
      const scope = [clientName, unitName].filter(Boolean).join(' • ');
      const periodLabel = scope ? `${range.label} — ${scope}` : range.label;
      const ctx = { periodLabel, stats, weighings };
      if (type === 'xlsx') await generateXlsxReport(ctx);
      else if (type === 'pdf') await generatePdfReport(ctx);
      else await generateCsvReport(ctx);
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao gerar relatório.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <Loading message="Carregando painel..." />;

  if (loadError) return <View style={styles.container}><Header title={reportsOnly ? 'Central de relatórios' : 'Operação ambiental'} /><Card><EmptyState icon="cloud-offline-outline" title="Não foi possível carregar os dados" message={loadError} /><Button title="Tentar novamente" onPress={load} /></Card></View>;

  // Em tela grande os blocos de análise ficam lado a lado.
  const gridItem = isDesktop ? webStyles.gridItem : undefined;

  const operations = operationSummary(records);
  const hasData = stats && stats.totalWeighings > 0;
  const cls = stats ? classifyDiversion(stats.diversionRate) : null;

  const lostDiversionColor = stats
    ? stats.lostDiversion.rate <= 10
      ? '#16A34A'
      : stats.lostDiversion.rate <= 30
      ? '#D97706'
      : '#DC2626'
    : '#16A34A';

  return (
    <View style={styles.container}>
      <Header
        eyebrow={reportsOnly ? 'Relatórios' : 'Painel'}
        title={reportsOnly ? 'Central de relatórios' : 'Operação ambiental'}
        subtitle={reportsOnly ? 'Consolide, confira e exporte os registros da operação' : 'Monitoramento, validação e rastreabilidade de resíduos'}
        right={!reportsOnly && isDesktop && canCreateWeighing ? <Button title="Nova pesagem" icon="add" onPress={() => navigation.navigate('Pesagens', { screen: 'WeighingForm' })} fullWidth={false} /> : undefined}
      />
      <ScrollView
        contentContainerStyle={[
          isDesktop ? webStyles.scroll : styles.scroll,
          { paddingBottom: spacing.xxl + insets.bottom },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.green]} />}
      >
        {/* No site quem está logado já aparece no rodapé do menu lateral. */}
        {!isDesktop && !reportsOnly && (
          <View style={styles.greeting}>
            <Text style={styles.hello}>Olá, {profile?.full_name?.split(' ')[0]} 👋</Text>
            <Text style={styles.role}>{roleLabel[profile?.role ?? 'viewer']}</Text>
          </View>
        )}

        {!isDesktop && !reportsOnly && canCreateWeighing && <Button title="Registrar pesagem" icon="add" onPress={() => navigation.navigate('Pesagens', { screen: 'WeighingForm' })} style={{ marginBottom: spacing.lg }} />}
        {/* Período, cliente, unidade e ações num painel só: antes eram três
            blocos soltos e a página começava com uma pilha de controles sem
            contorno, o que fazia a área de filtros parecer o conteúdo. */}
        <View style={[styles.scope, elevation('sm')]}>
          <SectionHeading
            title="Escopo da operação"
            description="Período, cliente e unidade considerados nos números abaixo."
            right={isDesktop ? (
              <Pressable
                onPress={onRefresh}
                accessibilityRole="button"
                accessibilityLabel="Atualizar"
                style={({ hovered }: any) => [styles.iconBtn, transition(), hovered && styles.iconBtnHover]}
              >
                <Ionicons name="refresh" size={16} color={colors.textMuted} />
              </Pressable>
            ) : undefined}
          />
          <DateRangePicker value={range} onChange={setRange} />

          <View style={[isDesktop ? webStyles.filterRow : undefined, styles.filterBlock]}>
            <View style={isDesktop ? webStyles.filterCell : undefined}>
              <Select label="Cliente" options={clientOptions} value={clientId} onChange={onChangeClient} />
            </View>
            <View style={isDesktop ? webStyles.filterCell : undefined}>
              <Select label="Unidade" options={unitOptions} value={unitId} onChange={setUnitId} />
            </View>
          </View>

          <View style={styles.scopeFooter}>
            <View style={styles.activeFilters}>
              {hasEntityFilter ? (
                <>
                  {clientName ? <Tag label={clientName} dot /> : null}
                  {unitName ? <Tag label={unitName} dot /> : null}
                </>
              ) : (
                <Text style={styles.scopeHint}>Sem filtros — todos os clientes e unidades.</Text>
              )}
            </View>
            <View style={styles.scopeActions}>
              {!isDesktop && (
                <Button title="Atualizar" icon="refresh" variant="outline" onPress={onRefresh} fullWidth={false} style={styles.flexBtn} />
              )}
              {hasEntityFilter || range.key !== 'month' ? (
                <Pressable onPress={clearFilters} style={({ hovered }: any) => [styles.clearBtn, transition(), hovered && styles.clearBtnHover]} accessibilityRole="button">
                  <Ionicons name="close-circle-outline" size={15} color={colors.textMuted} />
                  <Text style={styles.clearBtnText}>Limpar filtros</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        {reportsOnly && <Card>
          <SectionHeading title="Conjunto selecionado" description={range.label} />
          <Text style={styles.diversionHint}>{clientName ?? 'Todos os clientes'} • {unitName ?? 'Todas as unidades'}</Text>
          <Text style={styles.cardTitle}>{operations.exportCount} registros para exportação</Text>
          <Text style={styles.diversionHint}>Exportação: registros não cancelados, incluindo rejeitados. Indicadores: apenas pendentes e aprovados.</Text>
          <View style={webStyles.reportActions}>{(['pdf', 'csv', 'xlsx'] as const).map(type => <Button key={type} title={type.toUpperCase()} icon="download-outline" variant={type === 'pdf' ? 'primary' : 'outline'} fullWidth={false} loading={exporting} disabled={!stats} onPress={() => exportReport(type)} />)}</View>
        </Card>}
        {!reportsOnly && <Card>
          <SectionHeading title="Situação das pesagens" description="Todos os status no período selecionado. Canceladas são contabilizadas separadamente." />
          {/* Contagem por situação: o número vem antes do rótulo e a cor do
              ponto é a mesma das pílulas da listagem, para que as duas telas
              se leiam do mesmo jeito. */}
          <View style={styles.statusRow}>{([
            ['Aguardando validação', operations.status.pending, colors.warning],
            ['Aprovadas', operations.status.approved, colors.success],
            ['Rejeitadas', operations.status.rejected, colors.danger],
            ['Canceladas', operations.status.canceled, colors.textSoft],
          ] as const).map(([label, count, tone]) => <View key={label} style={styles.statusCell}>
            <View style={styles.statusHead}>
              <View style={[styles.statusDot, { backgroundColor: tone }]} />
              <Text style={styles.statusCount}>{count}</Text>
            </View>
            <Text style={styles.statusLabel}>{label}</Text>
          </View>)}</View>
        </Card>}
        {!hasData ? (
          <Card>
            <EmptyState
              eva="hero"
              title="Sem dados no período"
              message="A Eva ainda não tem o que mostrar aqui. Registre pesagens ou ajuste o filtro de período."
            />
          </Card>
        ) : (
          <>
            <MetricStrip items={[
              { label: 'Pesagens consideradas', value: formatNumber(stats!.totalWeighings), hint: 'Pendentes e aprovadas', icon: 'documents-outline' },
              { label: 'Massa registrada', value: formatWeight(stats!.totalWeight), hint: 'Sem rejeitadas e canceladas', icon: 'scale-outline' },
              { label: 'Desvio de aterro', value: formatPercent(stats!.diversionRate), hint: 'Sobre a massa considerada', icon: 'leaf-outline', tone: cls?.color },
              { label: 'Aguardando validação', value: String(operations.status.pending), hint: 'No período selecionado', icon: 'hourglass-outline', tone: operations.status.pending > 0 ? colors.warning : undefined },
            ]} />
            <View style={styles.baseRow}>
              <Ionicons name="business-outline" size={13} color={colors.textSoft} />
              <Text style={styles.baseText}>
                Base cadastral: {stats!.activeClients} clientes ativos • {stats!.activeUnits} unidades ativas
              </Text>
            </View>
            {!reportsOnly && <Card>
              <SectionHeading title="Evolução da massa registrada" description="Agrupamento diário de pesagens pendentes e aprovadas (kg)." />
              <BarChart data={operations.daily} />
            </Card>}

            {!reportsOnly && <View style={isDesktop ? webStyles.grid : undefined}>
            <Card style={gridItem} accent>
              <Text style={styles.cardTitle}>Taxa de desvio de aterro</Text>
              <View style={styles.diversionRow}>
                <Text style={[styles.diversionValue, cls ? { color: cls.color } : null]}>{formatPercent(stats!.diversionRate)}</Text>
                {cls && <Tag label={cls.label} color={cls.color} bg={cls.color + '16'} border={cls.color + '33'} dot />}
              </View>
              <View style={styles.track}>
                <View style={[
                  styles.fill,
                  { width: `${Math.min(100, stats!.diversionRate)}%`, backgroundColor: cls?.color },
                  cls ? gradient(gradients.bar(cls.color), cls.color) : null,
                  transition('width', 320),
                ]} />
              </View>
              <Text style={styles.diversionHint}>
                Peso desviado de aterro sobre o peso total no período.
              </Text>
            </Card>

            {stats!.lostDiversion.divertibleWeight > 0 && (
              <Card style={gridItem}>
                <Text style={styles.cardTitle}>Potencial de desvio perdido</Text>
                <View style={styles.diversionRow}>
                  <Text style={[styles.diversionValue, { color: lostDiversionColor }]}>
                    {formatPercent(stats!.lostDiversion.rate)}
                  </Text>
                </View>
                <View style={styles.track}>
                  <View style={[
                    styles.fill,
                    { width: `${Math.min(100, stats!.lostDiversion.rate)}%`, backgroundColor: lostDiversionColor },
                    gradient(gradients.bar(lostDiversionColor), lostDiversionColor),
                    transition('width', 320),
                  ]} />
                </View>
                <Text style={styles.diversionHint}>
                  {stats!.lostDiversion.lostWeight > 0
                    ? `${formatWeight(stats!.lostDiversion.lostWeight)} de ${formatWeight(stats!.lostDiversion.divertibleWeight)} enviados ao aterro poderiam ter sido desviados.`
                    : `Nenhum resíduo dos ${formatWeight(stats!.lostDiversion.divertibleWeight)} enviados ao aterro foi marcado como desviável.`}
                </Text>
              </Card>
            )}

            {stats!.perCapita.weighingsWithPeople > 0 && (
              <Card style={gridItem}>
                <Text style={styles.cardTitle}>Geração per capita</Text>
                <Text style={styles.diversionValue}>{formatWeight(stats!.perCapita.avgKgPerPerson)}/pessoa</Text>
                <Text style={styles.diversionHint}>
                  Média de geração por pessoa no período, com base em {stats!.perCapita.weighingsWithPeople} pesagem(ns) com quantidade de pessoas informada ({formatNumber(stats!.perCapita.totalPeople)} pessoas no total).
                </Text>
              </Card>
            )}

            <Card style={gridItem}>
              <Text style={styles.cardTitle}>Distribuição por tipo de resíduo</Text>
              <BarChart data={stats!.byWasteType.map((w) => ({ label: w.name, value: w.weight, color: w.color }))} />
            </Card>

            <Card style={gridItem}>
              <Text style={styles.cardTitle}>Distribuição por tipo de tratamento</Text>
              <BarChart data={stats!.byTreatment.map((t) => ({ label: t.name, value: t.weight }))} />
            </Card>

            <Card style={gridItem}>
              <Text style={styles.cardTitle}>Principais resíduos por peso</Text>
              {stats!.byWasteType.slice(0, 5).map((w, i) => (
                <View key={w.name} style={[styles.rankRow, i === 4 && styles.rankRowLast]}>
                  <View style={[styles.rankPos, i === 0 && styles.rankPosTop]}>
                    <Text style={[styles.rankPosText, i === 0 && styles.rankPosTextTop]}>{i + 1}</Text>
                  </View>
                  <View style={[styles.dot, { backgroundColor: w.color }]} />
                  <Text style={styles.rankName} numberOfLines={1}>{w.name}</Text>
                  <Text style={styles.rankWeight}>{formatWeight(w.weight)}</Text>
                </View>
              ))}
            </Card>

            <Card style={gridItem}>
              <SectionHeading title="Central de relatórios" description="Confira o escopo e exporte registros em PDF, CSV ou Excel." />
              <Button title="Abrir relatórios" variant="outline" icon="document-text-outline" onPress={() => navigation.navigate('Relatorios')} />
            </Card>
            </View>}
          </>
        )}
        {!reportsOnly && records.length > 0 && <Card>
          <SectionHeading title="Registros recentes" description="Abra um registro para consultar suas evidências e decisões." />
          {isDesktop ? <WeighingTable items={records.slice(0, 5)} onOpen={id => navigation.navigate('Pesagens', { screen: 'WeighingDetails', params: { id } })} /> : records.slice(0, 5).map(item => <WeighingCard key={item.id} item={item} onPress={() => navigation.navigate('Pesagens', { screen: 'WeighingDetails', params: { id: item.id } })} />)}
        </Card>}
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  flexBtn: { flex: 1 },

  greeting: { marginBottom: spacing.lg },
  hello: { fontSize: 22, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },
  role: { color: colors.textMuted, fontSize: 13, marginTop: 2 },

  /** Painel de escopo: período, filtros e ações. */
  scope: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  filterBlock: { marginTop: spacing.md },
  scopeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: spacing.md,
  },
  scopeHint: { color: colors.textSoft, fontSize: 12.5 },
  scopeActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexGrow: 1, justifyContent: 'flex-end' },
  activeFilters: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, flexShrink: 1 },

  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnHover: { backgroundColor: colors.brand[50], borderColor: colors.brand[200] },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.sm,
  },
  clearBtnHover: { backgroundColor: colors.surfaceAlt },
  clearBtnText: { color: colors.textMuted, fontWeight: '600', fontSize: 12.5 },

  /** Contagem por situação. */
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  statusCell: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 132,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  statusHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusCount: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  statusLabel: { fontSize: 11.5, color: colors.textMuted, marginTop: 3, fontWeight: '500' },

  baseRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.lg, marginTop: -spacing.xs },
  baseText: { color: colors.textSoft, fontSize: 12 },

  cardTitle: { fontSize: 15.5, fontWeight: '700', color: colors.text, marginBottom: spacing.md, letterSpacing: -0.2 },
  diversionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.md },
  diversionValue: { fontSize: 34, fontWeight: '700', color: colors.brand[700], letterSpacing: -1.2 },
  track: { height: 10, backgroundColor: colors.surfaceSunken, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: 10, borderRadius: radius.full },
  diversionHint: { color: colors.textMuted, fontSize: 12.5, marginTop: spacing.md, lineHeight: 18 },

  /** Ranking de resíduos. */
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  rankRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  rankPos: {
    width: 22,
    height: 22,
    borderRadius: radius.xs,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankPosTop: { backgroundColor: colors.brand[700] },
  rankPosText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  rankPosTextTop: { color: colors.white },
  dot: { width: 8, height: 8, borderRadius: 2 },
  rankName: { flex: 1, color: colors.text, fontSize: 13.5 },
  rankWeight: { fontWeight: '700', color: colors.text, fontSize: 13.5, fontVariant: ['tabular-nums'] },
});

const webStyles = StyleSheet.create({
  scroll: {
    padding: spacing.xl + 4,
    paddingBottom: spacing.xxl,
    // Em monitores largos a leitura se perde quando a linha atravessa a tela
    // inteira; a coluna de trabalho para antes disso e fica centralizada.
    width: '100%',
    maxWidth: layout.content,
    alignSelf: 'center',
  },
  filterRow: { flexDirection: 'row', gap: spacing.md },
  filterCell: { flex: 1, minWidth: 180 },
  reportActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs },
  gridItem: { flexBasis: '48%', flexGrow: 1, minWidth: 320, marginBottom: 0 },
});
