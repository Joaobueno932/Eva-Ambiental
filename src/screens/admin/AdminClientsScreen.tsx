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
import Funnel from 'lucide-react-native/icons/funnel';
import EllipsisVertical from 'lucide-react-native/icons/ellipsis-vertical';
import Search from 'lucide-react-native/icons/search';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import UserPlus from 'lucide-react-native/icons/user-plus';
import Users from 'lucide-react-native/icons/users';
import { Button, Card, Checkbox, ConfirmModal, EmptyState, Header, Input, Loading, Select, Topbar } from '@/components';
import { ActionMenu } from '@/components/ActionMenu';
import { DataTable, TableColumn } from '@/components/DataTable';
import { PageHeader } from '@/components/FormKit';
import { BuildingIcon } from '@/components/MenuIcons';
import { MetricStrip } from '@/components/Operations';
import { colors, elevation, gradient, layout, radius, spacing, transition } from '@/theme';
import { useIsDesktop, useIsWide } from '@/hooks/useLayout';
import { useAuth } from '@/contexts/AuthContext';
import { listClientsWithUnits, setClientActive } from '@/services/masters';
import { columnCheck } from '@/utils/columns';
import { Client, Unit } from '@/types';
import { formatAccess, formatDocument, formatLongDate, formatNumber, roleLabel } from '@/utils/format';
import { exportClientsCsv, exportClientsXlsx } from '@/utils/clientExport';
import { ClientPanel } from './ClientPanel';

const STATUS_FILTER = [
  { label: 'Todos os status', value: '' },
  { label: 'Ativos', value: 'active' },
  { label: 'Inativos', value: 'inactive' },
];
/** Filtro extra: cliente com ou sem unidade cadastrada. */
const UNITS_FILTER = [
  { label: 'Com ou sem unidades', value: '' },
  { label: 'Com unidades vinculadas', value: 'with' },
  { label: 'Sem nenhuma unidade', value: 'without' },
];
const PAGE_SIZES = [10, 25, 50].map((n) => ({ label: `${n} por página`, value: String(n) }));

type SortKey = 'name' | 'document' | 'segment' | 'units' | 'status' | 'updated';
/**
 * `chosen`: se a ordenação foi escolhida por alguém. A lista abre em ordem
 * alfabética, mas a seta só aparece depois de um clique — antes disso todas as
 * colunas mostram o mesmo ícone neutro, que diz "dá para ordenar aqui".
 */
type Sort = { key: SortKey; dir: 'asc' | 'desc'; chosen: boolean };

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/**
 * Variação de um indicador, com as duas ausências separadas.
 *
 * `null` é "não há mês anterior com que comparar" — diferente de uma variação
 * que deu zero, em que há comparação e ela não mudou. Escrever "sem variação"
 * nos dois casos afirmaria uma estabilidade que ninguém mediu.
 */
function deltaProps(pct: number | null) {
  if (pct === null) return { delta: '—', deltaDirection: 'flat' as const, deltaLabel: 'sem base de comparação' };
  const rounded = Math.round(pct);
  // 0% ja diz que nao mudou; a nota continua sendo contra o que se compara.
  if (rounded === 0) return { delta: '0%', deltaDirection: 'flat' as const, deltaLabel: 'vs. mês anterior' };
  return {
    delta: `${rounded}%`,
    deltaDirection: (rounded > 0 ? 'up' : 'down') as 'up' | 'down',
    deltaLabel: 'vs. mês anterior',
  };
}

/** Iniciais das duas primeiras palavras: "Ambiental Santos LTDA" → "AS". */
function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || '?';
}

/**
 * Cor do avatar derivada do cliente, não da posição na lista.
 *
 * Pela posição, o mesmo cliente mudaria de cor a cada ordenação ou filtro — e
 * a cor é justamente o que ajuda a reconhecê-lo de relance.
 */
function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return colors.avatars[Math.abs(h) % colors.avatars.length];
}

