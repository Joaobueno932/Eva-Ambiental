import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Card, EmptyState, Header, Input, Loading, Select, StatusBadge, Tag } from '@/components';
import { colors, radius, spacing } from '@/theme';
import { usePermissions } from '@/hooks/usePermissions';
import { listWeighings, WeighingFilters } from '@/services/weighings';
import { listUnits, listWasteTypes } from '@/services/masters';
import { Unit, WasteType, Weighing } from '@/types';
import { WeighingsStackParamList } from '@/navigation/types';
import { formatDateTime, formatWeight } from '@/utils/format';

type Nav = NativeStackNavigationProp<WeighingsStackParamList, 'WeighingsList'>;

export function WeighingsListScreen() {
  const navigation = useNavigation<Nav>();
  const { canCreateWeighing } = usePermissions();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<Weighing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [wasteTypes, setWasteTypes] = useState<WasteType[]>([]);
  const [filters, setFilters] = useState<WeighingFilters>({});

  const loadMasters = useCallback(async () => {
    try {
      const [u, w] = await Promise.all([listUnits(true), listWasteTypes(true)]);
      setUnits(u);
      setWasteTypes(w);
    } catch {
      /* silencioso — filtros opcionais */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listWeighings({ ...filters, search });
      setItems(data);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível carregar as pesagens. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  }, [filters, search]);

  useFocusEffect(
    useCallback(() => {
      loadMasters();
      load();
    }, [loadMasters, load])
  );

  const unitOptions = useMemo(
    () => [{ label: 'Todas as unidades', value: '' }, ...units.map((u) => ({ label: u.name, value: u.id }))],
    [units]
  );
  const wasteOptions = useMemo(
    () => [{ label: 'Todos os resíduos', value: '' }, ...wasteTypes.map((w) => ({ label: w.name, value: w.id }))],
    [wasteTypes]
  );
  const statusOptions = [
    { label: 'Todos os status', value: '' },
    { label: 'Pendente', value: 'pending' },
    { label: 'Aprovada', value: 'approved' },
    { label: 'Rejeitada', value: 'rejected' },
    { label: 'Canceladas', value: 'canceled' },
  ];

  return (
    <View style={styles.container}>
      <Header
        title="Minhas Pesagens"
        subtitle={`${items.length} pesagem(ns) encontrada(s)`}
        right={
          <Pressable onPress={() => setShowFilters((s) => !s)} hitSlop={10} style={styles.filterBtn}>
            <Ionicons name="options-outline" size={22} color={colors.white} />
          </Pressable>
        }
      />

      <View style={styles.searchBar}>
        <Input
          placeholder="Buscar por resíduo, unidade, operador..."
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={load}
          returnKeyType="search"
          style={{ marginBottom: 0 }}
        />
      </View>

      {showFilters && (
        <View style={styles.filters}>
          <Select label="Unidade" options={unitOptions} value={filters.unitId ?? ''} onChange={(v) => setFilters((f) => ({ ...f, unitId: v || undefined }))} />
          <Select label="Tipo de resíduo" options={wasteOptions} value={filters.wasteTypeId ?? ''} onChange={(v) => setFilters((f) => ({ ...f, wasteTypeId: v || undefined }))} />
          <Select
            label="Status"
            options={statusOptions}
            value={(filters.approvalStatus as string) ?? ''}
            onChange={(v) => setFilters((f) => ({ ...f, approvalStatus: (v || undefined) as any }))}
          />
        </View>
      )}

      {loading ? (
        <Loading message="Carregando pesagens..." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: 100 + insets.bottom }]}
          onRefresh={load}
          refreshing={false}
          ListEmptyComponent={
            <EmptyState
              eva="hero"
              title="Nenhuma pesagem registrada ainda"
              message={
                canCreateWeighing
                  ? 'A Eva está pronta! Toque no botão + para registrar a primeira pesagem.'
                  : 'Ainda não há pesagens para visualizar.'
              }
            />
          }
          renderItem={({ item }) => {
            const isCanceled = !!item.canceled_at;
            return (
              <Card onPress={() => navigation.navigate('WeighingDetails', { id: item.id })}>
                <View style={styles.cardHeader}>
                  <Text style={styles.waste} numberOfLines={1}>
                    {item.waste_type?.name ?? 'Resíduo'}
                  </Text>
                  <View style={styles.badgesRow}>
                    {isCanceled
                      ? <Tag label="Cancelada" color="#991B1B" bg="#FEE2E2" />
                      : <StatusBadge status={item.approval_status} />}
                  </View>
                </View>
                <View style={styles.cardRow}>
                  <Ionicons name="cube-outline" size={16} color={colors.greenDark} />
                  <Text style={[styles.weight, isCanceled && styles.canceled]}>{formatWeight(item.weight_kg)}</Text>
                </View>
                <View style={styles.cardRow}>
                  <Ionicons name="time-outline" size={15} color={colors.grayText} />
                  <Text style={styles.meta}>{formatDateTime(item.weighing_date)}</Text>
                </View>
                <View style={styles.cardRow}>
                  <Ionicons name="location-outline" size={15} color={colors.grayText} />
                  <Text style={styles.meta} numberOfLines={1}>
                    {item.unit?.name ?? '-'} {item.client?.name ? `• ${item.client.name}` : ''}
                  </Text>
                </View>
                <View style={styles.cardRow}>
                  <Ionicons name="person-outline" size={15} color={colors.grayText} />
                  <Text style={styles.meta} numberOfLines={1}>
                    {item.creator?.full_name ?? '-'}
                  </Text>
                </View>
              </Card>
            );
          }}
        />
      )}

      {canCreateWeighing && (
        <Pressable
          style={[styles.fab, { bottom: spacing.xl + insets.bottom }]}
          accessibilityLabel="Nova pesagem"
          onPress={() => navigation.navigate('WeighingForm')}
        >
          <Ionicons name="add" size={32} color={colors.white} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.greenBg },
  filterBtn: { padding: 4 },
  searchBar: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  filters: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, backgroundColor: colors.white, marginHorizontal: spacing.lg, borderRadius: radius.lg, marginTop: spacing.sm },
  list: { padding: spacing.lg },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  badgesRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center', flexShrink: 1 },
  waste: { fontSize: 17, fontWeight: '700', color: colors.text, flex: 1, marginRight: spacing.xs },
  canceled: { textDecorationLine: 'line-through', color: colors.grayText },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 4 },
  weight: { fontSize: 16, fontWeight: '700', color: colors.greenDark },
  meta: { color: colors.grayText, fontSize: 13, flex: 1 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
