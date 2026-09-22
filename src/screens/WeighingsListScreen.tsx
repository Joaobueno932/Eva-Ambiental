import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { showAlert } from '@/utils/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Button, EmptyState, Header, Input, Loading, Select } from '@/components';
import { WeighingTable } from '@/components/WeighingTable';
import { WeighingCard } from '@/components/WeighingCard';
import { colors, elevation, gradient, gradients, layout, radius, spacing } from '@/theme';
import { useCardColumns, useIsDesktop } from '@/hooks/useLayout';
import { usePermissions } from '@/hooks/usePermissions';
import { listWeighings, WeighingFilters } from '@/services/weighings';
import { listRecipients, listTreatmentTypes, listUnits, listWasteTypes } from '@/services/masters';
import { Recipient, TreatmentType, Unit, WasteType, Weighing } from '@/types';
import { WeighingsStackParamList } from '@/navigation/types';
import { parseBrDate } from '@/utils/dateRanges';
import { WeighingDetailsView } from './WeighingDetailsScreen';



type Nav = NativeStackNavigationProp<WeighingsStackParamList, 'WeighingsList'>;

export function WeighingsListScreen() {
  const navigation = useNavigation<Nav>();
  const { canCreateWeighing } = usePermissions();
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();
  const columns = useCardColumns();
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const loadVersion = useRef(0);
  const [items, setItems] = useState<Weighing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [wasteTypes, setWasteTypes] = useState<WasteType[]>([]);
  const [treatmentTypes, setTreatmentTypes] = useState<TreatmentType[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [filters, setFilters] = useState<WeighingFilters>({});
  // Datas mantidas como texto (DD/MM/AAAA) e convertidas para ISO ao aplicar.
  const [startText, setStartText] = useState('');
  const [endText, setEndText] = useState('');
  const [dateError, setDateError] = useState<string | undefined>();
  /** Pesagem aberta no modal de detalhes (só no site). */
  const [detailsId, setDetailsId] = useState<string | null>(null);

  useEffect(() => setPage(0), [filters, search]);
  useEffect(() => setPage(p => Math.min(p, Math.max(0, Math.ceil(items.length / pageSize) - 1))), [items.length]);
  const loadMasters = useCallback(async () => {
    try {
      const [u, w, t, r] = await Promise.all([
        listUnits(true),
        listWasteTypes(true),
        listTreatmentTypes(true),
        listRecipients(true),
      ]);
      setUnits(u);
      setWasteTypes(w);
      setTreatmentTypes(t);
      setRecipients(r);
    } catch {
      /* silencioso — filtros opcionais */
    }
  }, []);

  const load = useCallback(async (quiet = false) => {
    const version = ++loadVersion.current;
    if (!quiet) setLoading(true);
    try {
      const data = await listWeighings({ ...filters, search });
      if (version === loadVersion.current) setItems(data);
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Não foi possível carregar as pesagens. Verifique sua conexão.');
    } finally {
      if (version === loadVersion.current) setLoading(false);
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
  const treatmentOptions = useMemo(
    () => [{ label: 'Todos os tratamentos', value: '' }, ...treatmentTypes.map((t) => ({ label: t.name, value: t.id }))],
    [treatmentTypes]
  );
  const recipientOptions = useMemo(
    () => [{ label: 'Todos os destinatários', value: '' }, ...recipients.map((r) => ({ label: r.name, value: r.id }))],
    [recipients]
  );
  const statusOptions = [
    { label: 'Todos os status', value: '' },
    { label: 'Pendente', value: 'pending' },
    { label: 'Aprovada', value: 'approved' },
    { label: 'Rejeitada', value: 'rejected' },
    { label: 'Canceladas', value: 'canceled' },
  ];

  // Aplica o intervalo de datas (weighing_date). Cada limite é opcional.
  const applyDates = () => {
    const start = startText.trim() ? parseBrDate(startText.trim(), false) : undefined;
    const end = endText.trim() ? parseBrDate(endText.trim(), true) : undefined;
    if ((startText.trim() && !start) || (endText.trim() && !end)) {
      setDateError('Use o formato DD/MM/AAAA.');
      return;
    }
    if (start && end && start > end) {
      setDateError('A data inicial não pode ser maior que a final.');
      return;
    }
    setDateError(undefined);
    setFilters((f) => ({ ...f, startDate: start, endDate: end }));
  };

  const clearFilters = () => {
    setFilters({});
    setStartText('');
    setEndText('');
    setDateError(undefined);
  };

  const activeFilterCount =
    (filters.startDate || filters.endDate ? 1 : 0) +
    (filters.unitId ? 1 : 0) +
    (filters.wasteTypeId ? 1 : 0) +
    (filters.treatmentTypeId ? 1 : 0) +
    (filters.recipientId ? 1 : 0) +
    (filters.approvalStatus ? 1 : 0);

  const openWeighing = (id: string) => {
    // No site o detalhe abre sobre a lista: trocar de página perderia a
    // posição da rolagem e os filtros aplicados.
    if (isDesktop) setDetailsId(id);
    else navigation.navigate('WeighingDetails', { id });
  };

  const closeDetails = () => {
    setDetailsId(null);
    // Aprovar/rejeitar/cancelar dentro do modal muda o que a lista mostra.
    load(true);
  };

  const filtersPanel = (
    <View style={isDesktop ? webStyles.filters : styles.filters}>
      <Text style={styles.filterSectionLabel}>Período da pesagem</Text>
      <View style={styles.dateRow}>
        <View style={styles.flex}>
          <Input
            label="Data inicial"
            placeholder="DD/MM/AAAA"
            value={startText}
            onChangeText={setStartText}
            keyboardType="numbers-and-punctuation"
            style={{ marginBottom: spacing.sm }}
          />
        </View>
        <View style={styles.flex}>
          <Input
            label="Data final"
            placeholder="DD/MM/AAAA"
            value={endText}
            onChangeText={setEndText}
            keyboardType="numbers-and-punctuation"
            style={{ marginBottom: spacing.sm }}
          />
        </View>
        {isDesktop && (
          <View style={webStyles.applyWrap}>
            <Button title="Aplicar" icon="calendar-outline" variant="outline" onPress={applyDates} />
          </View>
        )}
      </View>
      {dateError ? <Text style={styles.dateError}>{dateError}</Text> : null}
      {!isDesktop && (
        <Button
          title="Aplicar datas"
          icon="calendar-outline"
          variant="outline"
          onPress={applyDates}
          style={{ marginBottom: spacing.sm }}
        />
      )}

      <View style={isDesktop ? webStyles.selectGrid : undefined}>
        <View style={isDesktop ? webStyles.selectCell : undefined}>
          <Select
            label="Unidade"
            options={unitOptions}
            value={filters.unitId ?? ''}
            onChange={(v) => setFilters((f) => ({ ...f, unitId: v || undefined }))}
          />
        </View>
        <View style={isDesktop ? webStyles.selectCell : undefined}>
          <Select
            label="Tipo de resíduo"
            options={wasteOptions}
            value={filters.wasteTypeId ?? ''}
            onChange={(v) => setFilters((f) => ({ ...f, wasteTypeId: v || undefined }))}
          />
        </View>
        <View style={isDesktop ? webStyles.selectCell : undefined}>
          <Select
            label="Tipo de tratamento"
            options={treatmentOptions}
            value={filters.treatmentTypeId ?? ''}
            onChange={(v) => setFilters((f) => ({ ...f, treatmentTypeId: v || undefined }))}
          />
        </View>
        <View style={isDesktop ? webStyles.selectCell : undefined}>
          <Select
            label="Destinatário"
            options={recipientOptions}
            value={filters.recipientId ?? ''}
            onChange={(v) => setFilters((f) => ({ ...f, recipientId: v || undefined }))}
          />
        </View>
        <View style={isDesktop ? webStyles.selectCell : undefined}>
          <Select
            label="Status"
            options={statusOptions}
            value={(filters.approvalStatus as string) ?? ''}
            onChange={(v) => setFilters((f) => ({ ...f, approvalStatus: (v || undefined) as any }))}
          />
        </View>
      </View>

      <Pressable onPress={clearFilters} style={styles.clearBtn} accessibilityRole="button">
        <Ionicons name="close-circle-outline" size={18} color={colors.grayText} />
        <Text style={styles.clearBtnText}>Limpar filtros</Text>
      </Pressable>
    </View>
  );

  const empty = (
    <EmptyState
      eva="hero"
      title={search || activeFilterCount ? "Nenhum resultado para estes filtros" : "Nenhuma pesagem registrada ainda"}
      message={
        search || activeFilterCount ? 'Ajuste a busca ou limpe os filtros para consultar outros registros.' : canCreateWeighing
          ? isDesktop
            ? 'A Eva está pronta! Use o botão "Nova pesagem" para registrar a primeira.'
            : 'A Eva está pronta! Toque no botão + para registrar a primeira pesagem.'
          : 'Ainda não há pesagens para visualizar.'
      }
    />
  );

  return (
    <View style={styles.container}>
      <Header
        eyebrow="Pesagens"
        title="Central de pesagens"
        subtitle={isDesktop ? `${items.length} ${items.length === 1 ? "registro" : "registros"}` : `${items.length} pesagem(ns) encontrada(s)`}
        right={
          isDesktop ? (
            <View style={webStyles.headerActions}>
              <Button
                title={activeFilterCount > 0 ? `Filtros (${activeFilterCount})` : 'Filtros'}
                icon="options-outline"
                variant="outline"
                fullWidth={false}
                onPress={() => setShowFilters((s) => !s)}
              />
              {canCreateWeighing && (
                <Button
                  title="Nova pesagem"
                  icon="add"
                  fullWidth={false}
                  onPress={() => navigation.navigate('WeighingForm')}
                />
              )}
            </View>
          ) : (
            <Pressable onPress={() => setShowFilters((s) => !s)} hitSlop={10} style={styles.filterBtn}>
              <Ionicons name="options-outline" size={22} color={colors.white} />
              {activeFilterCount > 0 && (
                <View style={styles.filterDot}>
                  <Text style={styles.filterDotText}>{activeFilterCount}</Text>
                </View>
              )}
            </Pressable>
          )
        }
      />

      <View style={isDesktop ? webStyles.searchBar : styles.searchBar}>
        {/* A lupa dentro do campo evita um rótulo "Buscar" acima dele, que
            empurraria a lista para baixo em todas as telas. */}
        <View style={styles.searchField}>
          <Ionicons name="search" size={16} color={colors.textSoft} style={styles.searchIcon} />
          <Input
            placeholder="Buscar por resíduo, unidade, operador..."
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => load()}
            returnKeyType="search"
            style={styles.searchInput}
          />
          {search ? (
            <Pressable
              onPress={() => setSearch('')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Limpar busca"
              style={styles.searchClear}
            >
              <Ionicons name="close-circle" size={16} color={colors.textSoft} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {showFilters &&
        (isDesktop ? (
          filtersPanel
        ) : (
          <ScrollView
            style={styles.filtersScroll}
            contentContainerStyle={{ paddingBottom: spacing.sm }}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {filtersPanel}
          </ScrollView>
        ))}

      {loading ? (
        <Loading message="Carregando pesagens..." />
      ) : isDesktop ? (
        <ScrollView contentContainerStyle={webStyles.list}>
          <WeighingTable items={items.slice(page * pageSize, (page + 1) * pageSize)} onOpen={openWeighing} empty={empty} />
          <View style={webStyles.pager}>
            <Text style={webStyles.pagerText}>
              {items.length} {items.length === 1 ? 'registro' : 'registros'} · página {page + 1} de {Math.max(1, Math.ceil(items.length / pageSize))}
            </Text>
            <View style={webStyles.pagerActions}>
              <Button title="Anterior" icon="chevron-back" variant="outline" fullWidth={false} disabled={page === 0} onPress={() => setPage(p => p - 1)} />
              <Button title="Próxima" variant="outline" fullWidth={false} disabled={(page + 1) * pageSize >= items.length} onPress={() => setPage(p => p + 1)} />
            </View>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          // O FlatList exige remontar ao mudar o número de colunas.
          key={`cols-${columns}`}
          data={items}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? webStyles.row : undefined}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            isDesktop ? webStyles.list : styles.list,
            !isDesktop && { paddingBottom: 100 + insets.bottom },
          ]}
          onRefresh={() => load()}
          refreshing={false}
          ListEmptyComponent={empty}
          renderItem={({ item }) => <WeighingCard item={item} onPress={() => openWeighing(item.id)} />}
        />
      )}

      {/* No celular o botão flutuante; no site ele vive no cabeçalho. */}
      {canCreateWeighing && !isDesktop && (
        <Pressable
          style={[
            styles.fab,
            gradient(gradients.brand, colors.brand[700]),
            elevation('lg'),
            { bottom: spacing.xl + insets.bottom },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Nova pesagem"
          onPress={() => navigation.navigate('WeighingForm')}
        >
          <Ionicons name="add" size={22} color={colors.white} />
          <Text style={styles.fabText}>Registrar</Text>
        </Pressable>
      )}

      <Modal visible={!!detailsId} transparent animationType="fade" onRequestClose={closeDetails}>
        <Pressable style={webStyles.modalBackdrop} onPress={closeDetails}>
          <Pressable style={[webStyles.modalCard, elevation('xl')]} onPress={(e) => e.stopPropagation()}>
            {detailsId && <WeighingDetailsView id={detailsId} onClose={closeDetails} embedded />}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  flex: { flex: 1 },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDotText: { color: colors.onAccent, fontSize: 10, fontWeight: '800' },

  searchBar: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  searchField: { justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: spacing.md, zIndex: 1 },
  searchInput: { marginBottom: 0, paddingLeft: 38 },
  searchClear: { position: 'absolute', right: spacing.md },

  filtersScroll: { marginHorizontal: spacing.lg, marginTop: spacing.sm, maxHeight: 420 },
  filters: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  filterSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  dateRow: { flexDirection: 'row', gap: spacing.md },
  dateError: { color: colors.danger, fontSize: 12, marginBottom: spacing.sm },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
    borderRadius: radius.sm,
  },
  clearBtnText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  list: { padding: spacing.lg },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    gap: 8,
    height: 54,
    borderRadius: radius.full,
    backgroundColor: colors.brand[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});

const webStyles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchBar: { paddingHorizontal: spacing.xl + 4, paddingTop: spacing.lg, maxWidth: 460 },
  filters: {
    marginHorizontal: spacing.xl + 4,
    marginTop: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    ...elevation('sm'),
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  pagerText: { color: colors.textMuted, fontSize: 13 },
  pagerActions: { flexDirection: 'row', gap: spacing.sm },
  applyWrap: { justifyContent: 'flex-end', paddingBottom: spacing.sm + 4 },
  selectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  selectCell: { minWidth: 200, flexGrow: 1, flexBasis: '30%' },
  list: {
    paddingHorizontal: spacing.xl + 4,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
    width: '100%',
    maxWidth: layout.content,
    alignSelf: 'center',
  },
  row: { gap: spacing.md },

  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'flex-end',
    justifyContent: 'center',
    padding: 0,
  },
  modalCard: {
    width: '100%',
    maxWidth: 760,
    height: '100%',
    backgroundColor: colors.surface,
    borderRadius: 0,
    overflow: 'hidden',
  },
});
