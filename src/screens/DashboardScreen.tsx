import React, { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BarChart, Button, Card, DateRangePicker, EmptyState, Header, Loading, Tag } from '@/components';
import { colors, radius, spacing } from '@/theme';
import { useAuth } from '@/contexts/AuthContext';
import { getDashboardStats } from '@/services/dashboard';
import { listWeighings } from '@/services/weighings';
import { DashboardStats } from '@/types';
import { buildPreset, DateRange } from '@/utils/dateRanges';
import { classifyDiversion, formatNumber, formatPercent, formatWeight, roleLabel } from '@/utils/format';
import { generateCsvReport, generatePdfReport } from '@/utils/reports';

export function DashboardScreen() {
  const { profile } = useAuth();
  const [range, setRange] = useState<DateRange>(buildPreset('month'));
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getDashboardStats({ startDate: range.startDate, endDate: range.endDate });
      setStats(data);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao carregar o painel.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const exportReport = async (type: 'pdf' | 'csv') => {
    if (!stats) return;
    setExporting(true);
    try {
      const weighings = await listWeighings({ startDate: range.startDate, endDate: range.endDate });
      const ctx = { periodLabel: range.label, stats, weighings };
      if (type === 'pdf') await generatePdfReport(ctx);
      else await generateCsvReport(ctx);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao gerar relatório.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <Loading message="Carregando painel..." />;

  const hasData = stats && stats.totalWeighings > 0;
  const cls = stats ? classifyDiversion(stats.diversionRate) : null;

  return (
    <View style={styles.container}>
      <Header title="Meu Painel" subtitle="Acompanhe suas pesagens e estatísticas" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.green]} />}
      >
        <View style={styles.greeting}>
          <Text style={styles.hello}>Olá, {profile?.full_name?.split(' ')[0]} 👋</Text>
          <Text style={styles.role}>{roleLabel[profile?.role ?? 'viewer']}</Text>
        </View>

        <DateRangePicker value={range} onChange={setRange} />

        <View style={styles.toolbar}>
          <Button title="Atualizar" icon="refresh" variant="outline" onPress={onRefresh} fullWidth={false} style={{ flex: 1 }} />
        </View>

        {!hasData ? (
          <Card>
            <EmptyState
              icon="bar-chart-outline"
              title="Sem dados no período"
              message="Não há pesagens registradas para o período selecionado. Registre pesagens ou ajuste o filtro."
            />
          </Card>
        ) : (
          <>
            <View style={styles.statsGrid}>
              <StatCard icon="scale" label="Total de Pesagens" value={formatNumber(stats!.totalWeighings)} />
              <StatCard icon="cube" label="Peso Total" value={formatWeight(stats!.totalWeight)} />
              <StatCard icon="business" label="Clientes Ativos" value={formatNumber(stats!.activeClients)} />
              <StatCard icon="location" label="Unidades Ativas" value={formatNumber(stats!.activeUnits)} />
            </View>

            <Card>
              <Text style={styles.cardTitle}>Taxa de Desvio de Aterro</Text>
              <View style={styles.diversionRow}>
                <Text style={styles.diversionValue}>{formatPercent(stats!.diversionRate)}</Text>
                {cls && <Tag label={cls.label} color={colors.white} bg={cls.color} />}
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.min(100, stats!.diversionRate)}%`, backgroundColor: cls?.color }]} />
              </View>
              <Text style={styles.diversionHint}>
                Peso desviado de aterro sobre o peso total no período.
              </Text>
            </Card>

            <Card>
              <Text style={styles.cardTitle}>Distribuição por Tipo de Resíduo</Text>
              <BarChart data={stats!.byWasteType.map((w) => ({ label: w.name, value: w.weight, color: w.color }))} />
            </Card>

            <Card>
              <Text style={styles.cardTitle}>Distribuição por Tipo de Tratamento</Text>
              <BarChart data={stats!.byTreatment.map((t) => ({ label: t.name, value: t.weight }))} />
            </Card>

            <Card>
              <Text style={styles.cardTitle}>Principais Resíduos por Peso</Text>
              {stats!.byWasteType.slice(0, 5).map((w, i) => (
                <View key={w.name} style={styles.rankRow}>
                  <Text style={styles.rankPos}>{i + 1}º</Text>
                  <View style={[styles.dot, { backgroundColor: w.color }]} />
                  <Text style={styles.rankName} numberOfLines={1}>{w.name}</Text>
                  <Text style={styles.rankWeight}>{formatWeight(w.weight)}</Text>
                </View>
              ))}
            </Card>

            <Card>
              <Text style={styles.cardTitle}>Relatórios</Text>
              <Text style={styles.diversionHint}>Gere o relatório do período selecionado.</Text>
              <View style={styles.reportRow}>
                <View style={{ flex: 1 }}>
                  <Button title="PDF" icon="document-text" onPress={() => exportReport('pdf')} loading={exporting} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title="CSV" icon="grid" variant="outline" onPress={() => exportReport('csv')} loading={exporting} />
                </View>
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={20} color={colors.greenDark} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.greenBg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  greeting: { marginBottom: spacing.md },
  hello: { fontSize: 20, fontWeight: '700', color: colors.text },
  role: { color: colors.grayText },
  toolbar: { flexDirection: 'row', marginVertical: spacing.md },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xs },
  statCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '47%',
    flexGrow: 1,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.greenBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: colors.grayText, marginTop: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  diversionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  diversionValue: { fontSize: 28, fontWeight: '800', color: colors.greenDark },
  track: { height: 12, backgroundColor: colors.gray, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: 12, borderRadius: radius.full },
  diversionHint: { color: colors.grayText, fontSize: 12, marginTop: spacing.sm },
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.gray },
  rankPos: { width: 28, fontWeight: '800', color: colors.greenDark },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.sm },
  rankName: { flex: 1, color: colors.text },
  rankWeight: { fontWeight: '700', color: colors.text },
  reportRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
});
