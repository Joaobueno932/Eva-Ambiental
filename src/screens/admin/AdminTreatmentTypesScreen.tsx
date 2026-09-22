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
import Recycle from 'lucide-react-native/icons/recycle';
import Search from 'lucide-react-native/icons/search';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import { Button, Card, Checkbox, ConfirmModal, EmptyState, Header, Input, Loading, Select, Topbar } from '@/components';
import { ActionMenu } from '@/components/ActionMenu';
import { DataTable, TableColumn } from '@/components/DataTable';
import { PageHeader } from '@/components/FormKit';
import { MetricStrip } from '@/components/Operations';
import { colors, elevation, gradient, layout, radius, spacing, transition } from '@/theme';
import { useIsDesktop, useIsWide } from '@/hooks/useLayout';
import { useAuth } from '@/contexts/AuthContext';
import { listTreatmentTypesWithUsage, setTreatmentActive, TreatmentUsage } from '@/services/masters';
import { columnCheck } from '@/utils/columns';
import { TreatmentType } from '@/types';
import { formatAccess, formatLongDate, formatNumber, formatWeightShort, roleLabel, treatmentDiversionFactor } from '@/utils/format';
import { exportTreatmentsCsv, exportTreatmentsXlsx } from '@/utils/treatmentExport';
import { TreatmentPanel, TreatmentSeal } from './TreatmentPanel';

const STATUS_FILTER = [
  { label: 'Todas as situações', value: '' },
  { label: 'Ativos', value: 'active' },
  { label: 'Inativos', value: 'inactive' },
];
const DIVERSION_FILTER = [
  { label: 'Todos os desvios', value: '' },
  { label: 'Com desvio de aterro', value: 'yes' },
  { label: 'Sem desvio de aterro', value: 'no' },
];
/** Filtro extra: tratamento que já foi usado em alguma pesagem. */
const USAGE_FILTER = [
  { label: 'Usados ou não', value: '' },
  { label: 'Já utilizados', value: 'used' },
  { label: 'Nunca utilizados', value: 'unused' },
];
const PAGE_SIZES = [10, 25, 50].map((n) => ({ label: `${n} por página`, value: String(n) }));

type SortKey = 'name' | 'category' | 'diversion' | 'application' | 'status' | 'updated' | 'usage';
type Sort = { key: SortKey; dir: 'asc' | 'desc'; chosen: boolean };

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/** Desvio de aterro em pílula: o fator manda, e ele pode ser parcial. */
function DiversionPill({ treatment }: { treatment: TreatmentType }) {
  const factor = treatmentDiversionFactor(treatment);
  if (factor === 0) {
    return (
      <View style={[styles.pill, { backgroundColor: '#FDEBEC' }]}>
        <Text style={[styles.pillText, { color: '#C0272D' }]}>Não</Text>
      </View>
    );
  }
  return (
    <View style={[styles.pill, { backgroundColor: '#E7F5E9' }]}>
      <Text style={[styles.pillText, { color: '#15803D' }]}>
        {factor === 1 ? 'Sim' : `${Math.round(factor * 100)}%`}
      </Text>
    </View>
  );
}

function StatusPill({ active }: { active: boolean }) {
  const tone = active ? colors.success : colors.pendingRing;
  return (
    <View style={[styles.pill, styles.pillDotted, { backgroundColor: active ? '#EEF8F1' : '#FDF4E3' }]}>
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <Text style={[styles.pillText, { color: tone }]}>{active ? 'Ativo' : 'Inativo'}</Text>
    </View>
  );
}

/**
 * Tipos de tratamento.
 *
 * É a tela que define a taxa de desvio de aterro do sistema inteiro: o que se
 * marca aqui decide quanto de cada pesagem conta como desviado. Por isso os
 * indicadores mostram quantos tratamentos desviam e qual deles recebe mais
 * peso, e o painel diz, em número, o efeito de cada configuração.
 */
