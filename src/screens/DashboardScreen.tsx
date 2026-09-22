import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BarChart, Button, Card, ColumnChart, DateRangePicker, DonutChart, EmptyState, Header, LatestWeighingsTable, Loading, Select, Tag, Topbar } from '@/components';
import { MetricStrip, SectionHeading } from '@/components/Operations';
import { usePermissions } from '@/hooks/usePermissions';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { MainTabsParamList } from '@/navigation/types';
import { dailyStatusSeries } from '@/utils/operations';
import { WeighingCard } from '@/components/WeighingCard';
import { colors, elevation, gradient, gradients, layout, radius, spacing, transition } from '@/theme';
import { useIsDesktop } from '@/hooks/useLayout';
import { useAuth } from '@/contexts/AuthContext';
import { PERIOD_OPTIONS, useOperationScope } from '@/hooks/useOperationScope';
import { classifyDiversion, formatDate, formatLongDate, formatNumber, formatPercent, formatWeight, roleLabel } from '@/utils/format';

export function DashboardScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabsParamList>>();
  const { canCreateWeighing } = usePermissions();
  const { profile, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();
  const {
    records, stats, operations, loading, loadError, refreshing,
    range, clientName, unitName, hasEntityFilter,
    draftRange, setDraftRange, draftClientId, draftUnitId, setDraftUnitId,
    clientOptions, unitOptions, dirtyFilters,
    onChangeClient, onChangePeriod, applyFilters, clearFilters,
    load, onRefresh, deltaProps,
  } = useOperationScope();

  if (loading) return <Loading message="Carregando painel..." />;

  if (loadError) return <View style={styles.container}><Header title="Operação ambiental" /><Card><EmptyState icon="cloud-offline-outline" title="Não foi possível carregar os dados" message={loadError} /><Button title="Tentar novamente" onPress={load} /></Card></View>;

  // Em tela grande os blocos de análise ficam lado a lado.
  const gridItem = isDesktop ? webStyles.gridItem : undefined;

  const hasData = stats && stats.totalWeighings > 0;
  const cls = stats ? classifyDiversion(stats.diversionRate) : null;

  /** Série do gráfico de evolução, contínua dentro do período aplicado. */
  const evolution = dailyStatusSeries(records, range.startDate, range.endDate);

  const statusSlices = [
    { label: 'Aguardando validação', value: operations.status.pending, color: colors.pendingRing },
    { label: 'Aprovadas', value: operations.status.approved, color: colors.statusChart.approved },
    { label: 'Rejeitadas', value: operations.status.rejected, color: colors.statusChart.rejected },
    { label: 'Canceladas', value: operations.status.canceled, color: colors.statusChart.canceled },
  ];

  const lostDiversionColor = stats
    ? stats.lostDiversion.rate <= 10
      ? '#16A34A'
      : stats.lostDiversion.rate <= 30
      ? '#D97706'
      : '#DC2626'
    : '#16A34A';

  const pageTitle = 'Operação ambiental';

  return (
    <View style={styles.container}>
      {/* No celular a identificação de quem está logado fica na aba Perfil e a
          navegação é a barra inferior — a trilha não teria onde caber. */}
      {isDesktop && (
        <Topbar
          crumbs={[
            { label: 'Painel', onPress: () => navigation.navigate('Painel') },
            { label: pageTitle },
          ]}
          userName={profile?.full_name}
          userRole={roleLabel[profile?.role ?? 'viewer']}
          notificationCount={operations.status.pending}
          onNotifications={() => navigation.navigate('Pesagens', { screen: 'WeighingsList' })}
          onUser={() => navigation.navigate('Perfil', { screen: 'ProfileHome' })}
          onSignOut={signOut}
        />
      )}
      <Header
        eyebrow="Painel"
        icon="leaf"
        title={pageTitle}
        subtitle="Monitoramento, validação e rastreabilidade de resíduos em tempo real."
        right={isDesktop ? (
          <View style={styles.headerRight}>
            <View style={styles.todayRow}>
              <Ionicons name="calendar-outline" size={14} color={colors.textSoft} />
              <Text style={styles.today}>{formatLongDate()}</Text>
            </View>
            {canCreateWeighing ? (
              <Button title="Nova pesagem" icon="add" variant="cta" onPress={() => navigation.navigate('Pesagens', { screen: 'WeighingForm' })} fullWidth={false} />
            ) : null}
          </View>
        ) : undefined}
      />
      <ScrollView
        contentContainerStyle={[
          isDesktop ? webStyles.scroll : styles.scroll,
          { paddingBottom: spacing.xxl + insets.bottom },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.green]} />}
      >
        {/* No site quem está logado já aparece no rodapé do menu lateral. */}
        {!isDesktop && (
          <View style={styles.greeting}>
            <Text style={styles.hello}>Olá, {profile?.full_name?.split(' ')[0]} 👋</Text>
            <Text style={styles.role}>{roleLabel[profile?.role ?? 'viewer']}</Text>
          </View>
        )}

        {!isDesktop && canCreateWeighing && <Button title="Registrar pesagem" icon="add" onPress={() => navigation.navigate('Pesagens', { screen: 'WeighingForm' })} style={{ marginBottom: spacing.lg }} />}
        {/* Período, cliente, unidade e ações num painel só: antes eram três
            blocos soltos e a página começava com uma pilha de controles sem
            contorno, o que fazia a área de filtros parecer o conteúdo. */}
        {/* Filtros numa faixa só, na ordem em que a pergunta é feita:
            período, de quem, de onde — e então aplicar. Antes eram três
            blocos empilhados que faziam a área de filtro parecer o conteúdo
            da página. */}
        <View style={[styles.filterBar, elevation('sm')]}>
          <View style={isDesktop ? webStyles.filterRow : styles.filterStack}>
            <View style={isDesktop ? webStyles.filterPeriod : undefined}>
              <Select
                label="Período"
                options={PERIOD_OPTIONS}
                value={draftRange.key}
                onChange={onChangePeriod}
              />
            </View>
            <View style={isDesktop ? webStyles.filterRange : undefined}>
              {/* Datas resolvidas do preset: o rótulo "Este Mês" não diz onde
                  o mês começa nem termina. */}
              <Text style={styles.rangeLabel}>&nbsp;</Text>
              <View style={styles.rangeBox}>
                <Text style={styles.rangeText} numberOfLines={1}>
                  {draftRange.startDate ? formatDate(draftRange.startDate) : '—'} – {draftRange.endDate ? formatDate(draftRange.endDate) : '—'}
                </Text>
              </View>
            </View>
            <View style={isDesktop ? webStyles.filterCell : undefined}>
              <Select label="Cliente" options={clientOptions} value={draftClientId} onChange={onChangeClient} />
            </View>
            <View style={isDesktop ? webStyles.filterCell : undefined}>
              <Select label="Unidade" options={unitOptions} value={draftUnitId} onChange={setDraftUnitId} />
            </View>
            <View style={isDesktop ? webStyles.filterActions : styles.filterStackActions}>
              <Button
                title="Aplicar filtros"
                icon="funnel-outline"
                variant={dirtyFilters ? 'primary' : 'outline'}
                onPress={applyFilters}
                fullWidth={!isDesktop}
              />
              {hasEntityFilter || range.key !== 'month' || dirtyFilters ? (
                <Pressable onPress={clearFilters} style={({ hovered }: any) => [styles.clearBtn, transition(), hovered && styles.clearBtnHover]} accessibilityRole="button">
                  <Ionicons name="refresh" size={14} color={colors.textMuted} />
                  <Text style={styles.clearBtnText}>Limpar filtros</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* O seletor completo só aparece quando o período é personalizado. */}
          {draftRange.key === 'custom' ? (
            <View style={styles.customRange}>
              <DateRangePicker value={draftRange} onChange={setDraftRange} />
            </View>
          ) : null}

          {hasEntityFilter ? (
            <View style={styles.activeFilters}>
              {clientName ? <Tag label={clientName} dot /> : null}
              {unitName ? <Tag label={unitName} dot /> : null}
            </View>
          ) : null}
        </View>


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
              {
                label: 'Pesagens registradas', value: formatNumber(stats!.totalWeighings),
                icon: 'documents-outline', ...deltaProps(stats!.trend?.weighings),
              },
              {
                label: 'Massa registrada', value: formatWeight(stats!.totalWeight),
                icon: 'scale-outline', ...deltaProps(stats!.trend?.weight),
              },
              {
                label: 'Desvio de aterro', value: formatPercent(stats!.diversionRate),
                icon: 'leaf-outline', tone: cls?.color, valueTone: cls?.color,
                ...deltaProps(stats!.trend?.diversionPoints, 'points'),
              },
              {
                label: 'Aguardando validação', value: String(operations.status.pending),
                icon: 'hourglass-outline', tone: colors.pendingRing,
                // Fila de validação que cresce não é boa notícia: inverte as cores.
                invertDelta: true, ...deltaProps(stats!.trend?.pending),
              },
            ]} />
            <View style={styles.baseRow}>
              <Ionicons name="business-outline" size={13} color={colors.textSoft} />
              <Text style={styles.baseText}>
                Base cadastral: {stats!.activeClients} clientes ativos • {stats!.activeUnits} unidades ativas
              </Text>
            </View>
            {/* Evolução e composição lado a lado: a primeira responde "como
                veio ao longo do mês", a segunda "em que pé está agora". */}
            {<View style={isDesktop ? webStyles.analysisRow : undefined}>
              <Card style={isDesktop ? webStyles.analysisWide : undefined}>
                <SectionHeading
                  title="Evolução das pesagens"
                  right={<View style={styles.rangeChip}>
                    <Text style={styles.rangeChipText}>{range.label}</Text>
                  </View>}
                />
                <ColumnChart data={evolution} />
              </Card>
              <Card style={isDesktop ? webStyles.analysisNarrow : undefined}>
                <SectionHeading title="Situação das pesagens" />
                <DonutChart slices={statusSlices} centerLabel="pesagens" />
              </Card>
            </View>}

            {<View style={isDesktop ? webStyles.grid : undefined}>
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
        {records.length > 0 && <Card>
          <SectionHeading
            title="Últimas pesagens"
            right={<Pressable
              onPress={() => navigation.navigate('Pesagens', { screen: 'WeighingsList' })}
              accessibilityRole="link"
              style={({ hovered }: any) => [styles.seeAll, transition(), hovered && styles.seeAllHover]}
            >
              <Text style={styles.seeAllText}>Ver todas</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.brand[700]} />
            </Pressable>}
          />
          {isDesktop
            ? <LatestWeighingsTable items={records.slice(0, 5)} onOpen={id => navigation.navigate('Pesagens', { screen: 'WeighingDetails', params: { id } })} />
            : records.slice(0, 5).map(item => <WeighingCard key={item.id} item={item} onPress={() => navigation.navigate('Pesagens', { screen: 'WeighingDetails', params: { id: item.id } })} />)}
        </Card>}
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },

  greeting: { marginBottom: spacing.lg },
  hello: { fontSize: 22, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },
  role: { color: colors.textMuted, fontSize: 13, marginTop: 2 },

  /** Faixa de filtros: período, cliente, unidade e a ação de aplicar. */
  filterBar: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  filterStack: { gap: spacing.md },
  filterStackActions: { gap: spacing.sm, marginTop: spacing.xs },
  // Alinha a caixa de datas com os selects, que têm rótulo acima.
  rangeLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6, color: 'transparent' },
  rangeBox: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  rangeText: { color: colors.textMuted, fontSize: 13, fontVariant: ['tabular-nums'] },
  customRange: { marginTop: spacing.md },

  headerRight: { alignItems: 'flex-end', gap: spacing.sm },
  todayRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  today: { color: colors.textMuted, fontSize: 12.5 },

  rangeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  rangeChipText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },

  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.sm },
  seeAllHover: { backgroundColor: colors.greenBg },
  seeAllText: { color: colors.brand[700], fontSize: 13, fontWeight: '700' },
  activeFilters: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, flexShrink: 1, marginTop: spacing.md },
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
  // `alignItems: flex-end` alinha o botão pela base dos campos, não pelo topo
  // — os selects têm rótulo acima e o botão não.
  filterRow: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap', alignItems: 'flex-end' },
  filterCell: { flex: 1, minWidth: 180 },
  filterPeriod: { width: 168 },
  filterRange: { width: 190 },
  filterActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingBottom: 1 },

  /** Evolução (larga) e situação (estreita) na mesma linha. */
  analysisRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', marginBottom: spacing.md },
  analysisWide: { flexGrow: 1, flexBasis: '58%', minWidth: 420, marginBottom: 0 },
  analysisNarrow: { flexGrow: 1, flexBasis: '38%', minWidth: 360, marginBottom: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs },
  gridItem: { flexBasis: '48%', flexGrow: 1, minWidth: 320, marginBottom: 0 },
});