function Avatar({ client, size = 30 }: { client: Client; size?: number }) {
  const c = avatarColor(client.id);
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.bg }]}>
      <Text style={[styles.avatarText, { color: c.fg, fontSize: size * 0.37 }]}>{initials(client.name)}</Text>
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
 * Clientes.
 *
 * Os quatro indicadores respondem o que se pergunta antes de mexer em
 * qualquer cadastro: quantos clientes existem, quantos estão em uso, quantos
 * já têm unidade para receber pesagem e quantos entraram no mês. A edição
 * acontece no painel ao lado, e não num diálogo sobre a tela, para dar para
 * conferir um cadastro contra os vizinhos enquanto se edita.
 */
export function AdminClientsScreen() {
  const navigation = useNavigation<any>();
  const { profile: me, signOut } = useAuth();
  const isDesktop = useIsDesktop();
  const isWide = useIsWide();

  const [clients, setClients] = useState<Client[]>([]);
  const [unitsByClient, setUnitsByClient] = useState<Record<string, Unit[]>>({});
  /** Colunas que a tabela `clients` tem de fato — ver `columnCheck`. */
  const [dbColumns, setDbColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [unitsFilter, setUnitsFilter] = useState('');
  const [moreFilters, setMoreFilters] = useState(false);
  // A lista abre pelo que mudou por ultimo, nao em ordem alfabetica: quem
  // entra aqui vem conferir o que foi mexido. Para achar um cliente pelo
  // nome ha a busca.
  const [sort, setSort] = useState<Sort>({ key: 'updated', dir: 'desc', chosen: false });
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<{ client: Client | null } | null>(null);
  const [bulk, setBulk] = useState<'activate' | 'deactivate' | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toggling, setToggling] = useState<Client | null>(null);
  const [togglingBusy, setTogglingBusy] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listClientsWithUnits();
      setClients(data.clients);
      setUnitsByClient(data.unitsByClient);
      setDbColumns(data.columns);
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao carregar clientes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetch();
    }, [fetch])
  );

  const unitCount = useCallback((id: string) => unitsByClient[id]?.length ?? 0, [unitsByClient]);

  /** Cada campo e cada coluna perguntam pela própria coluna no banco. */
  const can = useMemo(() => columnCheck(dbColumns), [dbColumns]);

  /** Indicadores do topo. */
  const stats = useMemo(() => {
    const total = clients.length;
    const active = clients.filter((c) => c.active).length;
    const withUnits = clients.filter((c) => (unitsByClient[c.id]?.length ?? 0) > 0).length;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const lastMonthStart = new Date(monthStart);
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);

    const at = (c: Client) => (c.created_at ? new Date(c.created_at).getTime() : 0);
    const newThisMonth = clients.filter((c) => at(c) >= monthStart.getTime()).length;
    const newLastMonth = clients.filter((c) => at(c) >= lastMonthStart.getTime() && at(c) < monthStart.getTime()).length;
    // Base da variação do total: quantos já existiam quando o mês começou.
    const before = total - newThisMonth;

    const share = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
    return {
      total,
      active,
      withUnits,
      newThisMonth,
      growth: before > 0 ? ((total - before) / before) * 100 : null,
      newGrowth: newLastMonth > 0 ? ((newThisMonth - newLastMonth) / newLastMonth) * 100 : null,
      share,
    };
  }, [clients, unitsByClient]);

  /**
   * Opções de segmento e cidade vindas do que está cadastrado.
   *
   * Uma lista fixa ofereceria filtros que não encontram nada. Sem a migração
   * 0009 essas colunas não existem, os dois filtros ficam sem opção alguma e
   * por isso não são desenhados — um filtro vazio é um controle decorativo.
   */
  const segmentOptions = useMemo(() => {
    const values = Array.from(new Set(clients.map((c) => c.segment).filter(Boolean) as string[]));
    values.sort(collator.compare);
    return [{ label: 'Todos os segmentos', value: '' }, ...values.map((v) => ({ label: v, value: v }))];
  }, [clients]);

  const cityOptions = useMemo(() => {
    const values = Array.from(new Set(clients.map((c) => c.city).filter(Boolean) as string[]));
    values.sort(collator.compare);
    return [{ label: 'Todas as cidades', value: '' }, ...values.map((v) => ({ label: v, value: v }))];
  }, [clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    const rows = clients.filter((c) => {
      if (q) {
        const haystack = [c.name, c.trade_name, c.document, formatDocument(c.document), c.contact_name, c.email]
          .filter(Boolean).join(' ').toLocaleLowerCase();
        // O CNPJ é procurado também sem pontuação: quem copia de uma nota cola
        // "12345678000190", e quem lê da tela digita com pontos.
        const digits = q.replace(/\D/g, '');
        const matchDigits = digits.length >= 3 && (c.document ?? '').replace(/\D/g, '').includes(digits);
        if (!haystack.includes(q) && !matchDigits) return false;
      }
      if (statusFilter && (statusFilter === 'active') !== c.active) return false;
      if (segmentFilter && c.segment !== segmentFilter) return false;
      if (cityFilter && c.city !== cityFilter) return false;
      if (unitsFilter) {
        const has = (unitsByClient[c.id]?.length ?? 0) > 0;
        if (unitsFilter === 'with' && !has) return false;
        if (unitsFilter === 'without' && has) return false;
      }
      return true;
    });

    const dir = sort.dir === 'asc' ? 1 : -1;
    const compare = (a: Client, b: Client): number => {
      switch (sort.key) {
        case 'name': return collator.compare(a.name, b.name);
        case 'document': return collator.compare(a.document ?? '', b.document ?? '');
        case 'segment': return collator.compare(a.segment ?? '', b.segment ?? '');
        case 'units': return unitCount(a.id) - unitCount(b.id);
        case 'status': return Number(b.active) - Number(a.active);
        case 'updated': return (a.updated_at ?? a.created_at ?? '').localeCompare(b.updated_at ?? b.created_at ?? '');
      }
    };
    return rows.sort((a, b) => compare(a, b) * dir || collator.compare(a.name, b.name));
  }, [clients, unitsByClient, unitCount, search, statusFilter, segmentFilter, cityFilter, unitsFilter, sort]);

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
    setStatusFilter('');
    setSegmentFilter('');
    setCityFilter('');
    setUnitsFilter('');
    setPage(1);
  };

  const allSelected = visible.length > 0 && visible.every((c) => selected.has(c.id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) visible.forEach((c) => next.delete(c.id));
      else visible.forEach((c) => next.add(c.id));
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

  const selectedClients = clients.filter((c) => selected.has(c.id));

  const runBulk = async () => {
    if (!bulk) return;
    setBulkBusy(true);
    try {
      await Promise.all(selectedClients.map((c) => setClientActive(c.id, bulk === 'activate')));
      setBulk(null);
      setSelected(new Set());
      await fetch();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao alterar os clientes selecionados.');
    } finally {
      setBulkBusy(false);
    }
  };

  const confirmToggle = async () => {
    if (!toggling) return;
    setTogglingBusy(true);
    try {
      await setClientActive(toggling.id, !toggling.active);
      setToggling(null);
      await fetch();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao alterar a situação do cliente.');
    } finally {
      setTogglingBusy(false);
    }
  };

  const exportAs = async (type: 'csv' | 'xlsx') => {
    try {
      if (type === 'csv') await exportClientsCsv(filtered, unitCount);
      else await exportClientsXlsx(filtered, unitCount);
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao exportar clientes.');
    }
  };

  const sortProps = (key: SortKey) => ({
    onSort: () => toggleSort(key),
    sort: sort.chosen && sort.key === key ? sort.dir : null,
  });

  const columns: TableColumn<Client>[] = [
    {
      key: 'check', label: '', flex: 0.42,
      renderHeader: () => (
        <Checkbox
          checked={allSelected}
          indeterminate={!allSelected && someSelected}
          onToggle={toggleAll}
          disabled={visible.length === 0}
          label="Selecionar todos os clientes da página"
        />
      ),
      render: (c) => (
        <Checkbox
          checked={selected.has(c.id)}
          onToggle={() => toggleOne(c.id)}
          label={`Selecionar ${c.name}`}
        />
      ),
    },
    {
      key: 'name', label: 'Cliente', flex: 2.3, ...sortProps('name'),
      // O nome é o alvo acessível da linha: dá para chegar nele por teclado,
      // enquanto o clique em qualquer ponto da linha é atalho de mouse.
      render: (c) => (
        <Pressable
          onPress={() => setPanel({ client: c })}
          accessibilityRole="button"
          accessibilityLabel={`Abrir detalhes de ${c.name}`}
          style={({ hovered }: any) => [styles.nameCell, transition('opacity'), hovered && styles.nameCellHover]}
        >
          <Avatar client={c} />
          <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
        </Pressable>
      ),
    },
    {
      key: 'document', label: 'CNPJ', flex: 1.45, ...sortProps('document'),
      render: (c) => <Text style={styles.cellText} numberOfLines={1}>{formatDocument(c.document) || '—'}</Text>,
    },
    {
      key: 'segment', label: 'Segmento', flex: 1.5, ...sortProps('segment'),
      render: (c) => <Text style={styles.cellText} numberOfLines={1}>{c.segment || '—'}</Text>,
    },
    {
      key: 'units', label: 'Unidades', flex: 1, ...sortProps('units'),
      render: (c) => <Text style={styles.cellNumber}>{unitCount(c.id)}</Text>,
    },
    { key: 'status', label: 'Situação', flex: 1.05, ...sortProps('status'), render: (c) => <StatusPill active={c.active} /> },
    {
      // Sem a migração 0009 não há `updated_at`: a coluna então diz o que de
      // fato mostra, a data do cadastro, em vez de rotular como "atualização"
      // uma data que nunca muda.
      key: 'updated', label: can('updated_at') ? 'Última atualização' : 'Cadastrado em', flex: 1.68, ...sortProps('updated'),
      render: (c) => (
        <Text style={styles.cellText} numberOfLines={1}>
          {formatAccess(can('updated_at') ? c.updated_at ?? c.created_at : c.created_at) ?? '—'}
        </Text>
      ),
    },
    {
      key: 'actions', label: 'Ações', flex: 0.6,
      render: (c) => (
        <ActionMenu
          accessibilityLabel={`Mais ações para ${c.name}`}
          actions={[
            { label: 'Abrir detalhes', icon: SlidersHorizontal, onPress: () => setPanel({ client: c }) },
            c.active
              ? { label: 'Desativar cliente', icon: Ban, destructive: true, onPress: () => setToggling(c) }
              : { label: 'Ativar cliente', icon: CircleCheck, onPress: () => setToggling(c) },
          ]}
          renderTrigger={(open) => (
            <Pressable
              onPress={open}
              accessibilityRole="button"
              accessibilityLabel={`Mais ações para ${c.name}`}
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
          ? 'Nenhum cliente para mostrar'
          : `Mostrando ${from + 1} a ${Math.min(from + pageSize, filtered.length)} de ${filtered.length} ${filtered.length === 1 ? 'cliente' : 'clientes'}`}
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
            { label: 'Clientes' },
          ]}
          userName={me?.full_name}
          userRole={roleLabel[me?.role ?? 'viewer']}
          onUser={() => navigation.navigate('ProfileHome')}
          onNotifications={() => navigation.getParent()?.navigate('Pesagens', { screen: 'WeighingsList' })}
          onSignOut={signOut}
        />
      ) : (
        <Header title="Clientes" subtitle="Gestão de clientes" onBack={() => navigation.goBack()} />
      )}

      <View style={styles.split}>
        <ScrollView contentContainerStyle={isDesktop ? styles.deskScroll : styles.list}>
          {isDesktop ? (
            <PageHeader
              // Mesmo glifo do item Clientes no menu: a pagina e o menu nao podem
              // usar simbolos diferentes para a mesma coisa.
              seal={<Users size={30} strokeWidth={2} color={colors.form.tileIcon} />}
              title="Clientes"
              titleSize={34}
              subtitle="Gestão de clientes"
              right={
                <View style={styles.headerRight}>
                  <View style={styles.todayRow}>
                    <Ionicons name="calendar-outline" size={15} color={colors.form.muted} />
                    <Text style={styles.today}>{formatLongDate()}</Text>
                  </View>
                  <Button
                    title="Novo cliente"
                    variant="cta"
                    size="lg"
                    iconComponent={UserPlus}
                    fullWidth={false}
                    onPress={() => setPanel({ client: null })}
                    style={styles.newButton}
                  />
                </View>
              }
            />
          ) : null}

          <MetricStrip items={[
            {
              label: 'Total de clientes', value: formatNumber(stats.total), icon: 'people-outline',
              ...deltaProps(stats.growth),
            },
            {
              label: 'Clientes ativos', value: formatNumber(stats.active), icon: 'ellipse',
              tone: colors.success, delta: `${stats.share(stats.active)}%`, deltaDirection: 'flat', deltaLabel: 'do total',
            },
            {
              label: 'Com unidades vinculadas', value: formatNumber(stats.withUnits), icon: 'business-outline',
              tone: '#2C5BB8', delta: `${stats.share(stats.withUnits)}%`, deltaDirection: 'flat', deltaLabel: 'do total',
            },
            {
              label: 'Novos no mês', value: formatNumber(stats.newThisMonth), icon: 'person-add-outline',
              tone: colors.pendingRing,
              ...deltaProps(stats.newGrowth),
            },
          ]} />

          {/* ── Filtros ───────────────────────────────────────────────── */}
          <View style={[styles.card, elevation('sm')]}>
            <View style={isDesktop ? styles.filterRow : undefined}>
              <View style={isDesktop ? styles.searchCell : undefined}>
                <Input
                  size="form"
                  placeholder="Buscar clientes por nome, CNPJ ou responsável..."
                  leftIconComponent={Search}
                  value={search}
                  onChangeText={(v) => { setSearch(v); setPage(1); }}
                />
              </View>
              <View style={isDesktop ? styles.filterCell : undefined}>
                <Select size="form" options={STATUS_FILTER} value={statusFilter}
                  onChange={(v) => { setStatusFilter(v); setPage(1); }} />
              </View>
              {/* Segmento e cidade só aparecem quando há valores cadastrados
                  para escolher — sem isso seriam campos que não filtram nada. */}
              {segmentOptions.length > 1 ? (
                <View style={isDesktop ? styles.filterCell : undefined}>
                  <Select size="form" options={segmentOptions} value={segmentFilter}
                    onChange={(v) => { setSegmentFilter(v); setPage(1); }} />
                </View>
              ) : null}
              {cityOptions.length > 1 ? (
                <View style={isDesktop ? styles.filterCell : undefined}>
                  <Select size="form" options={cityOptions} value={cityFilter}
                    onChange={(v) => { setCityFilter(v); setPage(1); }} />
                </View>
              ) : null}
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
                  <Select size="form" label="Unidades" leftIconComponent={BuildingIcon} options={UNITS_FILTER} value={unitsFilter}
                    onChange={(v) => { setUnitsFilter(v); setPage(1); }} />
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
                    {selected.size} {selected.size === 1 ? 'cliente selecionado' : 'clientes selecionados'}
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
                keyExtractor={(c) => c.id}
                rowHeight={46}
                onRowPress={(c) => setPanel({ client: c })}
                isRowSelected={(c) => panel?.client?.id === c.id}
                rowLabel={(c) => `Abrir detalhes de ${c.name}`}
                empty={<EmptyState title="Nenhum cliente encontrado" message="Ajuste a busca ou os filtros, ou cadastre um cliente." />}
                columns={columns}
              />
              {footer}
            </View>
          ) : (
            <>
              <FlatList
                scrollEnabled={false}
                data={visible}
                keyExtractor={(c) => c.id}
                ListEmptyComponent={<EmptyState icon="business-outline" title="Nenhum cliente" message="Ajuste a busca ou toque em + para cadastrar." />}
                renderItem={({ item }) => (
                  <Card onPress={() => setPanel({ client: item })}>
                    <View style={styles.row}>
                      <Avatar client={item} size={42} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.name, styles.nameMobile]}>{item.name}</Text>
                        <Text style={styles.mobileSub}>{formatDocument(item.document) || 'Documento não informado'}</Text>
                        <View style={styles.mobilePills}>
                          <StatusPill active={item.active} />
                          <Text style={styles.mobileUnits}>
                            {unitCount(item.id)} {unitCount(item.id) === 1 ? 'unidade' : 'unidades'}
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
            <ClientPanel
              client={panel.client}
              units={panel.client ? unitsByClient[panel.client.id] ?? [] : []}
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
              <ClientPanel
                client={panel.client}
                units={panel.client ? unitsByClient[panel.client.id] ?? [] : []}
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
        <Pressable style={styles.fab} onPress={() => setPanel({ client: null })} accessibilityLabel="Novo cliente">
          <Ionicons name="add" size={28} color={colors.white} />
        </Pressable>
      )}

      <ConfirmModal
        visible={!!toggling}
        title={toggling?.active ? 'Desativar cliente?' : 'Ativar cliente?'}
        message={
          toggling?.active
            ? `${toggling?.name} deixa de aparecer para novas pesagens. As pesagens já registradas e as unidades continuam intactas.`
            : `${toggling?.name} volta a aparecer na escolha de cliente das novas pesagens.`
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
            ? `${selected.size} ${selected.size === 1 ? 'cliente volta' : 'clientes voltam'} a aparecer na escolha de cliente das novas pesagens.`
            : `${selected.size} ${selected.size === 1 ? 'cliente deixa' : 'clientes deixam'} de aparecer para novas pesagens. As pesagens já registradas continuam intactas.`
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
  // filtros ela só aumentaria o cartão, então a linha a devolve. O vão é
  // menor que na tela de usuários porque aqui são quatro filtros na linha.
  filterRow: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: -22 },
  moreRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 22, marginBottom: -22 },
  searchCell: { flex: 1.85, minWidth: 220 },
  // 168px e o minimo que cabe "Todos os segmentos" sem cortar; abaixo disso
  // o rotulo do filtro vira reticencias e deixa de dizer o que filtra.
  filterCell: { flex: 1, minWidth: 168 },
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

  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameCellHover: { opacity: 0.8 },
  // 12px: e a medida do desenho, e e o que faz as oito colunas caberem
  // inteiras quando o painel lateral divide a tela.
  cellText: { fontSize: 12, color: '#45586B' },
  cellNumber: { fontSize: 12, color: '#45586B', fontVariant: ['tabular-nums'] },
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
  mobileUnits: { fontSize: 12.5, color: colors.form.soft },
  // O cartao do celular tem a largura toda: nada obriga o nome a ser tao
  // pequeno quanto na celula da tabela.
  nameMobile: { fontSize: 15 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '700' },
  name: { fontSize: 12.5, fontWeight: '700', color: colors.text, letterSpacing: -0.2, flexShrink: 1 },
  fab: {
    position: 'absolute', right: spacing.lg, bottom: spacing.xl, width: 56, height: 56,
    borderRadius: radius.full, backgroundColor: colors.brand[700],
    alignItems: 'center', justifyContent: 'center',
    ...elevation('lg'),
  },
});
