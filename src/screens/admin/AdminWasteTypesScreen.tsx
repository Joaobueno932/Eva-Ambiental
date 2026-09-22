import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { showAlert } from '@/utils/alert';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Ban from 'lucide-react-native/icons/ban';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import Download from 'lucide-react-native/icons/download';
import EllipsisVertical from 'lucide-react-native/icons/ellipsis-vertical';
import Funnel from 'lucide-react-native/icons/funnel';
import Plus from 'lucide-react-native/icons/plus';
import Search from 'lucide-react-native/icons/search';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import Trash from 'lucide-react-native/icons/trash';
import { Button, Card, Checkbox, ConfirmModal, EmptyState, Header, Input, Loading, Select, Topbar } from '@/components';
import { ActionMenu } from '@/components/ActionMenu';
import { DataTable, TableColumn } from '@/components/DataTable';
import { PageHeader } from '@/components/FormKit';
import { MetricStrip } from '@/components/Operations';
import { colors, elevation, gradient, layout, radius, spacing, transition } from '@/theme';
import { useIsDesktop, useIsWide } from '@/hooks/useLayout';
import { useAuth } from '@/contexts/AuthContext';
import { listWasteTypesWithRefs, setWasteTypeActive, WasteUsage } from '@/services/masters';
import { columnCheck } from '@/utils/columns';
import { Recipient, TreatmentType, WasteType } from '@/types';
import { formatLongDate, formatNumber, roleLabel } from '@/utils/format';
import { exportWasteTypesCsv, exportWasteTypesXlsx } from '@/utils/wasteExport';
import { WastePanel, WasteSeal, WASTE_CLASSES } from './WastePanel';

const HAZARD_FILTER = [
  { label: 'Todas as periculosidades', value: '' },
  { label: 'Perigosos', value: 'yes' },
  { label: 'Não perigosos', value: 'no' },
];
const STATUS_FILTER = [
  { label: 'Todas as situações', value: '' },
  { label: 'Ativos', value: 'active' },
  { label: 'Inativos', value: 'inactive' },
];
const CLASS_FILTER = [
  { label: 'Todas as classes', value: '' },
  ...WASTE_CLASSES.map((c) => ({ label: c, value: c })),
];
const PAGE_SIZES = [10, 25, 50].map((n) => ({ label: `${n} por página`, value: String(n) }));

type SortKey = 'code' | 'name' | 'category' | 'class' | 'treatment' | 'hazard' | 'status';
type Sort = { key: SortKey; dir: 'asc' | 'desc'; chosen: boolean };

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

function HazardPill({ hazardous }: { hazardous?: boolean }) {
  if (hazardous) {
    return (
      <View style={[styles.pill, styles.pillDotted, { backgroundColor: '#FDEBEC' }]}>
        <View style={[styles.dot, { backgroundColor: '#C0272D' }]} />
        <Text style={[styles.pillText, { color: '#C0272D' }]}>Sim</Text>
      </View>
    );
  }
  return (
    <View style={[styles.pill, styles.pillDotted, { backgroundColor: colors.surfaceSunken }]}>
      <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
      <Text style={[styles.pillText, { color: colors.textMuted }]}>Não</Text>
    </View>
  );
}

function StatusPill({ active }: { active: boolean }) {
  const tone = active ? colors.success : '#C0272D';
  return (
    <View style={[styles.pill, styles.pillDotted, { backgroundColor: active ? '#EEF8F1' : '#FDEBEC' }]}>
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <Text style={[styles.pillText, { color: tone }]}>{active ? 'Ativo' : 'Inativo'}</Text>
    </View>
  );
}

/**
 * Tipos de resíduos.
 *
 * É o cadastro que classifica o que se pesa: a categoria e a classe da NBR
 * 10004 alimentam relatórios, e o tratamento e o destinatário cadastrados
 * aqui são o que a tela de pesagem sugere. Os indicadores do topo respondem
 * quantos tipos existem, quantos são recicláveis e quantos são perigosos —
 * os perigosos em vermelho, porque é a fatia que pede atenção.
 */
