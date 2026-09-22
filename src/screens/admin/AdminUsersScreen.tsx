import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { showAlert } from '@/utils/alert';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Download from 'lucide-react-native/icons/download';
import EllipsisVertical from 'lucide-react-native/icons/ellipsis-vertical';
import Search from 'lucide-react-native/icons/search';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import UserCheck from 'lucide-react-native/icons/user-check';
import UserPlus from 'lucide-react-native/icons/user-plus';
import UserX from 'lucide-react-native/icons/user-x';
import { Button, Card, Checkbox, ConfirmModal, EmptyState, Header, Input, Loading, Select, Topbar } from '@/components';
import { ActionMenu } from '@/components/ActionMenu';
import { DataTable, TableColumn } from '@/components/DataTable';
import { LeafSeal, PageHeader } from '@/components/FormKit';
import { MetricStrip } from '@/components/Operations';
import { colors, elevation, gradient, layout, radius, spacing, transition } from '@/theme';
import { useIsDesktop, useIsWide } from '@/hooks/useLayout';
import { useAuth } from '@/contexts/AuthContext';
import { listUsers, setUserActive } from '@/services/users';
import { columnCheck } from '@/utils/columns';
import { Profile, Role } from '@/types';
import { formatAccess, formatLongDate, formatNumber, roleLabel } from '@/utils/format';
import { exportUsersCsv, exportUsersXlsx } from '@/utils/userExport';
import { UserPanel } from './UserPanel';

const ROLE_FILTER = [
  { label: 'Todos os perfis', value: '' },
  { label: 'Administrador', value: 'admin' },
  { label: 'Analista', value: 'analyst' },
  { label: 'Operador', value: 'operator' },
  { label: 'Visualizador', value: 'viewer' },
];
const STATUS_FILTER = [
  { label: 'Todas as situações', value: '' },
  { label: 'Ativos', value: 'active' },
  { label: 'Inativos', value: 'inactive' },
];
/** Filtro extra: quando a pessoa entrou pela última vez. */
const ACCESS_FILTER = [
  { label: 'Qualquer acesso', value: '' },
  { label: 'Nos últimos 7 dias', value: '7' },
  { label: 'Nos últimos 30 dias', value: '30' },
  { label: 'Há mais de 30 dias', value: 'old' },
  { label: 'Nunca acessou', value: 'never' },
];
const PAGE_SIZES = [10, 25, 50].map((n) => ({ label: `${n} por página`, value: String(n) }));

type SortKey = 'name' | 'email' | 'role' | 'status' | 'access';
/**
 * `chosen`: se a ordenação foi escolhida por alguém. A lista abre em ordem
 * alfabética, mas a seta só aparece depois de um clique — antes disso todas as
 * colunas mostram o mesmo ícone neutro, que diz "dá para ordenar aqui".
 */
type Sort = { key: SortKey; dir: 'asc' | 'desc'; chosen: boolean };

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/** Iniciais das duas primeiras palavras: "João Lucas" → "JL", "Teste 2" → "T2". */
function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || '?';
}

/**
 * Cor do avatar derivada da pessoa, não da posição na lista.
 *
 * Pela posição, a mesma pessoa mudaria de cor a cada ordenação ou filtro — e a
 * cor do avatar é justamente o que ajuda a reconhecer alguém de relance.
 */
function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return colors.avatars[Math.abs(h) % colors.avatars.length];
}

function Avatar({ user, size = 38 }: { user: Profile; size?: number }) {
  const c = avatarColor(user.id);
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.bg }]}>
      <Text style={[styles.avatarText, { color: c.fg, fontSize: size * 0.4 }]}>{initials(user.full_name)}</Text>
    </View>
  );
}

/** Perfil de acesso, cada um com sua cor. */
function RolePill({ role }: { role: Role }) {
  const c = colors.roles[role] ?? colors.roles.viewer;
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.pillText, { color: c.fg }]}>{roleLabel[role]}</Text>
    </View>
  );
}

function StatusPill({ active }: { active: boolean }) {
  const tone = active ? colors.success : colors.textMuted;
  return (
    <View style={[styles.pill, styles.pillDotted, { backgroundColor: active ? '#EEF8F1' : colors.surfaceSunken }]}>
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <Text style={[styles.pillText, { color: tone }]}>{active ? 'Ativo' : 'Inativo'}</Text>
    </View>
  );
}

