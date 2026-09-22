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
import MapPin from 'lucide-react-native/icons/map-pin';
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
import { listUnitsWithStats, setUnitActive, UnitStats } from '@/services/masters';
import { columnCheck } from '@/utils/columns';
import { Client, Unit } from '@/types';
import { formatDayOrDate, formatLongDate, formatNumber, roleLabel } from '@/utils/format';
import { exportUnitsCsv, exportUnitsXlsx } from '@/utils/unitExport';
import { UnitPanel, unitInitials } from './UnitPanel';

const STATUS_FILTER = [
  { label: 'Todas as situações', value: '' },
  { label: 'Ativas', value: 'active' },
  { label: 'Inativas', value: 'inactive' },
];
const PAGE_SIZES = [10, 25, 50].map((n) => ({ label: `${n} por página`, value: String(n) }));

type SortKey = 'name' | 'client' | 'city' | 'type' | 'contact' | 'status' | 'last';
/**
 * `chosen`: se a ordenação foi escolhida por alguém. A lista abre pela última
 * pesagem, mas a seta só aparece depois de um clique — antes disso todas as
 * colunas mostram o mesmo ícone neutro, que diz "dá para ordenar aqui".
 */
type Sort = { key: SortKey; dir: 'asc' | 'desc'; chosen: boolean };

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/**
 * Cor do avatar derivada da unidade, não da posição na lista.
 *
 * Pela posição, a mesma unidade mudaria de cor a cada ordenação ou filtro — e
 * a cor é justamente o que ajuda a reconhecê-la de relance.
 */
function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return colors.avatars[Math.abs(h) % colors.avatars.length];
}

function Avatar({ unit, size = 30 }: { unit: Unit; size?: number }) {
  const c = avatarColor(unit.id);
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.bg }]}>
      <Text style={[styles.avatarText, { color: c.fg, fontSize: size * 0.37 }]}>{unitInitials(unit.name)}</Text>
    </View>
  );
}

function StatusPill({ active }: { active: boolean }) {
  const tone = active ? colors.success : colors.pendingRing;
  return (
    <View style={[styles.pill, { backgroundColor: active ? '#EEF8F1' : '#FDF4E3' }]}>
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <Text style={[styles.pillText, { color: tone }]}>{active ? 'Ativa' : 'Inativa'}</Text>
    </View>
  );
}

/**
 * Unidades.
 *
 * A unidade é onde a pesagem acontece, e por isso a lista mostra quando cada
 * uma pesou por último: uma unidade cadastrada que nunca pesou é um cadastro
 * que não virou operação. A edição acontece no painel ao lado, e não num
 * diálogo sobre a tela, para dar para conferir uma unidade contra as vizinhas
 * enquanto se edita.
 */