export function AdminWasteTypesScreen() {
  const navigation = useNavigation<any>();
  const { profile: me, signOut } = useAuth();
  const isDesktop = useIsDesktop();
  const isWide = useIsWide();

  const [wasteTypes, setWasteTypes] = useState<WasteType[]>([]);
  const [treatments, setTreatments] = useState<TreatmentType[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [usage, setUsage] = useState<Record<string, WasteUsage>>({});
  /** Colunas que a tabela `waste_types` tem de fato — ver `columnCheck`. */
  const [dbColumns, setDbColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [hazardFilter, setHazardFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [moreFilters, setMoreFilters] = useState(false);
  // A lista abre na ordem do codigo — "RES-001, RES-002..." e a ordem que as
  // pessoas conhecem do cadastro. Um clique em RESIDUO passa para alfabetica.
  const [sort, setSort] = useState<Sort>({ key: 'code', dir: 'asc', chosen: false });
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<{ waste: WasteType | null } | null>(null);
  const [bulk, setBulk] = useState<'activate' | 'deactivate' | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toggling, setToggling] = useState<WasteType | null>(null);
  const [togglingBusy, setTogglingBusy] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listWasteTypesWithRefs();
      setWasteTypes(data.wasteTypes);
      setTreatments(data.treatments);
      setRecipients(data.recipients);
      setUsage(data.usage);
      setDbColumns(data.columns);
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao carregar tipos de resíduos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetch();
    }, [fetch])
  );

  /** Cada campo, coluna e indicador perguntam pela própria coluna no banco. */
  const can = useMemo(() => columnCheck(dbColumns), [dbColumns]);

  const treatmentName = useCallback(
    (id?: string | null) => treatments.find((t) => t.id === id)?.name ?? '',
    [treatments]
  );

  /** Indicadores do topo. */
  const summary = useMemo(() => {
    const total = wasteTypes.length;
    const active = wasteTypes.filter((w) => w.active).length;
    const recyclable = wasteTypes.filter((w) => w.category === 'Reciclável').length;
    const hazardous = wasteTypes.filter((w) => w.is_hazardous).length;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const before = wasteTypes.filter((w) => w.created_at && new Date(w.created_at) < monthStart).length;

    const share = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
    return {
      total,
      active,
      recyclable,
      hazardous,
      growth: before > 0 ? ((total - before) / before) * 100 : null,
      share,
    };
  }, [wasteTypes]);

  /**
   * Opções de categoria vindas do que está cadastrado.
   *
   * Sem a migração 0012 a coluna não existe, o filtro fica sem opção alguma e
   * por isso não é desenhado — um filtro vazio é um controle decorativo.
   */
  const categoryOptions = useMemo(() => {
    const values = Array.from(new Set(wasteTypes.map((w) => w.category).filter(Boolean) as string[]));
    values.sort(collator.compare);
    return [{ label: 'Todas as categorias', value: '' }, ...values.map((v) => ({ label: v, value: v }))];
  }, [wasteTypes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    const rows = wasteTypes.filter((w) => {
      if (q) {
        const haystack = [w.name, w.code, w.description, w.category, treatmentName(w.default_treatment_id)]
          .filter(Boolean).join(' ').toLocaleLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (categoryFilter && w.category !== categoryFilter) return false;
      if (classFilter && w.waste_class !== classFilter) return false;
      if (hazardFilter && (hazardFilter === 'yes') !== !!w.is_hazardous) return false;
      if (statusFilter && (statusFilter === 'active') !== w.active) return false;
      return true;
    });

    const dir = sort.dir === 'asc' ? 1 : -1;
    const compare = (a: WasteType, b: WasteType): number => {
      switch (sort.key) {
        case 'code': return collator.compare(a.code ?? a.name, b.code ?? b.name);
        case 'name': return collator.compare(a.name, b.name);
        case 'category': return collator.compare(a.category ?? '', b.category ?? '');
        case 'class': return collator.compare(a.waste_class ?? '', b.waste_class ?? '');
        case 'treatment': return collator.compare(treatmentName(a.default_treatment_id), treatmentName(b.default_treatment_id));
        case 'hazard': return Number(!!b.is_hazardous) - Number(!!a.is_hazardous);
        case 'status': return Number(b.active) - Number(a.active);
      }
    };
    // Código como critério de desempate: numa lista de cadastro ele é a
    // ordem que as pessoas conhecem ("RES-001, RES-002...").
    return rows.sort((a, b) => compare(a, b) * dir || collator.compare(a.code ?? a.name, b.code ?? b.name));
  }, [wasteTypes, treatmentName, search, categoryFilter, classFilter, hazardFilter, statusFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const from = (currentPage - 1) * pageSize;
  const visible = filtered.slice(from, from + pageSize);

  const toggleSort = (key: SortKey) => {
    setSort((st) => (st.key === key && st.chosen
      ? { key, dir: st.dir === 'asc' ? 'desc' : 'asc', chosen: true }
      : { key, dir: 'asc', chosen: true }));
    setPage(1);
  };

  const resetFilters = () => {
    setSearch('');
    setCategoryFilter('');
    setHazardFilter('');
    setStatusFilter('');
    setClassFilter('');
    setPage(1);
  };

  const allSelected = visible.length > 0 && visible.every((w) => selected.has(w.id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) visible.forEach((w) => next.delete(w.id));
      else visible.forEach((w) => next.add(w.id));
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runBulk = async () => {
    if (!bulk) return;
    setBulkBusy(true);
    try {
      await Promise.all(
        wasteTypes.filter((w) => selected.has(w.id)).map((w) => setWasteTypeActive(w.id, bulk === 'activate'))
      );
      setBulk(null);
      setSelected(new Set());
      await fetch();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao alterar os tipos selecionados.');
    } finally {
      setBulkBusy(false);
    }
  };

  const confirmToggle = async () => {
    if (!toggling) return;
    setTogglingBusy(true);
    try {
      await setWasteTypeActive(toggling.id, !toggling.active);
      setToggling(null);
      await fetch();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao alterar a situação do tipo de resíduo.');
    } finally {
      setTogglingBusy(false);
    }
  };

  const exportAs = async (type: 'csv' | 'xlsx') => {
    try {
      const rows = filtered.map((w) => ({
        waste: w,
        treatment: treatmentName(w.default_treatment_id),
        recipient: recipients.find((r) => r.id === w.suggested_recipient_id)?.name ?? '',
        usage: usage[w.id] ?? null,
      }));
      if (type === 'csv') await exportWasteTypesCsv(rows);
      else await exportWasteTypesXlsx(rows);
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao exportar tipos de resíduos.');
    }
  };

  const sortProps = (key: SortKey) => ({
    onSort: () => toggleSort(key),
    sort: sort.chosen && sort.key === key ? sort.dir : null,
  });

  const columns: TableColumn<WasteType>[] = [
    {
      key: 'check', label: '', flex: 0.49,
      renderHeader: () => (
        <Checkbox
          checked={allSelected}
          indeterminate={!allSelected && someSelected}
          onToggle={toggleAll}
          disabled={visible.length === 0}
          label="Selecionar todos os tipos da página"
        />
      ),
      render: (w) => (
        <Checkbox checked={selected.has(w.id)} onToggle={() => toggleOne(w.id)} label={`Selecionar ${w.name}`} />
      ),
    },
    {
      key: 'name', label: 'Resíduo', flex: 2.45, ...sortProps('name'),
      // O nome é o alvo acessível da linha: dá para chegar nele por teclado,
      // enquanto o clique em qualquer ponto da linha é atalho de mouse.
      render: (w) => (
        <Pressable
          onPress={() => setPanel({ waste: w })}
          accessibilityRole="button"
          accessibilityLabel={`Abrir detalhes de ${w.name}`}
          style={({ hovered }: any) => [styles.nameCell, transition('opacity'), hovered && styles.nameCellHover]}
        >
          <WasteSeal waste={w} />
          <View style={styles.nameBlock}>
            <Text style={styles.name} numberOfLines={1}>{w.name}</Text>
            {w.code ? <Text style={styles.code} numberOfLines={1}>{w.code}</Text> : null}
          </View>
        </Pressable>
      ),
    },
    {
      key: 'category', label: 'Categoria', flex: 1.17, ...sortProps('category'),
      render: (w) => <Text style={styles.cellText} numberOfLines={2}>{w.category || '—'}</Text>,
    },
    {
      key: 'class', label: 'Classe', flex: 1.17, ...sortProps('class'),
      render: (w) => <Text style={styles.cellText} numberOfLines={2}>{w.waste_class || '—'}</Text>,
    },
    {
      key: 'treatment', label: 'Destinação sugerida', flex: 1.82, ...sortProps('treatment'),
      render: (w) => <Text style={styles.cellText} numberOfLines={2}>{treatmentName(w.default_treatment_id) || '—'}</Text>,
    },
    { key: 'hazard', label: 'Perigoso', flex: 1.1, ...sortProps('hazard'), render: (w) => <HazardPill hazardous={w.is_hazardous} /> },
    { key: 'status', label: 'Situação', flex: 1.2, ...sortProps('status'), render: (w) => <StatusPill active={w.active} /> },
    {
      key: 'actions', label: 'Ações', flex: 0.6,
      render: (w) => (
        <ActionMenu
          accessibilityLabel={`Mais ações para ${w.name}`}
          actions={[
            { label: 'Abrir detalhes', icon: SlidersHorizontal, onPress: () => setPanel({ waste: w }) },
            w.active
              ? { label: 'Desativar tipo', icon: Ban, destructive: true, onPress: () => setToggling(w) }
              : { label: 'Ativar tipo', icon: CircleCheck, onPress: () => setToggling(w) },
          ]}
          renderTrigger={(open) => (
            <Pressable
              onPress={open}
              accessibilityRole="button"
              accessibilityLabel={`Mais ações para ${w.name}`}
              style={({ hovered }: any) => [styles.kebab, transition(), hovered && styles.kebabHover]}
            >
              <EllipsisVertical size={18} strokeWidth={2} color={colors.text} />
            </Pressable>
          )}
        />
      ),
    },
  ];

  const footer = (
    <View style={styles.footer}>
      <Text style={styles.footerText}>
        {filtered.length === 0
          ? 'Nenhum tipo de resíduo para mostrar'
          : `Mostrando ${from + 1} a ${Math.min(from + pageSize, filtered.length)} de ${filtered.length} ${filtered.length === 1 ? 'tipo de resíduo' : 'tipos de resíduos'}`}
      </Text>
      <View style={styles.footerRight}>
        <View style={styles.pager}>
          <Pressable
            onPress={() => setPage(currentPage - 1)}
            disabled={currentPage <= 1}
            accessibilityRole="button"
            accessibilityLabel="Página anterior"
            style={({ hovered }: any) => [styles.pagerStep, transition(), hovered && currentPage > 1 && styles.kebabHover, currentPage <= 1 && styles.pagerOff]}
          >
            <ChevronLeft size={18} strokeWidth={2} color={colors.text} />
          </Pressable>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <Pressable
              key={n}
              onPress={() => setPage(n)}
              accessibilityRole="button"
              accessibilityLabel={`Página ${n}`}
              accessibilityState={{ selected: n === currentPage }}
              style={({ hovered }: any) => [styles.pageNumber, n === currentPage && styles.pageNumberOn, transition(), hovered && n !== currentPage && styles.kebabHover]}
            >
              <Text style={[styles.pageNumberText, n === currentPage && styles.pageNumberTextOn]}>{n}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => setPage(currentPage + 1)}
            disabled={currentPage >= pageCount}
            accessibilityRole="button"
            accessibilityLabel="Próxima página"
            style={({ hovered }: any) => [styles.pagerStep, transition(), hovered && currentPage < pageCount && styles.kebabHover, currentPage >= pageCount && styles.pagerOff]}
          >
            <ChevronRight size={18} strokeWidth={2} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.pageSizeSelect}>
          <Select options={PAGE_SIZES} value={String(pageSize)} onChange={(v) => { setPageSize(Number(v)); setPage(1); }} />
        </View>
        {/* Exporta a lista filtrada — é a que se tem na frente. */}
        <ActionMenu
          accessibilityLabel="Exportar lista"
          actions={[
            { label: 'Exportar em CSV', icon: Download, onPress: () => exportAs('csv') },
            { label: 'Exportar em Excel (XLSX)', icon: Download, onPress: () => exportAs('xlsx') },
          ]}
          renderTrigger={(open) => (
            <Pressable
              onPress={open}
              accessibilityRole="button"
              accessibilityLabel="Exportar lista"
              style={({ hovered }: any) => [styles.exportButton, transition(), hovered && styles.kebabHover]}
            >
              <Download size={17} strokeWidth={2} color={colors.text} />
              <Text style={styles.exportText}>Exportar</Text>
            </Pressable>
          )}
        />
      </View>
    </View>
  );

  return (
    <View style={[styles.container, isDesktop && gradient(PAGE_TOP, colors.pageBg)]}>
      {isDesktop ? (
        <Topbar
          plain
          crumbs={[
            { label: 'Painel', onPress: () => navigation.getParent()?.navigate('Painel') },
            { label: 'Administração', onPress: () => navigation.navigate('AdminHub') },
            { label: 'Tipos de Resíduos' },
          ]}
          userName={me?.full_name}
          userRole={roleLabel[me?.role ?? 'viewer']}
          onUser={() => navigation.navigate('ProfileHome')}
          onNotifications={() => navigation.getParent()?.navigate('Pesagens', { screen: 'WeighingsList' })}
          onSignOut={signOut}
        />
      ) : (
        <Header title="Tipos de Resíduos" subtitle="Classificação dos resíduos" onBack={() => navigation.goBack()} />
      )}

      <View style={styles.split}>
        <ScrollView contentContainerStyle={isDesktop ? styles.deskScroll : styles.list}>
          {isDesktop ? (
            <PageHeader
              // Mesmo glifo do item no menu: a página e o menu não podem usar
              // símbolos diferentes para a mesma coisa.
              seal={<Trash size={30} strokeWidth={2} color={colors.form.tileIcon} />}
              title="Tipos de Resíduos"
              titleSize={34}
              subtitle="Classificação dos resíduos cadastrados"
              right={
                <View style={styles.headerRight}>
                  <View style={styles.todayRow}>
                    <Ionicons name="calendar-outline" size={15} color={colors.form.muted} />
                    <Text style={styles.today}>{formatLongDate()}</Text>
                  </View>
                  <Button
                    title="Novo tipo de resíduo"
                    variant="cta"
                    size="lg"
                    iconComponent={Plus}
                    fullWidth={false}
                    onPress={() => setPanel({ waste: null })}
                    style={styles.newButton}
                  />
                </View>
              }
            />
          ) : null}

          <MetricStrip items={[
            {
              label: 'Total de tipos', value: formatNumber(summary.total), icon: 'trash-outline',
              ...deltaProps(summary.growth),
            },
            {
              label: 'Tipos ativos', value: formatNumber(summary.active), icon: 'ellipse',
              tone: colors.success, delta: `${summary.share(summary.active)}%`, deltaDirection: 'flat', deltaLabel: 'do total',
            },
            // Sem a migração 0012 não há coluna de categoria nem de
            // periculosidade: "0 recicláveis" seria uma afirmação sobre o
            // cadastro, quando o que falta é a coluna.
            {
              label: 'Recicláveis', value: can('category') ? formatNumber(summary.recyclable) : '—',
              valueSize: can('category') ? undefined : 22,
              icon: 'refresh-circle-outline', tone: '#2E7D32',
              ...(can('category')
                ? { delta: `${summary.share(summary.recyclable)}%`, deltaDirection: 'flat' as const, deltaLabel: 'do total' }
                : { hint: 'Disponível após a migração 0012' }),
            },
            // A fatia perigosa em vermelho: não é variação, é a parte do
            // cadastro que exige manejo especial.
            {
              label: 'Perigosos', value: can('is_hazardous') ? formatNumber(summary.hazardous) : '—',
              valueSize: can('is_hazardous') ? undefined : 22,
              icon: 'warning-outline', tone: colors.danger,
              ...(can('is_hazardous')
                ? {
                    delta: `${summary.share(summary.hazardous)}%`,
                    deltaDirection: 'flat' as const,
                    deltaTone: summary.hazardous > 0 ? '#C0272D' : undefined,
                    deltaLabel: 'do total',
                  }
                : { hint: 'Disponível após a migração 0012' }),
            },
          ]} />

          {/* ── Filtros ───────────────────────────────────────────────── */}
          <View style={[styles.card, elevation('sm')]}>
            <View style={isDesktop ? styles.filterRow : undefined}>
              <View style={isDesktop ? styles.searchCell : undefined}>
                <Input
                  size="form"
                  placeholder="Buscar resíduos por nome, código ou descrição..."
                  leftIconComponent={Search}
                  value={search}
                  onChangeText={(v) => { setSearch(v); setPage(1); }}
                />
              </View>
              {categoryOptions.length > 1 ? (
                <View style={isDesktop ? styles.filterCell : undefined}>
                  <Select size="form" options={categoryOptions} value={categoryFilter}
                    onChange={(v) => { setCategoryFilter(v); setPage(1); }} />
                </View>
              ) : null}
              <View style={isDesktop ? styles.filterCell : undefined}>
                <Select size="form" options={HAZARD_FILTER} value={hazardFilter}
                  onChange={(v) => { setHazardFilter(v); setPage(1); }} />
              </View>
              <View style={isDesktop ? styles.filterCell : undefined}>
                <Select size="form" options={STATUS_FILTER} value={statusFilter}
                  onChange={(v) => { setStatusFilter(v); setPage(1); }} />
              </View>
              <View style={isDesktop ? styles.filterActions : undefined}>
                <Button
                  title="Mais filtros"
                  variant="outline"
                  iconComponent={Funnel}
                  fullWidth={!isDesktop}
                  onPress={() => setMoreFilters((v) => !v)}
                  style={styles.filterButton}
                />
              </View>
            </View>

            {moreFilters ? (
              <View style={isDesktop ? styles.moreRow : undefined}>
                <View style={isDesktop ? styles.filterCellWide : undefined}>
                  <Select size="form" label="Classe (NBR 10004)" options={CLASS_FILTER} value={classFilter}
                    onChange={(v) => { setClassFilter(v); setPage(1); }} />
                </View>
                <View style={isDesktop ? styles.filterActions : undefined}>
                  <Button title="Limpar filtros" variant="ghost" fullWidth={!isDesktop} onPress={resetFilters} style={styles.filterButton} />
                </View>
              </View>
            ) : null}
          </View>

          {/* ── Lista ─────────────────────────────────────────────────── */}
          {loading ? (
            <Loading />
          ) : isDesktop ? (
            <View style={[styles.card, styles.tableCard, elevation('sm')]}>
              {someSelected ? (
                <View style={styles.bulkBar}>
                  <Text style={styles.bulkText}>
                    {selected.size} {selected.size === 1 ? 'tipo selecionado' : 'tipos selecionados'}
                  </Text>
                  <View style={styles.bulkActions}>
                    <Button title="Ativar" variant="outline" iconComponent={CircleCheck} fullWidth={false}
                      onPress={() => setBulk('activate')} style={styles.bulkButton} />
                    <Button title="Desativar" variant="dangerOutline" iconComponent={Ban} fullWidth={false}
                      onPress={() => setBulk('deactivate')} style={styles.bulkButton} />
                    <Button title="Limpar seleção" variant="ghost" fullWidth={false}
                      onPress={() => setSelected(new Set())} style={styles.bulkButton} />
                  </View>
                </View>
              ) : null}
              <DataTable
                dense
                labelSize={9.5}
                items={visible}
                keyExtractor={(w) => w.id}
                rowHeight={46}
                onRowPress={(w) => setPanel({ waste: w })}
                isRowSelected={(w) => panel?.waste?.id === w.id}
                rowLabel={(w) => `Abrir detalhes de ${w.name}`}
                empty={<EmptyState title="Nenhum tipo de resíduo encontrado" message="Ajuste a busca ou os filtros, ou cadastre um tipo." />}
                columns={columns}
              />
              {footer}
            </View>
          ) : (
            <>
              <FlatList
                scrollEnabled={false}
                data={visible}
                keyExtractor={(w) => w.id}
                ListEmptyComponent={<EmptyState icon="trash-outline" title="Nenhum tipo de resíduo" message="Ajuste a busca ou toque em + para cadastrar." />}
                renderItem={({ item }) => (
                  <Card onPress={() => setPanel({ waste: item })}>
                    <View style={styles.row}>
                      <WasteSeal waste={item} size={42} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.name, styles.nameMobile]}>{item.name}</Text>
                        <Text style={styles.mobileSub}>
                          {[item.code, item.category].filter(Boolean).join(' · ') || 'Sem classificação'}
                        </Text>
                        <View style={styles.mobilePills}>
                          <StatusPill active={item.active} />
                          {item.is_hazardous ? <HazardPill hazardous /> : null}
                        </View>
                      </View>
                    </View>
                  </Card>
                )}
              />
              {footer}
            </>
          )}
        </ScrollView>

        {/* No site o painel divide a tela com a lista; no celular cobre a tela. */}
        {panel && isWide ? (
          <View style={[styles.panelColumn, elevation('lg')]}>
            <WastePanel
              waste={panel.waste}
              treatments={treatments}
              recipients={recipients}
              usage={panel.waste ? usage[panel.waste.id] : undefined}
              can={can}
              actorId={me?.id}
              onClose={() => setPanel(null)}
              onSaved={() => { setPanel(null); fetch(); }}
            />
          </View>
        ) : null}
      </View>

      {panel && !isWide ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setPanel(null)}>
          <View style={styles.sheetBackdrop}>
            <View style={styles.sheet}>
              <WastePanel
                waste={panel.waste}
                treatments={treatments}
                recipients={recipients}
                usage={panel.waste ? usage[panel.waste.id] : undefined}
                can={can}
                actorId={me?.id}
                onClose={() => setPanel(null)}
                onSaved={() => { setPanel(null); fetch(); }}
              />
            </View>
          </View>
        </Modal>
      ) : null}

      {!isDesktop && (
        <Pressable style={styles.fab} onPress={() => setPanel({ waste: null })} accessibilityLabel="Novo tipo de resíduo">
          <Ionicons name="add" size={28} color={colors.white} />
        </Pressable>
      )}

      <ConfirmModal
        visible={!!toggling}
        title={toggling?.active ? 'Desativar tipo de resíduo?' : 'Ativar tipo de resíduo?'}
        message={
          toggling?.active
            ? `${toggling?.name} deixa de aparecer na escolha de novas pesagens. As pesagens já registradas com ele continuam nos relatórios.`
            : `${toggling?.name} volta a aparecer na escolha de resíduo das novas pesagens.`
        }
        confirmLabel={toggling?.active ? 'Desativar' : 'Ativar'}
        destructive={toggling?.active}
        loading={togglingBusy}
        onConfirm={confirmToggle}
        onCancel={() => setToggling(null)}
      />

      <ConfirmModal
        visible={!!bulk}
        title={bulk === 'activate' ? 'Ativar selecionados?' : 'Desativar selecionados?'}
        message={
          bulk === 'activate'
            ? `${selected.size} ${selected.size === 1 ? 'tipo volta' : 'tipos voltam'} a aparecer na escolha das novas pesagens.`
            : `${selected.size} ${selected.size === 1 ? 'tipo deixa' : 'tipos deixam'} de aparecer para novas pesagens. As pesagens já registradas continuam nos relatórios.`
        }
        confirmLabel={bulk === 'activate' ? 'Ativar' : 'Desativar'}
        destructive={bulk === 'deactivate'}
        loading={bulkBusy}
        onConfirm={runBulk}
        onCancel={() => setBulk(null)}
      />
    </View>
  );
}