export function AdminTreatmentTypesScreen() {
  const navigation = useNavigation<any>();
  const { profile: me, signOut } = useAuth();
  const isDesktop = useIsDesktop();
  const isWide = useIsWide();

  const [treatments, setTreatments] = useState<TreatmentType[]>([]);
  const [usage, setUsage] = useState<Record<string, TreatmentUsage>>({});
  /** Colunas que a tabela `treatment_types` tem de fato — ver `columnCheck`. */
  const [dbColumns, setDbColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [diversionFilter, setDiversionFilter] = useState('');
  const [usageFilter, setUsageFilter] = useState('');
  const [moreFilters, setMoreFilters] = useState(false);
  const [sort, setSort] = useState<Sort>({ key: 'updated', dir: 'desc', chosen: false });
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<{ treatment: TreatmentType | null } | null>(null);
  const [bulk, setBulk] = useState<'activate' | 'deactivate' | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toggling, setToggling] = useState<TreatmentType | null>(null);
  const [togglingBusy, setTogglingBusy] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listTreatmentTypesWithUsage();
      setTreatments(data.treatments);
      setUsage(data.usage);
      setDbColumns(data.columns);
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao carregar tratamentos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetch();
    }, [fetch])
  );

  /** Cada campo e cada coluna perguntam pela própria coluna no banco. */
  const can = useMemo(() => columnCheck(dbColumns), [dbColumns]);

  /** Indicadores do topo. */
  const summary = useMemo(() => {
    const total = treatments.length;
    const active = treatments.filter((t) => t.active).length;
    const diverting = treatments.filter((t) => treatmentDiversionFactor(t) > 0).length;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const before = treatments.filter((t) => t.created_at && new Date(t.created_at) < monthStart).length;

    // Mais utilizado: o tratamento com mais peso acumulado. Sem pesagem
    // nenhuma não há "mais utilizado" — e inventar o primeiro da lista seria
    // apresentar a ordem alfabética como se fosse uso.
    let top: { name: string; kg: number } | null = null;
    for (const t of treatments) {
      const kg = usage[t.id]?.kg ?? 0;
      if (kg > 0 && (!top || kg > top.kg)) top = { name: t.name, kg };
    }

    const share = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
    return {
      total,
      active,
      diverting,
      top,
      growth: before > 0 ? ((total - before) / before) * 100 : null,
      share,
    };
  }, [treatments, usage]);

  /**
   * Opções de categoria vindas do que está cadastrado.
   *
   * Sem a migração 0011 a coluna não existe, o filtro fica sem opção alguma e
   * por isso não é desenhado — um filtro vazio é um controle decorativo.
   */
  const categoryOptions = useMemo(() => {
    const values = Array.from(new Set(treatments.map((t) => t.category).filter(Boolean) as string[]));
    values.sort(collator.compare);
    return [{ label: 'Todas as categorias', value: '' }, ...values.map((v) => ({ label: v, value: v }))];
  }, [treatments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    const rows = treatments.filter((t) => {
      if (q) {
        const haystack = [t.name, t.category, t.description, t.application]
          .filter(Boolean).join(' ').toLocaleLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (statusFilter && (statusFilter === 'active') !== t.active) return false;
      if (diversionFilter) {
        const diverts = treatmentDiversionFactor(t) > 0;
        if ((diversionFilter === 'yes') !== diverts) return false;
      }
      if (usageFilter) {
        const used = (usage[t.id]?.weighings ?? 0) > 0;
        if ((usageFilter === 'used') !== used) return false;
      }
      return true;
    });

    const dir = sort.dir === 'asc' ? 1 : -1;
    const compare = (a: TreatmentType, b: TreatmentType): number => {
      switch (sort.key) {
        case 'name': return collator.compare(a.name, b.name);
        case 'category': return collator.compare(a.category ?? '', b.category ?? '');
        case 'diversion': return treatmentDiversionFactor(b) - treatmentDiversionFactor(a);
        case 'application': return collator.compare(a.application ?? '', b.application ?? '');
        case 'status': return Number(b.active) - Number(a.active);
        case 'usage': return (usage[a.id]?.kg ?? 0) - (usage[b.id]?.kg ?? 0);
        case 'updated': return (a.updated_at ?? a.created_at ?? '').localeCompare(b.updated_at ?? b.created_at ?? '');
      }
    };
    return rows.sort((a, b) => compare(a, b) * dir || collator.compare(a.name, b.name));
  }, [treatments, usage, search, categoryFilter, statusFilter, diversionFilter, usageFilter, sort]);

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
    setStatusFilter('');
    setDiversionFilter('');
    setUsageFilter('');
    setPage(1);
  };

  const allSelected = visible.length > 0 && visible.every((t) => selected.has(t.id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) visible.forEach((t) => next.delete(t.id));
      else visible.forEach((t) => next.add(t.id));
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
        treatments.filter((t) => selected.has(t.id)).map((t) => setTreatmentActive(t.id, bulk === 'activate'))
      );
      setBulk(null);
      setSelected(new Set());
      await fetch();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao alterar os tratamentos selecionados.');
    } finally {
      setBulkBusy(false);
    }
  };

  const confirmToggle = async () => {
    if (!toggling) return;
    setTogglingBusy(true);
    try {
      await setTreatmentActive(toggling.id, !toggling.active);
      setToggling(null);
      await fetch();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao alterar a situação do tratamento.');
    } finally {
      setTogglingBusy(false);
    }
  };

  const exportAs = async (type: 'csv' | 'xlsx') => {
    try {
      const rows = filtered.map((t) => ({ treatment: t, usage: usage[t.id] ?? null }));
      if (type === 'csv') await exportTreatmentsCsv(rows);
      else await exportTreatmentsXlsx(rows);
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao exportar tratamentos.');
    }
  };

  const sortProps = (key: SortKey) => ({
    onSort: () => toggleSort(key),
    sort: sort.chosen && sort.key === key ? sort.dir : null,
  });

  const columns: TableColumn<TreatmentType>[] = [
    {
      key: 'check', label: '', flex: 0.45,
      renderHeader: () => (
        <Checkbox
          checked={allSelected}
          indeterminate={!allSelected && someSelected}
          onToggle={toggleAll}
          disabled={visible.length === 0}
          label="Selecionar todos os tratamentos da página"
        />
      ),
      render: (t) => (
        <Checkbox checked={selected.has(t.id)} onToggle={() => toggleOne(t.id)} label={`Selecionar ${t.name}`} />
      ),
    },
    {
      key: 'name', label: 'Tratamento', flex: 1.95, ...sortProps('name'),
      // O nome é o alvo acessível da linha: dá para chegar nele por teclado,
      // enquanto o clique em qualquer ponto da linha é atalho de mouse.
      render: (t) => (
        <Pressable
          onPress={() => setPanel({ treatment: t })}
          accessibilityRole="button"
          accessibilityLabel={`Abrir detalhes de ${t.name}`}
          style={({ hovered }: any) => [styles.nameCell, transition('opacity'), hovered && styles.nameCellHover]}
        >
          <TreatmentSeal category={t.category} />
          <Text style={styles.name} numberOfLines={2}>{t.name}</Text>
        </Pressable>
      ),
    },
    {
      key: 'category', label: 'Categoria', flex: 1.53, ...sortProps('category'),
      render: (t) => <Text style={styles.cellText} numberOfLines={2}>{t.category || '—'}</Text>,
    },
    {
      key: 'diversion', label: 'Desvio de aterro', flex: 1.17, ...sortProps('diversion'),
      render: (t) => <DiversionPill treatment={t} />,
    },
    {
      key: 'application', label: 'Aplicação', flex: 1.58, ...sortProps('application'),
      render: (t) => <Text style={styles.cellText} numberOfLines={2}>{t.application || '—'}</Text>,
    },
    { key: 'status', label: 'Situação', flex: 1.11, ...sortProps('status'), render: (t) => <StatusPill active={t.active} /> },
    {
      // Sem a migração 0011 não há `updated_at`: a coluna então diz o que de
      // fato mostra, a data do cadastro.
      key: 'updated', label: can('updated_at') ? 'Última atualização' : 'Cadastrado em', flex: 1.6, ...sortProps('updated'),
      render: (t) => (
        <Text style={styles.cellText} numberOfLines={1}>
          {formatAccess(can('updated_at') ? t.updated_at ?? t.created_at : t.created_at) ?? '—'}
        </Text>
      ),
    },
    {
      key: 'actions', label: 'Ações', flex: 0.6,
      render: (t) => (
        <ActionMenu
          accessibilityLabel={`Mais ações para ${t.name}`}
          actions={[
            { label: 'Abrir detalhes', icon: SlidersHorizontal, onPress: () => setPanel({ treatment: t }) },
            t.active
              ? { label: 'Desativar tratamento', icon: Ban, destructive: true, onPress: () => setToggling(t) }
              : { label: 'Ativar tratamento', icon: CircleCheck, onPress: () => setToggling(t) },
          ]}
          renderTrigger={(open) => (
            <Pressable
              onPress={open}
              accessibilityRole="button"
              accessibilityLabel={`Mais ações para ${t.name}`}
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
          ? 'Nenhum tratamento para mostrar'
          : `Mostrando ${from + 1} a ${Math.min(from + pageSize, filtered.length)} de ${filtered.length} ${filtered.length === 1 ? 'tratamento' : 'tratamentos'}`}
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
            { label: 'Tipos de Tratamento' },
          ]}
          userName={me?.full_name}
          userRole={roleLabel[me?.role ?? 'viewer']}
          onUser={() => navigation.navigate('ProfileHome')}
          onNotifications={() => navigation.getParent()?.navigate('Pesagens', { screen: 'WeighingsList' })}
          onSignOut={signOut}
        />
      ) : (
        <Header title="Tipos de Tratamento" subtitle="Desvios de aterro" onBack={() => navigation.goBack()} />
      )}

      <View style={styles.split}>
        <ScrollView contentContainerStyle={isDesktop ? styles.deskScroll : styles.list}>
          {isDesktop ? (
            <PageHeader
              // Mesmo glifo do item no menu: a página e o menu não podem usar
              // símbolos diferentes para a mesma coisa.
              seal={<Recycle size={30} strokeWidth={2} color={colors.form.tileIcon} />}
              title="Tipos de Tratamento"
              titleSize={34}
              subtitle="Configuração dos tratamentos e desvios de aterro"
              right={
                <View style={styles.headerRight}>
                  <View style={styles.todayRow}>
                    <Ionicons name="calendar-outline" size={15} color={colors.form.muted} />
                    <Text style={styles.today}>{formatLongDate()}</Text>
                  </View>
                  <Button
                    title="Novo tratamento"
                    variant="cta"
                    size="lg"
                    iconComponent={Plus}
                    fullWidth={false}
                    onPress={() => setPanel({ treatment: null })}
                    style={styles.newButton}
                  />
                </View>
              }
            />
          ) : null}

          <MetricStrip items={[
            {
              label: 'Total de tratamentos', value: formatNumber(summary.total), icon: 'refresh-circle-outline',
              ...deltaProps(summary.growth),
            },
            {
              label: 'Ativos', value: formatNumber(summary.active), icon: 'ellipse',
              tone: colors.success, delta: `${summary.share(summary.active)}%`, deltaDirection: 'flat', deltaLabel: 'do total',
            },
            {
              label: 'Com desvio de aterro', value: formatNumber(summary.diverting), icon: 'leaf-outline',
              tone: colors.pendingRing, delta: `${summary.share(summary.diverting)}%`, deltaDirection: 'flat', deltaLabel: 'do total',
            },
            // O valor aqui é um nome, não um número: fonte menor, e a nota de
            // baixo carrega o peso que o elegeu.
            {
              label: 'Mais utilizado',
              value: summary.top?.name ?? 'Nenhum ainda',
              valueSize: summary.top ? 19 : 17,
              icon: 'stats-chart-outline',
              tone: '#2C5BB8',
              hint: summary.top ? `${formatWeightShort(summary.top.kg)} no total` : 'Nenhuma pesagem registrada',
            },
          ]} />

          {/* ── Filtros ───────────────────────────────────────────────── */}
          <View style={[styles.card, elevation('sm')]}>
            <View style={isDesktop ? styles.filterRow : undefined}>
              <View style={isDesktop ? styles.searchCell : undefined}>
                <Input
                  size="form"
                  placeholder="Buscar tratamentos por nome, categoria ou descrição..."
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
                <Select size="form" options={STATUS_FILTER} value={statusFilter}
                  onChange={(v) => { setStatusFilter(v); setPage(1); }} />
              </View>
              <View style={isDesktop ? styles.filterCell : undefined}>
                <Select size="form" options={DIVERSION_FILTER} value={diversionFilter}
                  onChange={(v) => { setDiversionFilter(v); setPage(1); }} />
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
                  <Select size="form" label="Uso em pesagens" options={USAGE_FILTER} value={usageFilter}
                    onChange={(v) => { setUsageFilter(v); setPage(1); }} />
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
                    {selected.size} {selected.size === 1 ? 'tratamento selecionado' : 'tratamentos selecionados'}
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
                keyExtractor={(t) => t.id}
                rowHeight={46}
                onRowPress={(t) => setPanel({ treatment: t })}
                isRowSelected={(t) => panel?.treatment?.id === t.id}
                rowLabel={(t) => `Abrir detalhes de ${t.name}`}
                empty={<EmptyState title="Nenhum tratamento encontrado" message="Ajuste a busca ou os filtros, ou cadastre um tratamento." />}
                columns={columns}
              />
              {footer}
            </View>
          ) : (
            <>
              <FlatList
                scrollEnabled={false}
                data={visible}
                keyExtractor={(t) => t.id}
                ListEmptyComponent={<EmptyState icon="refresh-circle-outline" title="Nenhum tratamento" message="Ajuste a busca ou toque em + para cadastrar." />}
                renderItem={({ item }) => (
                  <Card onPress={() => setPanel({ treatment: item })}>
                    <View style={styles.row}>
                      <TreatmentSeal category={item.category} size={42} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.name, styles.nameMobile]}>{item.name}</Text>
                        <Text style={styles.mobileSub}>{item.category || 'Sem categoria'}</Text>
                        <View style={styles.mobilePills}>
                          <StatusPill active={item.active} />
                          <DiversionPill treatment={item} />
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
            <TreatmentPanel
              treatment={panel.treatment}
              usage={panel.treatment ? usage[panel.treatment.id] : undefined}
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
              <TreatmentPanel
                treatment={panel.treatment}
                usage={panel.treatment ? usage[panel.treatment.id] : undefined}
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
        <Pressable style={styles.fab} onPress={() => setPanel({ treatment: null })} accessibilityLabel="Novo tratamento">
          <Ionicons name="add" size={28} color={colors.white} />
        </Pressable>
      )}

      <ConfirmModal
        visible={!!toggling}
        title={toggling?.active ? 'Desativar tratamento?' : 'Ativar tratamento?'}
        message={
          toggling?.active
            ? `${toggling?.name} deixa de aparecer na escolha de novas pesagens. As pesagens já registradas com ele continuam contando na taxa de desvio.`
            : `${toggling?.name} volta a aparecer na escolha de tratamento das novas pesagens.`
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
            ? `${selected.size} ${selected.size === 1 ? 'tratamento volta' : 'tratamentos voltam'} a aparecer na escolha das novas pesagens.`
            : `${selected.size} ${selected.size === 1 ? 'tratamento deixa' : 'tratamentos deixam'} de aparecer para novas pesagens. As pesagens já registradas continuam contando na taxa de desvio.`
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
  newButton: { minHeight: 50, paddingHorizontal: 28 },

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
  searchCell: { flex: 2.2, minWidth: 220 },
  filterCell: { flex: 1, minWidth: 168, maxWidth: 300 },
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
  name: { fontSize: 12.5, fontWeight: '700', color: colors.text, letterSpacing: -0.2, flexShrink: 1 },
  fab: {
    position: 'absolute', right: spacing.lg, bottom: spacing.xl, width: 56, height: 56,
    borderRadius: radius.full, backgroundColor: colors.brand[700],
    alignItems: 'center', justifyContent: 'center',
    ...elevation('lg'),
  },
});