export function AdminUnitsScreen() {
  const navigation = useNavigation<any>();
  const { profile: me, signOut } = useAuth();
  const isDesktop = useIsDesktop();
  const isWide = useIsWide();

  const [units, setUnits] = useState<Unit[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<Record<string, UnitStats>>({});
  /** Colunas que a tabela `units` tem de fato — ver `columnCheck`. */
  const [dbColumns, setDbColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  // Ordem alfabética, a mesma que a consulta devolve: numa lista de cadastro
  // procura-se a unidade pelo nome. A atividade está na coluna de última
  // pesagem, que ordena com um clique.
  const [sort, setSort] = useState<Sort>({ key: 'name', dir: 'asc', chosen: false });
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<{ unit: Unit | null } | null>(null);
  const [bulk, setBulk] = useState<'activate' | 'deactivate' | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toggling, setToggling] = useState<Unit | null>(null);
  const [togglingBusy, setTogglingBusy] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listUnitsWithStats();
      setUnits(data.units);
      setClients(data.clients);
      setStats(data.stats);
      setDbColumns(data.columns);
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao carregar unidades.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetch();
    }, [fetch])
  );

  /** Cada campo e cada filtro perguntam pela própria coluna no banco. */
  const can = useMemo(() => columnCheck(dbColumns), [dbColumns]);

  const clientName = useCallback(
    (id?: string | null) => clients.find((c) => c.id === id)?.name ?? '',
    [clients]
  );

  /** Indicadores do topo. */
  const summary = useMemo(() => {
    const total = units.length;
    const active = units.filter((u) => u.active).length;
    const withWeighings = units.filter((u) => (stats[u.id]?.month ?? 0) > 0).length;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const before = units.filter((u) => u.created_at && new Date(u.created_at) < monthStart);

    // Clientes com unidade: hoje e antes do mês começar. A comparação usa a
    // data de cadastro da unidade, que é o que registra quando o vínculo
    // passou a existir.
    const linked = new Set(units.map((u) => u.client_id).filter(Boolean)).size;
    const linkedBefore = new Set(before.map((u) => u.client_id).filter(Boolean)).size;

    const pct = (now: number, was: number) => (was > 0 ? ((now - was) / was) * 100 : null);
    const share = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
    return {
      total,
      active,
      withWeighings,
      linked,
      growth: pct(total, before.length),
      linkedGrowth: pct(linked, linkedBefore),
      share,
    };
  }, [units, stats]);

  /**
   * Opções dos filtros, vindas do que está cadastrado.
   *
   * Uma lista fixa ofereceria filtros que não encontram nada. Sem a migração
   * 0010 a coluna de estado não existe, o filtro fica sem opção alguma e por
   * isso não é desenhado — um filtro vazio é um controle decorativo.
   */
  const clientOptions = useMemo(() => {
    const used = clients.filter((c) => units.some((u) => u.client_id === c.id));
    return [{ label: 'Todos os clientes', value: '' }, ...used.map((c) => ({ label: c.name, value: c.id }))];
  }, [clients, units]);

  const cityOptions = useMemo(() => {
    const values = Array.from(new Set(units.map((u) => u.city).filter(Boolean) as string[]));
    values.sort(collator.compare);
    return [{ label: 'Todas as cidades', value: '' }, ...values.map((v) => ({ label: v, value: v }))];
  }, [units]);

  const stateOptions = useMemo(() => {
    const values = Array.from(new Set(units.map((u) => u.state).filter(Boolean) as string[]));
    values.sort(collator.compare);
    return [{ label: 'Todos os estados', value: '' }, ...values.map((v) => ({ label: v, value: v }))];
  }, [units]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    const rows = units.filter((u) => {
      if (q) {
        const haystack = [u.name, clientName(u.client_id), u.code, u.contact_name, u.city]
          .filter(Boolean).join(' ').toLocaleLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (clientFilter && u.client_id !== clientFilter) return false;
      if (cityFilter && u.city !== cityFilter) return false;
      if (stateFilter && u.state !== stateFilter) return false;
      if (statusFilter && (statusFilter === 'active') !== u.active) return false;
      return true;
    });

    const dir = sort.dir === 'asc' ? 1 : -1;
    const compare = (a: Unit, b: Unit): number => {
      switch (sort.key) {
        case 'name': return collator.compare(a.name, b.name);
        case 'client': return collator.compare(clientName(a.client_id), clientName(b.client_id));
        case 'city': return collator.compare(a.city ?? '', b.city ?? '');
        case 'type': return collator.compare(a.type ?? '', b.type ?? '');
        case 'contact': return collator.compare(a.contact_name ?? '', b.contact_name ?? '');
        case 'status': return Number(b.active) - Number(a.active);
        case 'last': return (stats[a.id]?.last ?? '').localeCompare(stats[b.id]?.last ?? '');
      }
    };
    return rows.sort((a, b) => {
      // Unidade que nunca pesou fica sempre por último: "sem pesagem" não é
      // uma data antiga, é a ausência dela.
      if (sort.key === 'last' && !stats[a.id]?.last !== !stats[b.id]?.last) return stats[a.id]?.last ? -1 : 1;
      return compare(a, b) * dir || collator.compare(a.name, b.name);
    });
  }, [units, stats, clientName, search, clientFilter, cityFilter, stateFilter, statusFilter, sort]);

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
    setClientFilter('');
    setCityFilter('');
    setStateFilter('');
    setStatusFilter('');
    setPage(1);
  };

  const allSelected = visible.length > 0 && visible.every((u) => selected.has(u.id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) visible.forEach((u) => next.delete(u.id));
      else visible.forEach((u) => next.add(u.id));
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
      await Promise.all(units.filter((u) => selected.has(u.id)).map((u) => setUnitActive(u.id, bulk === 'activate')));
      setBulk(null);
      setSelected(new Set());
      await fetch();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao alterar as unidades selecionadas.');
    } finally {
      setBulkBusy(false);
    }
  };

  const confirmToggle = async () => {
    if (!toggling) return;
    setTogglingBusy(true);
    try {
      await setUnitActive(toggling.id, !toggling.active);
      setToggling(null);
      await fetch();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao alterar a situação da unidade.');
    } finally {
      setTogglingBusy(false);
    }
  };

  const exportAs = async (type: 'csv' | 'xlsx') => {
    try {
      const rows = filtered.map((u) => ({ unit: u, client: clientName(u.client_id), last: stats[u.id]?.last ?? null }));
      if (type === 'csv') await exportUnitsCsv(rows);
      else await exportUnitsXlsx(rows);
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao exportar unidades.');
    }
  };

  const sortProps = (key: SortKey) => ({
    onSort: () => toggleSort(key),
    sort: sort.chosen && sort.key === key ? sort.dir : null,
  });

  const columns: TableColumn<Unit>[] = [
    {
      key: 'check', label: '', flex: 0.44,
      renderHeader: () => (
        <Checkbox
          checked={allSelected}
          indeterminate={!allSelected && someSelected}
          onToggle={toggleAll}
          disabled={visible.length === 0}
          label="Selecionar todas as unidades da página"
        />
      ),
      render: (u) => (
        <Checkbox checked={selected.has(u.id)} onToggle={() => toggleOne(u.id)} label={`Selecionar ${u.name}`} />
      ),
    },
    {
      key: 'name', label: 'Unidade', flex: 2.15, ...sortProps('name'),
      // O nome é o alvo acessível da linha: dá para chegar nele por teclado,
      // enquanto o clique em qualquer ponto da linha é atalho de mouse.
      render: (u) => (
        <Pressable
          onPress={() => setPanel({ unit: u })}
          accessibilityRole="button"
          accessibilityLabel={`Abrir detalhes de ${u.name}`}
          style={({ hovered }: any) => [styles.nameCell, transition('opacity'), hovered && styles.nameCellHover]}
        >
          <Avatar unit={u} />
          <Text style={styles.name} numberOfLines={1}>{u.name}</Text>
        </Pressable>
      ),
    },
    {
      key: 'client', label: 'Cliente', flex: 1.1, ...sortProps('client'),
      render: (u) => <Text style={styles.cellText} numberOfLines={2}>{clientName(u.client_id) || '—'}</Text>,
    },
    {
      key: 'city', label: 'Cidade/UF', flex: 1.02, ...sortProps('city'),
      // Duas linhas: "São Bernardo do Campo / SP" não cabe numa, e cortar a
      // cidade tira justamente o que a coluna informa.
      render: (u) => (
        <Text style={styles.cellText} numberOfLines={2}>
          {[u.city, u.state].filter(Boolean).join(' / ') || '—'}
        </Text>
      ),
    },
    {
      // Larga o bastante para "Armazenamento" e "Administrativa": palavra
      // unica maior que a coluna quebra no meio, e ai nao ha onde quebrar bem.
      key: 'type', label: 'Tipo', flex: 1.2, ...sortProps('type'),
      render: (u) => <Text style={styles.cellText} numberOfLines={2}>{u.type || '—'}</Text>,
    },
    {
      key: 'contact', label: 'Responsável', flex: 1.22, ...sortProps('contact'),
      render: (u) => <Text style={styles.cellText} numberOfLines={2}>{u.contact_name || '—'}</Text>,
    },
    { key: 'status', label: 'Situação', flex: 0.95, ...sortProps('status'), render: (u) => <StatusPill active={u.active} /> },
    {
      key: 'last', label: 'Última pesagem', flex: 1.37, ...sortProps('last'),
      render: (u) => (
        <Text style={[styles.cellText, !stats[u.id]?.last && styles.cellEmpty]} numberOfLines={1}>
          {formatDayOrDate(stats[u.id]?.last) ?? 'Nenhuma'}
        </Text>
      ),
    },
    {
      key: 'actions', label: 'Ações', flex: 0.55,
      render: (u) => (
        <ActionMenu
          accessibilityLabel={`Mais ações para ${u.name}`}
          actions={[
            { label: 'Abrir detalhes', icon: SlidersHorizontal, onPress: () => setPanel({ unit: u }) },
            u.active
              ? { label: 'Desativar unidade', icon: Ban, destructive: true, onPress: () => setToggling(u) }
              : { label: 'Ativar unidade', icon: CircleCheck, onPress: () => setToggling(u) },
          ]}
          renderTrigger={(open) => (
            <Pressable
              onPress={open}
              accessibilityRole="button"
              accessibilityLabel={`Mais ações para ${u.name}`}
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
          ? 'Nenhuma unidade para mostrar'
          : `Mostrando ${from + 1} a ${Math.min(from + pageSize, filtered.length)} de ${filtered.length} ${filtered.length === 1 ? 'unidade' : 'unidades'}`}
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
            { label: 'Unidades' },
          ]}
          userName={me?.full_name}
          userRole={roleLabel[me?.role ?? 'viewer']}
          onUser={() => navigation.navigate('ProfileHome')}
          onNotifications={() => navigation.getParent()?.navigate('Pesagens', { screen: 'WeighingsList' })}
          onSignOut={signOut}
        />
      ) : (
        <Header title="Unidades" subtitle="Gestão de locais" onBack={() => navigation.goBack()} />
      )}

      <View style={styles.split}>
        <ScrollView contentContainerStyle={isDesktop ? styles.deskScroll : styles.list}>
          {isDesktop ? (
            <PageHeader
              // Mesmo glifo do item Unidades no menu: a página e o menu não
              // podem usar símbolos diferentes para a mesma coisa.
              seal={<MapPin size={30} strokeWidth={2} color={colors.form.tileIcon} />}
              title="Unidades"
              titleSize={34}
              subtitle="Gestão de locais e unidades operacionais"
              right={
                <View style={styles.headerRight}>
                  <View style={styles.todayRow}>
                    <Ionicons name="calendar-outline" size={15} color={colors.form.muted} />
                    <Text style={styles.today}>{formatLongDate()}</Text>
                  </View>
                  <Button
                    title="Nova unidade"
                    variant="cta"
                    size="lg"
                    iconComponent={MapPin}
                    fullWidth={false}
                    onPress={() => setPanel({ unit: null })}
                    style={styles.newButton}
                  />
                </View>
              }
            />
          ) : null}

          <MetricStrip items={[
            {
              label: 'Total de unidades', value: formatNumber(summary.total), icon: 'business-outline',
              ...deltaProps(summary.growth),
            },
            {
              label: 'Unidades ativas', value: formatNumber(summary.active), icon: 'ellipse',
              tone: colors.success, delta: `${summary.share(summary.active)}%`, deltaDirection: 'flat', deltaLabel: 'do total',
            },
            {
              label: 'Clientes vinculados', value: formatNumber(summary.linked), icon: 'people-outline',
              tone: colors.pendingRing, ...deltaProps(summary.linkedGrowth),
            },
            {
              label: 'Com pesagens no mês', value: formatNumber(summary.withWeighings), icon: 'scale-outline',
              tone: '#2C5BB8', delta: `${summary.share(summary.withWeighings)}%`, deltaDirection: 'flat', deltaLabel: 'do total',
            },
          ]} />

          {/* ── Filtros ───────────────────────────────────────────────── */}
          <View style={[styles.card, elevation('sm')]}>
            <View style={isDesktop ? styles.filterRow : undefined}>
              <View style={isDesktop ? styles.searchCell : undefined}>
                <Input
                  size="form"
                  placeholder="Buscar unidades por nome, cliente ou código..."
                  leftIconComponent={Search}
                  value={search}
                  onChangeText={(v) => { setSearch(v); setPage(1); }}
                />
              </View>
              {clientOptions.length > 1 ? (
                <View style={isDesktop ? styles.filterCell : undefined}>
                  <Select size="form" options={clientOptions} value={clientFilter}
                    onChange={(v) => { setClientFilter(v); setPage(1); }} />
                </View>
              ) : null}
              {cityOptions.length > 1 ? (
                <View style={isDesktop ? styles.filterCell : undefined}>
                  <Select size="form" options={cityOptions} value={cityFilter}
                    onChange={(v) => { setCityFilter(v); setPage(1); }} />
                </View>
              ) : null}
              {stateOptions.length > 1 ? (
                <View style={isDesktop ? styles.filterCell : undefined}>
                  <Select size="form" options={stateOptions} value={stateFilter}
                    onChange={(v) => { setStateFilter(v); setPage(1); }} />
                </View>
              ) : null}
              <View style={isDesktop ? styles.filterCell : undefined}>
                <Select size="form" options={STATUS_FILTER} value={statusFilter}
                  onChange={(v) => { setStatusFilter(v); setPage(1); }} />
              </View>
            </View>
          </View>

          {/* ── Lista ─────────────────────────────────────────────────── */}
          {loading ? (
            <Loading />
          ) : isDesktop ? (
            <View style={[styles.card, styles.tableCard, elevation('sm')]}>
              {someSelected ? (
                <View style={styles.bulkBar}>
                  <Text style={styles.bulkText}>
                    {selected.size} {selected.size === 1 ? 'unidade selecionada' : 'unidades selecionadas'}
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
                keyExtractor={(u) => u.id}
                rowHeight={46}
                onRowPress={(u) => setPanel({ unit: u })}
                isRowSelected={(u) => panel?.unit?.id === u.id}
                rowLabel={(u) => `Abrir detalhes de ${u.name}`}
                empty={
                  <EmptyState
                    title="Nenhuma unidade encontrada"
                    message={units.length === 0
                      ? 'Cadastre a primeira unidade: é ela que recebe as pesagens.'
                      : 'Ajuste a busca ou os filtros.'}
                  />
                }
                columns={columns}
              />
              {footer}
            </View>
          ) : (
            <>
              <FlatList
                scrollEnabled={false}
                data={visible}
                keyExtractor={(u) => u.id}
                ListEmptyComponent={<EmptyState icon="business-outline" title="Nenhuma unidade" message="Ajuste a busca ou toque em + para cadastrar." />}
                renderItem={({ item }) => (
                  <Card onPress={() => setPanel({ unit: item })}>
                    <View style={styles.row}>
                      <Avatar unit={item} size={42} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.name, styles.nameMobile]}>{item.name}</Text>
                        <Text style={styles.mobileSub}>{clientName(item.client_id)}</Text>
                        <View style={styles.mobilePills}>
                          <StatusPill active={item.active} />
                          <Text style={styles.mobileLast}>
                            {stats[item.id]?.last ? `Pesou ${formatDayOrDate(stats[item.id]?.last)}` : 'Nunca pesou'}
                          </Text>
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
            <UnitPanel
              unit={panel.unit}
              clients={clients}
              stats={panel.unit ? stats[panel.unit.id] : undefined}
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
              <UnitPanel
                unit={panel.unit}
                clients={clients}
                stats={panel.unit ? stats[panel.unit.id] : undefined}
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
        <Pressable style={styles.fab} onPress={() => setPanel({ unit: null })} accessibilityLabel="Nova unidade">
          <Ionicons name="add" size={28} color={colors.white} />
        </Pressable>
      )}

      <ConfirmModal
        visible={!!toggling}
        title={toggling?.active ? 'Desativar unidade?' : 'Ativar unidade?'}
        message={
          toggling?.active
            ? `${toggling?.name} deixa de aparecer na escolha de unidade das novas pesagens. As pesagens já registradas continuam intactas.`
            : `${toggling?.name} volta a aparecer na escolha de unidade das novas pesagens.`
        }
        confirmLabel={toggling?.active ? 'Desativar' : 'Ativar'}
        destructive={toggling?.active}
        loading={togglingBusy}
        onConfirm={confirmToggle}
        onCancel={() => setToggling(null)}
      />

      <ConfirmModal
        visible={!!bulk}
        title={bulk === 'activate' ? 'Ativar selecionadas?' : 'Desativar selecionadas?'}
        message={
          bulk === 'activate'
            ? `${selected.size} ${selected.size === 1 ? 'unidade volta' : 'unidades voltam'} a aparecer na escolha de unidade das novas pesagens.`
            : `${selected.size} ${selected.size === 1 ? 'unidade deixa' : 'unidades deixam'} de aparecer para novas pesagens. As pesagens já registradas continuam intactas.`
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
  searchCell: { flex: 1.9, minWidth: 220 },
  // 168px é o mínimo que cabe "Todas as situações" sem cortar; abaixo disso o
  // rótulo do filtro vira reticências e deixa de dizer o que filtra.
  // O maxWidth so age quando a linha quebra: sem ele o filtro que desce
  // para a segunda linha se estica pela largura toda do cartao.
  filterCell: { flex: 1, minWidth: 168, maxWidth: 300 },

  bulkBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
    backgroundColor: colors.brand[50], borderBottomWidth: 1, borderBottomColor: colors.greenLine,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  bulkText: { fontSize: 14, fontWeight: '600', color: colors.brand[700] },
  bulkActions: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  bulkButton: { minHeight: 38, paddingHorizontal: 16, borderRadius: 8 },

  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nameCellHover: { opacity: 0.8 },
  cellText: { fontSize: 12, color: '#45586B', lineHeight: 16 },
  cellEmpty: { color: colors.form.soft },
  pill: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full,
  },
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
  mobileLast: { fontSize: 12.5, color: colors.form.soft },
  // O cartao do celular tem a largura toda: nada obriga o nome a ser tao
  // pequeno quanto na celula da tabela.
  nameMobile: { fontSize: 15 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '700' },
  // 12px: com oito colunas e o painel lateral aberto, e o tamanho em que
  // "Unidade Belo Horizonte" ainda cabe inteiro.
  name: { fontSize: 12, fontWeight: '700', color: colors.text, letterSpacing: -0.2, flexShrink: 1 },
  fab: {
    position: 'absolute', right: spacing.lg, bottom: spacing.xl, width: 56, height: 56,
    borderRadius: radius.full, backgroundColor: colors.brand[700],
    alignItems: 'center', justifyContent: 'center',
    ...elevation('lg'),
  },
});