/**
 * Variação de um indicador, com as duas ausências separadas.
 *
 * `null` é "não há mês anterior com que comparar" — diferente de uma variação
 * que deu zero, em que há comparação e ela não mudou.
 */
function deltaProps(pct: number | null) {
  if (pct === null) return { delta: '—', deltaDirection: 'flat' as const, deltaLabel: 'sem base de comparação' };
  const rounded = Math.round(pct);
  if (rounded === 0) return { delta: '0%', deltaDirection: 'flat' as const, deltaLabel: 'vs. mês anterior' };
  return {
    delta: `${rounded}%`,
    deltaDirection: (rounded > 0 ? 'up' : 'down') as 'up' | 'down',
    deltaLabel: 'vs. mês anterior',
  };
}

/** Topo um tom mais claro que o fundo, sem faixa nem linha — como nas demais telas. */
const PAGE_TOP = `linear-gradient(180deg, #FAFBFC 0px, #FAFBFC 150px, ${colors.pageBg} 260px)`;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  split: { flex: 1, flexDirection: 'row' },
  list: { padding: spacing.lg, paddingBottom: 120, width: '100%', maxWidth: layout.content, alignSelf: 'center' },
  deskScroll: { paddingHorizontal: 22, paddingTop: 6, paddingBottom: spacing.xxl },

  headerRight: { alignItems: 'flex-end', gap: 14 },
  todayRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  today: { color: colors.form.muted, fontSize: 14 },
  newButton: { minHeight: 50, paddingHorizontal: 24 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F1',
    padding: 20,
    marginBottom: 18,
  },
  tableCard: { padding: 0, overflow: 'hidden' },

  // Os campos de formulário trazem 22px de margem inferior; na faixa de
  // filtros ela só aumentaria o cartão, então a linha a devolve.
  filterRow: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: -22 },
  moreRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 22, marginBottom: -22 },
  searchCell: { flex: 1.9, minWidth: 220 },
  // 240px é o mínimo que cabe "Todas as periculosidades" sem cortar; abaixo
  // disso o rótulo do filtro vira reticências e deixa de dizer o que filtra.
  filterCell: { flex: 1, minWidth: 240, maxWidth: 320 },
  filterCellWide: { flex: 1.2, minWidth: 200 },
  filterActions: { paddingBottom: 22 },
  filterButton: { minHeight: 50, paddingHorizontal: 20, borderRadius: 8 },

  bulkBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
    backgroundColor: colors.brand[50], borderBottomWidth: 1, borderBottomColor: colors.greenLine,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  bulkText: { fontSize: 14, fontWeight: '600', color: colors.brand[700] },
  bulkActions: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  bulkButton: { minHeight: 38, paddingHorizontal: 16, borderRadius: 8 },

  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameCellHover: { opacity: 0.8 },
  nameBlock: { flex: 1, minWidth: 0 },
  code: { fontSize: 11, color: colors.form.soft, marginTop: 1, fontVariant: ['tabular-nums'] },
  cellText: { fontSize: 12, color: '#45586B', lineHeight: 16 },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  pillDotted: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  pillText: { fontSize: 11.5, fontWeight: '700' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  kebab: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  kebabHover: { backgroundColor: colors.surfaceSunken },

  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14,
    paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: colors.form.divider,
  },
  footerText: { fontSize: 14, color: colors.form.muted },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  pager: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pagerStep: {
    width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  pagerOff: { opacity: 0.4 },
  pageNumber: {
    minWidth: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  pageNumberOn: { backgroundColor: colors.form.action, borderColor: colors.form.action },
  pageNumberText: { fontSize: 14.5, fontWeight: '600', color: colors.text },
  pageNumberTextOn: { color: colors.white },
  pageSizeSelect: { width: 154, marginBottom: -spacing.md },
  exportButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 40, paddingHorizontal: 16, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  exportText: { fontSize: 14, fontWeight: '600', color: colors.text },

  /** Painel lateral: largura fixa, como no desenho. */
  panelColumn: {
    width: 432,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    backgroundColor: colors.surface,
  },
  sheetBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    maxHeight: '92%',
    overflow: 'hidden',
  },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mobileSub: { color: colors.textMuted, fontSize: 12.5, marginTop: 1 },
  mobilePills: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  // O cartão do celular tem a largura toda: nada obriga o nome a ser tão
  // pequeno quanto na célula da tabela.
  nameMobile: { fontSize: 15 },
  name: { fontSize: 12.5, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute', right: spacing.lg, bottom: spacing.xl, width: 56, height: 56,
    borderRadius: radius.full, backgroundColor: colors.brand[700],
    alignItems: 'center', justifyContent: 'center',
    ...elevation('lg'),
  },
});