function compare(a: Profile, b: Profile, key: SortKey): number {
  switch (key) {
    case 'name': return collator.compare(a.full_name, b.full_name);
    case 'email': return collator.compare(a.email, b.email);
    case 'role': return collator.compare(roleLabel[a.role] ?? a.role, roleLabel[b.role] ?? b.role);
    case 'status': return Number(b.active) - Number(a.active);
    case 'access': return (a.last_sign_in_at ?? '').localeCompare(b.last_sign_in_at ?? '');
  }
}

/**
 * Usuários e acessos.
 *
 * Os quatro indicadores no topo respondem o que se pergunta antes de mexer em
 * qualquer conta: quantas existem, quantas estão em uso e quantas têm poder de
 * administrador. A edição acontece no painel ao lado, e não num diálogo sobre
 * a tela, para dar para conferir a conta contra as vizinhas enquanto se edita.
 */
export function AdminUsersScreen() {
  const navigation = useNavigation<any>();
  const { profile: me, signOut } = useAuth();
  const isDesktop = useIsDesktop();
  const isWide = useIsWide();

  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [accessFilter, setAccessFilter] = useState('');
  const [moreFilters, setMoreFilters] = useState(false);
  const [sort, setSort] = useState<Sort>({ key: 'name', dir: 'asc', chosen: false });
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<{ user: Profile | null } | null>(null);
  const [bulk, setBulk] = useState<'activate' | 'deactivate' | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toggling, setToggling] = useState<Profile | null>(null);
  const [togglingBusy, setTogglingBusy] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await listUsers());
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetch();
    }, [fetch])
  );

  /**
   * Cada campo do painel pergunta pela própria coluna no banco.
   *
   * A lista chega com `select *` (ou com a função `admin_list_users`), então
   * as chaves da primeira linha são as colunas que existem de fato — e é por
   * coluna, não por tabela, que o painel decide o que dá para editar.
   */
  const can = useMemo(() => columnCheck(users.length > 0 ? Object.keys(users[0]) : []), [users]);

  /** Indicadores do topo. */
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.active).length;
    const admins = users.filter((u) => u.role === 'admin').length;
    // Base da variação: quem já existia quando o mês começou.
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const before = users.filter((u) => u.created_at && new Date(u.created_at) < monthStart).length;
    const growth = before > 0 ? ((total - before) / before) * 100 : null;
    const share = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
    return { total, active, inactive: total - active, admins, growth, share };
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    const now = Date.now();
    const daysAgo = (iso?: string | null) => (iso ? (now - new Date(iso).getTime()) / 86400000 : null);
    const rows = users.filter((u) => {
      if (q && ![u.full_name, u.email, roleLabel[u.role]].join(' ').toLocaleLowerCase().includes(q)) return false;
      if (roleFilter && u.role !== roleFilter) return false;
      if (statusFilter && (statusFilter === 'active') !== u.active) return false;
      if (accessFilter) {
        const d = daysAgo(u.last_sign_in_at);
        if (accessFilter === 'never') return d === null;
        if (d === null) return false;
        if (accessFilter === 'old') return d > 30;
        return d <= Number(accessFilter);
      }
      return true;
    });
    const dir = sort.dir === 'asc' ? 1 : -1;
    return rows.sort((a, b) => {
      // Quem nunca entrou fica sempre por último: "sem acesso" não é uma data
      // antiga, é a ausência dela.
      if (sort.key === 'access' && !a.last_sign_in_at !== !b.last_sign_in_at) return a.last_sign_in_at ? -1 : 1;
      return compare(a, b, sort.key) * dir || collator.compare(a.full_name, b.full_name);
    });
  }, [users, search, roleFilter, statusFilter, accessFilter, sort]);

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
    setRoleFilter('');
    setStatusFilter('');
    setAccessFilter('');
    setPage(1);
  };

  // A seleção nunca inclui a própria conta: desativá-la encerraria a sessão no
  // meio da tarefa.
  const selectable = visible.filter((u) => u.id !== me?.id);
  const allSelected = selectable.length > 0 && selectable.every((u) => selected.has(u.id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) selectable.forEach((u) => next.delete(u.id));
      else selectable.forEach((u) => next.add(u.id));
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

  const selectedUsers = users.filter((u) => selected.has(u.id));

  const runBulk = async () => {
    if (!bulk) return;
    setBulkBusy(true);
    try {
      await Promise.all(selectedUsers.map((u) => setUserActive(u.id, bulk === 'activate')));
      setBulk(null);
      setSelected(new Set());
      await fetch();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao alterar os usuários selecionados.');
    } finally {
      setBulkBusy(false);
    }
  };

  const confirmToggle = async () => {
    if (!toggling) return;
    setTogglingBusy(true);
    try {
      await setUserActive(toggling.id, !toggling.active);
      setToggling(null);
      await fetch();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao alterar a situação do usuário.');
    } finally {
      setTogglingBusy(false);
    }
  };

  const exportAs = async (type: 'csv' | 'xlsx') => {
    try {
      if (type === 'csv') await exportUsersCsv(filtered);
      else await exportUsersXlsx(filtered);
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao exportar usuários.');
    }
  };

  const sortProps = (key: SortKey) => ({
    onSort: () => toggleSort(key),
    sort: sort.chosen && sort.key === key ? sort.dir : null,
  });

  const columns: TableColumn<Profile>[] = [
    {
      key: 'check', label: '', flex: 0.34,
      renderHeader: () => (
        <Checkbox
          checked={allSelected}
          indeterminate={!allSelected && someSelected}
          onToggle={toggleAll}
          disabled={selectable.length === 0}
          label="Selecionar todos os usuários da página"
        />
      ),
      render: (u) => (
        <Checkbox
          checked={selected.has(u.id)}
          onToggle={() => toggleOne(u.id)}
          disabled={u.id === me?.id}
          label={`Selecionar ${u.full_name}`}
        />
      ),
    },
    {
      key: 'name', label: 'Usuário', flex: 2.15, ...sortProps('name'),
      // O nome é o alvo acessível da linha: dá para chegar nele por teclado,
      // enquanto o clique em qualquer ponto da linha é atalho de mouse.
      render: (u) => (
        <Pressable
          onPress={() => setPanel({ user: u })}
          accessibilityRole="button"
          accessibilityLabel={`Abrir detalhes de ${u.full_name}`}
          style={({ hovered }: any) => [styles.userCell, transition('opacity'), hovered && styles.userCellHover]}
        >
          <Avatar user={u} />
          <Text style={styles.name} numberOfLines={1}>{u.full_name}{u.id === me?.id ? ' (você)' : ''}</Text>
        </Pressable>
      ),
    },
    {
      key: 'email', label: 'E-mail', flex: 2.35, ...sortProps('email'),
      render: (u) => <Text style={styles.cellText} numberOfLines={1}>{u.email}</Text>,
    },
    { key: 'role', label: 'Perfil', flex: 1.25, ...sortProps('role'), render: (u) => <RolePill role={u.role} /> },
    { key: 'status', label: 'Situação', flex: 1.1, ...sortProps('status'), render: (u) => <StatusPill active={u.active} /> },
    {
      key: 'access', label: 'Último acesso', flex: 1.4, ...sortProps('access'),
      render: (u) => <Text style={styles.cellText}>{formatAccess(u.last_sign_in_at) ?? '—'}</Text>,
    },
    {
      key: 'actions', label: 'Ações', flex: 0.7,
      render: (u) => {
        const self = u.id === me?.id;
        return (
          <ActionMenu
            accessibilityLabel={`Mais ações para ${u.full_name}`}
            actions={[
              { label: 'Abrir detalhes', icon: SlidersHorizontal, onPress: () => setPanel({ user: u }) },
              u.active
                ? {
                    label: 'Desativar usuário', icon: UserX, destructive: true, onPress: () => setToggling(u),
                    disabled: self, hint: self ? 'Não é possível desativar a própria conta.' : undefined,
                  }
                : { label: 'Ativar usuário', icon: UserCheck, onPress: () => setToggling(u) },
            ]}
            renderTrigger={(open) => (
              <Pressable
                onPress={open}
                accessibilityRole="button"
                accessibilityLabel={`Mais ações para ${u.full_name}`}
                style={({ hovered }: any) => [styles.kebab, transition(), hovered && styles.kebabHover]}
              >
                <EllipsisVertical size={18} strokeWidth={2} color={colors.text} />
              </Pressable>
            )}
          />
        );
      },
    },
  ];

  const footer = (
    <View style={styles.footer}>
      <Text style={styles.footerText}>
        {filtered.length === 0
          ? 'Nenhum usuário para mostrar'
          : `Mostrando ${from + 1} a ${Math.min(from + pageSize, filtered.length)} de ${filtered.length} ${filtered.length === 1 ? 'usuário' : 'usuários'}`}
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
            { label: 'Usuários' },
          ]}
          userName={me?.full_name}
          userRole={roleLabel[me?.role ?? 'viewer']}
          onUser={() => navigation.navigate('ProfileHome')}
          onNotifications={() => navigation.getParent()?.navigate('Pesagens', { screen: 'WeighingsList' })}
          onSignOut={signOut}
        />
      ) : (
        <Header title="Usuários" subtitle="Gestão de acessos" onBack={() => navigation.goBack()} />
      )}

      <View style={styles.split}>
        <ScrollView contentContainerStyle={isDesktop ? styles.deskScroll : styles.list}>
          {isDesktop ? (
            <PageHeader
              seal={<LeafSeal size={32} />}
              title="Usuários"
              titleSize={34}
              subtitle="Gestão de acessos"
              right={
                <View style={styles.headerRight}>
                  <View style={styles.todayRow}>
                    <Ionicons name="calendar-outline" size={15} color={colors.form.muted} />
                    <Text style={styles.today}>{formatLongDate()}</Text>
                  </View>
                  <Button
                    title="Novo usuário"
                    variant="cta"
                    size="lg"
                    iconComponent={UserPlus}
                    fullWidth={false}
                    onPress={() => setPanel({ user: null })}
                    style={styles.newButton}
                  />
                </View>
              }
            />
          ) : null}

          <MetricStrip items={[
            {
              label: 'Total de usuários', value: formatNumber(stats.total), icon: 'people-outline',
              ...(stats.growth !== null && Math.round(stats.growth) !== 0
                ? {
                    delta: `${Math.round(stats.growth)}%`,
                    deltaDirection: (stats.growth > 0 ? 'up' : 'down') as 'up' | 'down',
                    deltaLabel: 'vs. mês anterior',
                  }
                : { delta: '0%', deltaDirection: 'flat' as const, deltaLabel: 'sem variação' }),
            },
            {
              label: 'Usuários ativos', value: formatNumber(stats.active), icon: 'checkmark-circle-outline',
              tone: colors.success, delta: `${stats.share(stats.active)}%`, deltaDirection: 'flat', deltaLabel: 'do total',
            },
            {
              label: 'Usuários inativos', value: formatNumber(stats.inactive), icon: 'pause-circle-outline',
              tone: colors.pendingRing, delta: `${stats.share(stats.inactive)}%`, deltaDirection: 'flat', deltaLabel: 'do total',
            },
            {
              label: 'Administradores', value: formatNumber(stats.admins), icon: 'shield-checkmark-outline',
              tone: '#2C5BB8', delta: `${stats.share(stats.admins)}%`, deltaDirection: 'flat', deltaLabel: 'do total',
            },
          ]} />

          {/* ── Filtros ───────────────────────────────────────────────── */}
          <View style={[styles.card, elevation('sm')]}>
            <View style={isDesktop ? styles.filterRow : undefined}>
              <View style={isDesktop ? styles.searchCell : undefined}>
                <Input
                  size="form"
                  placeholder="Buscar usuários por nome, e-mail ou perfil..."
                  leftIconComponent={Search}
                  value={search}
                  onChangeText={(v) => { setSearch(v); setPage(1); }}
                />
              </View>
              <View style={isDesktop ? styles.filterCell : undefined}>
                <Select size="form" leftIcon="person" options={ROLE_FILTER} value={roleFilter}
                  onChange={(v) => { setRoleFilter(v); setPage(1); }} />
              </View>
              <View style={isDesktop ? styles.filterCell : undefined}>
                <Select size="form" leftIcon="ellipse" leftIconColor={colors.success} options={STATUS_FILTER} value={statusFilter}
                  onChange={(v) => { setStatusFilter(v); setPage(1); }} />
              </View>
              <View style={isDesktop ? styles.filterActions : undefined}>
                <Button
                  title="Mais filtros"
                  variant="outline"
                  iconComponent={SlidersHorizontal}
                  fullWidth={!isDesktop}
                  onPress={() => setMoreFilters((v) => !v)}
                  style={styles.filterButton}
                />
              </View>
            </View>

            {moreFilters ? (
              <View style={isDesktop ? styles.moreRow : undefined}>
                <View style={isDesktop ? styles.filterCell : undefined}>
                  <Select size="form" label="Último acesso" leftIcon="time" options={ACCESS_FILTER} value={accessFilter}
                    onChange={(v) => { setAccessFilter(v); setPage(1); }} />
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
                    {selected.size} {selected.size === 1 ? 'usuário selecionado' : 'usuários selecionados'}
                  </Text>
                  <View style={styles.bulkActions}>
                    <Button title="Ativar" variant="outline" iconComponent={UserCheck} fullWidth={false}
                      onPress={() => setBulk('activate')} style={styles.bulkButton} />
                    <Button title="Desativar" variant="dangerOutline" iconComponent={UserX} fullWidth={false}
                      onPress={() => setBulk('deactivate')} style={styles.bulkButton} />
                    <Button title="Limpar seleção" variant="ghost" fullWidth={false}
                      onPress={() => setSelected(new Set())} style={styles.bulkButton} />
                  </View>
                </View>
              ) : null}
              <DataTable
                items={visible}
                keyExtractor={(u) => u.id}
                rowHeight={60}
                onRowPress={(u) => setPanel({ user: u })}
                isRowSelected={(u) => panel?.user?.id === u.id}
                rowLabel={(u) => `Abrir detalhes de ${u.full_name}`}
                empty={<EmptyState title="Nenhum usuário encontrado" message="Ajuste a busca ou os filtros, ou cadastre um usuário." />}
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
                ListEmptyComponent={<EmptyState icon="people-outline" title="Nenhum usuário" message="Ajuste a busca ou toque em + para criar." />}
                renderItem={({ item }) => (
                  <Card onPress={() => setPanel({ user: item })}>
                    <View style={styles.row}>
                      <Avatar user={item} size={42} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{item.full_name}{item.id === me?.id ? ' (você)' : ''}</Text>
                        <Text style={styles.email}>{item.email}</Text>
                        <View style={styles.mobilePills}>
                          <RolePill role={item.role} />
                          <StatusPill active={item.active} />
                        </View>
                        <Text style={styles.mobileAccess}>Último acesso: {formatAccess(item.last_sign_in_at) ?? 'nunca'}</Text>
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
            <UserPanel
              user={panel.user}
              isSelf={panel.user?.id === me?.id}
              can={can}
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
              <UserPanel
                user={panel.user}
                isSelf={panel.user?.id === me?.id}
                can={can}
                onClose={() => setPanel(null)}
                onSaved={() => { setPanel(null); fetch(); }}
              />
            </View>
          </View>
        </Modal>
      ) : null}

      {!isDesktop && (
        <Pressable style={styles.fab} onPress={() => setPanel({ user: null })} accessibilityLabel="Novo usuário">
          <Ionicons name="person-add" size={26} color={colors.white} />
        </Pressable>
      )}

      <ConfirmModal
        visible={!!toggling}
        title={toggling?.active ? 'Desativar usuário?' : 'Ativar usuário?'}
        message={
          toggling?.active
            ? `${toggling?.full_name} perde o acesso ao sistema na próxima vez que entrar. Os registros feitos por essa pessoa continuam intactos.`
            : `${toggling?.full_name} volta a ter acesso com o perfil ${roleLabel[toggling?.role ?? 'viewer']}.`
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
            ? `${selected.size} ${selected.size === 1 ? 'conta volta' : 'contas voltam'} a ter acesso, cada uma com o perfil já definido.`
            : `${selected.size} ${selected.size === 1 ? 'conta perde' : 'contas perdem'} o acesso na próxima vez que tentarem entrar. Os registros continuam intactos.`
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
  // filtros ela só aumentaria o cartão, então a linha a devolve.
  filterRow: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: -22 },
  moreRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginTop: 22, marginBottom: -22 },
  searchCell: { flex: 1.8, minWidth: 240 },
  filterCell: { flex: 1.15, minWidth: 168 },
  filterActions: { paddingBottom: 22 },
  filterButton: { minHeight: 50, paddingHorizontal: 22, borderRadius: 8 },

  bulkBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
    backgroundColor: colors.brand[50], borderBottomWidth: 1, borderBottomColor: colors.greenLine,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  bulkText: { fontSize: 14, fontWeight: '600', color: colors.brand[700] },
  bulkActions: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  bulkButton: { minHeight: 38, paddingHorizontal: 16, borderRadius: 8 },

  userCell: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  userCellHover: { opacity: 0.8 },
  cellText: { fontSize: 13.5, color: '#45586B' },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full },
  pillDotted: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  pillText: { fontSize: 13, fontWeight: '700' },
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
    width: 416,
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
  mobilePills: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  mobileAccess: { fontSize: 12, color: colors.form.soft, marginTop: 8 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '700' },
  name: { fontSize: 14, fontWeight: '700', color: colors.text, letterSpacing: -0.2, flexShrink: 1 },
  email: { color: colors.textMuted, fontSize: 12.5, marginTop: 1 },
  fab: {
    position: 'absolute', right: spacing.lg, bottom: spacing.xl, width: 56, height: 56,
    borderRadius: radius.full, backgroundColor: colors.brand[700],
    alignItems: 'center', justifyContent: 'center',
    ...elevation('lg'),
  },
});
