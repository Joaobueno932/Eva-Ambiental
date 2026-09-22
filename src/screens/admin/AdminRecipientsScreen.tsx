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
import Search from 'lucide-react-native/icons/search';
import SlidersHorizontal from 'lucide-react-native/icons/sliders-horizontal';
import Truck from 'lucide-react-native/icons/truck';
import UserPlus from 'lucide-react-native/icons/user-plus';
import { Button, Card, Checkbox, ConfirmModal, EmptyState, Header, Input, Loading, Select, Topbar } from '@/components';
import { ActionMenu } from '@/components/ActionMenu';
import { DataTable, TableColumn } from '@/components/DataTable';
import { PageHeader } from '@/components/FormKit';
import { MetricStrip } from '@/components/Operations';
import { colors, elevation, gradient, layout, radius, spacing, transition } from '@/theme';
import { useIsDesktop, useIsWide } from '@/hooks/useLayout';
import { useAuth } from '@/contexts/AuthContext';
import { listRecipientsWithUsage, RecipientUsage, setRecipientActive } from '@/services/masters';
import { columnCheck } from '@/utils/columns';
import { Recipient } from '@/types';
import { formatAccess, formatDocument, formatLongDate, formatNumber, roleLabel } from '@/utils/format';
import { exportRecipientsCsv, exportRecipientsXlsx } from '@/utils/recipientExport';
import { RecipientPanel, recipientStatus, STATUS_LOOK, typeIcon } from './RecipientPanel';

const STATUS_FILTER = [
  { label: 'Todas as situações', value: '' },
  { label: 'Ativos', value: 'active' },
  { label: 'Pendentes', value: 'pending' },
  { label: 'Inativos', value: 'inactive' },
];
const LICENSE_FILTER = [
  { label: 'Todas as licenças', value: '' },
  { label: 'Com licença ambiental', value: 'yes' },
  { label: 'Sem licença ambiental', value: 'no' },
];
const PAGE_SIZES = [10, 25, 50].map((n) => ({ label: `${n} por página`, value: String(n) }));

type SortKey = 'name' | 'type' | 'city' | 'license' | 'status' | 'updated';
type Sort = { key: SortKey; dir: 'asc' | 'desc'; chosen: boolean };

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/** Iniciais das duas primeiras palavras: "Recicla Verde Ltda." → "RV". */
function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || '?';
}

/**
 * Cor do avatar derivada do destinatário, não da posição na lista.
 *
 * Pela posição, o mesmo destinatário mudaria de cor a cada ordenação ou
 * filtro — e a cor é o que ajuda a reconhecê-lo de relance.
 */
function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return colors.avatars[Math.abs(h) % colors.avatars.length];
}

function Avatar({ recipient, size = 30 }: { recipient: Recipient; size?: number }) {
  const c = avatarColor(recipient.id);
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.bg }]}>
      <Text style={[styles.avatarText, { color: c.fg, fontSize: size * 0.37 }]}>{initials(recipient.name)}</Text>
    </View>
  );
}

/** Situação em pílula: três estados, cada um com sua cor. */
function StatusPill({ recipient }: { recipient: Recipient }) {
  const look = STATUS_LOOK[recipientStatus(recipient)];
  return (
    <View style={[styles.pill, styles.pillDotted, { backgroundColor: look.bg }]}>
      <View style={[styles.dot, { backgroundColor: look.fg }]} />
      <Text style={[styles.pillText, { color: look.fg }]}>{look.label}</Text>
    </View>
  );
}

/**
 * Destinatários.
 *
 * É o cadastro de para onde o resíduo vai: o tipo de destinação separa
 * reciclagem de aterro (e é ele que decide o que o painel conta como
 * disposição final), e a licença ambiental é o documento que autoriza o
 * destino a receber. Por isso os indicadores contam quantos têm licença e
 * quantos receberam pesagem no mês.
 */
export function AdminRecipientsScreen() {
  const navigation = useNavigation<any>();
  const { profile: me, signOut } = useAuth();
  const isDesktop = useIsDesktop();
  const isWide = useIsWide();

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [usage, setUsage] = useState<Record<string, RecipientUsage>>({});
  /** Colunas que a tabela `recipients` tem de fato — ver `columnCheck`. */
  const [dbColumns, setDbColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [licenseFilter, setLicenseFilter] = useState('');
  const [moreFilters, setMoreFilters] = useState(false);
  const [sort, setSort] = useState<Sort>({ key: 'updated', dir: 'desc', chosen: false });
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<{ recipient: Recipient | null } | null>(null);
  const [bulk, setBulk] = useState<'activate' | 'deactivate' | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toggling, setToggling] = useState<Recipient | null>(null);
  const [togglingBusy, setTogglingBusy] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listRecipientsWithUsage();
      setRecipients(data.recipients);
      setUsage(data.usage);
      setDbColumns(data.columns);
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao carregar destinatários.');
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

  /** Indicadores do topo. */
  const summary = useMemo(() => {
    const total = recipients.length;
    const active = recipients.filter((r) => recipientStatus(r) === 'active').length;
    const licensed = recipients.filter((r) => !!r.license_number?.trim()).length;
    const linked = recipients.filter((r) => (usage[r.id]?.month ?? 0) > 0).length;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const before = recipients.filter((r) => r.created_at && new Date(r.created_at) < monthStart).length;

    const share = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
    return {
      total,
      active,
      licensed,
      linked,
      growth: before > 0 ? ((total - before) / before) * 100 : null,
      share,
    };
  }, [recipients, usage]);

  /**
   * Opções de tipo e cidade vindas do que está cadastrado.
   *
   * Sem a migração 0014 essas colunas não existem, os filtros ficam sem opção
   * alguma e por isso não são desenhados — um filtro vazio é um controle
   * decorativo.
   */
  const typeOptions = useMemo(() => {
    const values = Array.from(new Set(recipients.map((r) => r.type).filter(Boolean) as string[]));
    values.sort(collator.compare);
    return [{ label: 'Todos os tipos', value: '' }, ...values.map((v) => ({ label: v, value: v }))];
  }, [recipients]);

  const cityOptions = useMemo(() => {
    const values = Array.from(new Set(recipients.map((r) => r.city).filter(Boolean) as string[]));
    values.sort(collator.compare);
    return [{ label: 'Todas as cidades', value: '' }, ...values.map((v) => ({ label: v, value: v }))];
  }, [recipients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    const rows = recipients.filter((r) => {
      if (q) {
        const haystack = [r.name, r.document, formatDocument(r.document), r.city, r.contact_name, r.license_number]
          .filter(Boolean).join(' ').toLocaleLowerCase();
        // O CNPJ é procurado também sem pontuação: quem copia de uma nota cola
        // "12345678000190", e quem lê da tela digita com pontos.
        const digits = q.replace(/\D/g, '');
        const matchDigits = digits.length >= 3 && (r.document ?? '').replace(/\D/g, '').includes(digits);
        if (!haystack.includes(q) && !matchDigits) return false;
      }
      if (typeFilter && r.type !== typeFilter) return false;
      if (cityFilter && r.city !== cityFilter) return false;
      if (statusFilter && recipientStatus(r) !== statusFilter) return false;
      if (licenseFilter) {
        const has = !!r.license_number?.trim();
        if ((licenseFilter === 'yes') !== has) return false;
      }
      return true;
    });

    const dir = sort.dir === 'asc' ? 1 : -1;
    const compare = (a: Recipient, b: Recipient): number => {
      switch (sort.key) {
        case 'name': return collator.compare(a.name, b.name);
        case 'type': return collator.compare(a.type ?? '', b.type ?? '');
        case 'city': return collator.compare(a.city ?? '', b.city ?? '');
        case 'license': return collator.compare(a.license_number ?? '', b.license_number ?? '');
        case 'status': return collator.compare(recipientStatus(a), recipientStatus(b));
        case 'updated': return (a.updated_at ?? a.created_at ?? '').localeCompare(b.updated_at ?? b.created_at ?? '');
      }
    };
    return rows.sort((a, b) => compare(a, b) * dir || collator.compare(a.name, b.name));
  }, [recipients, search, typeFilter, cityFilter, statusFilter, licenseFilter, sort]);

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
    setTypeFilter('');
    setCityFilter('');
    setStatusFilter('');
    setLicenseFilter('');
    setPage(1);
  };

  const allSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) visible.forEach((r) => next.delete(r.id));
      else visible.forEach((r) => next.add(r.id));
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
        recipients.filter((r) => selected.has(r.id))
          .map((r) => setRecipientActive(r.id, bulk === 'activate', can('status')))
      );
      setBulk(null);
      setSelected(new Set());
      await fetch();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao alterar os destinatários selecionados.');
    } finally {
      setBulkBusy(false);
    }
  };

  const confirmToggle = async () => {
    if (!toggling) return;
    setTogglingBusy(true);
    try {
      await setRecipientActive(toggling.id, !toggling.active, can('status'));
      setToggling(null);
      await fetch();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao alterar a situação do destinatário.');
    } finally {
      setTogglingBusy(false);
    }
  };

  const exportAs = async (type: 'csv' | 'xlsx') => {
    try {
      const rows = filtered.map((r) => ({ recipient: r, usage: usage[r.id] ?? null }));
      if (type === 'csv') await exportRecipientsCsv(rows);
      else await exportRecipientsXlsx(rows);
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao exportar destinatários.');
    }
  };

  const sortProps = (key: SortKey) => ({
    onSort: () => toggleSort(key),
    sort: sort.chosen && sort.key === key ? sort.dir : null,
  });

  const columns: TableColumn<Recipient>[] = [
    {
      key: 'check', label: '', flex: 0.45,
      renderHeader: () => (
        <Checkbox
          checked={allSelected}
          indeterminate={!allSelected && someSelected}
          onToggle={toggleAll}
          disabled={visible.length === 0}
          label="Selecionar todos os destinatários da página"
        />
      ),
      render: (r) => (
        <Checkbox checked={selected.has(r.id)} onToggle={() => toggleOne(r.id)} label={`Selecionar ${r.name}`} />
      ),
    },
    {
      key: 'name', label: 'Destinatário', flex: 2.07, ...sortProps('name'),
      // O nome é o alvo acessível da linha: dá para chegar nele por teclado,
      // enquanto o clique em qualquer ponto da linha é atalho de mouse.
      render: (r) => (
        <Pressable
          onPress={() => setPanel({ recipient: r })}
          accessibilityRole="button"
          accessibilityLabel={`Abrir detalhes de ${r.name}`}
          style={({ hovered }: any) => [styles.nameCell, transition('opacity'), hovered && styles.nameCellHover]}
        >
          <Avatar recipient={r} />
          <Text style={styles.name} numberOfLines={2}>{r.name}</Text>
        </Pressable>
      ),
    },
    {
      key: 'type', label: 'Tipo', flex: 1.32, ...sortProps('type'),
      render: (r) => <Text style={styles.cellText} numberOfLines={2}>{r.type || '—'}</Text>,
    },
    {
      key: 'city', label: 'Cidade/UF', flex: 1.35, ...sortProps('city'),
      render: (r) => (
        <Text style={styles.cellText} numberOfLines={2}>
          {[r.city, r.state].filter(Boolean).join('/') || '—'}
        </Text>
      ),
    },
    {
      key: 'license', label: 'Licença ambiental', flex: 1.57, ...sortProps('license'),
      render: (r) => (
        <Text style={[styles.cellText, !r.license_number && styles.cellEmpty]} numberOfLines={1}>
          {r.license_number || 'Sem licença'}
        </Text>
      ),
    },
    { key: 'status', label: 'Situação', flex: 1, ...sortProps('status'), render: (r) => <StatusPill recipient={r} /> },
    {
      // Sem a migração 0014 não há `updated_at`: a coluna então diz o que de
      // fato mostra, a data do cadastro.
      key: 'updated', label: can('updated_at') ? 'Última atualização' : 'Cadastrado em', flex: 1.64, ...sortProps('updated'),
      render: (r) => (
        <Text style={styles.cellText} numberOfLines={1}>
          {formatAccess(can('updated_at') ? r.updated_at ?? r.created_at : r.created_at) ?? '—'}
        </Text>
      ),
    },
    {
      key: 'actions', label: 'Ações', flex: 0.6,
      render: (r) => (
        <ActionMenu
          accessibilityLabel={`Mais ações para ${r.name}`}
          actions={[
            { label: 'Abrir detalhes', icon: SlidersHorizontal, onPress: () => setPanel({ recipient: r }) },
            r.active
              ? { label: 'Desativar destinatário', icon: Ban, destructive: true, onPress: () => setToggling(r) }
              : { label: 'Ativar destinatário', icon: CircleCheck, onPress: () => setToggling(r) },
          ]}
          renderTrigger={(open) => (
            <Pressable
              onPress={open}
              accessibilityRole="button"
              accessibilityLabel={`Mais ações para ${r.name}`}
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
          ? 'Nenhum destinatário para mostrar'
          : `Mostrando ${from + 1} a ${Math.min(from + pageSize, filtered.length)} de ${filtered.length} ${filtered.length === 1 ? 'destinatário' : 'destinatários'}`}
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
            { label: 'Destinatários' },
          ]}
          userName={me?.full_name}
          userRole={roleLabel[me?.role ?? 'viewer']}
          onUser={() => navigation.navigate('ProfileHome')}
          onNotifications={() => navigation.getParent()?.navigate('Pesagens', { screen: 'WeighingsList' })}
          onSignOut={signOut}
        />
      ) : (
        <Header title="Destinatários" subtitle="Destinos e parceiros" onBack={() => navigation.goBack()} />
      )}

      <View style={styles.split}>
        <ScrollView contentContainerStyle={isDesktop ? styles.deskScroll : styles.list}>
          {isDesktop ? (
            <PageHeader
              // Mesmo glifo do item no menu: a página e o menu não podem usar
              // símbolos diferentes para a mesma coisa.
              seal={<Truck size={30} strokeWidth={2} color={colors.form.tileIcon} />}
              title="Destinatários"
              titleSize={34}
              subtitle="Gestão dos destinos e parceiros de recebimento"
              right={
                <View style={styles.headerRight}>
                  <View style={styles.todayRow}>
                    <Ionicons name="calendar-outline" size={15} color={colors.form.muted} />
                    <Text style={styles.today}>{formatLongDate()}</Text>
                  </View>
                  <Button
                    title="Novo destinatário"
                    variant="cta"
                    size="lg"
                    iconComponent={UserPlus}
                    fullWidth={false}
                    onPress={() => setPanel({ recipient: null })}
                    style={styles.newButton}
                  />
                </View>
              }
            />
          ) : null}

          <MetricStrip items={[
            {
              label: 'Total de destinatários', value: formatNumber(summary.total), icon: 'people-outline',
              ...deltaProps(summary.growth),
            },
            {
              label: 'Destinatários ativos', value: formatNumber(summary.active), icon: 'ellipse',
              tone: colors.success, delta: `${summary.share(summary.active)}%`, deltaDirection: 'flat', deltaLabel: 'do total',
            },
            // Sem a migração 0014 não há coluna de licença: "0 com licença"
            // seria uma afirmação sobre o cadastro, quando o que falta é a
            // coluna.
            {
              label: 'Com licença ambiental', value: can('license_number') ? formatNumber(summary.licensed) : '—',
              valueSize: can('license_number') ? undefined : 22,
              icon: 'document-text-outline', tone: colors.pendingRing,
              ...(can('license_number')
                ? { delta: `${summary.share(summary.licensed)}%`, deltaDirection: 'flat' as const, deltaLabel: 'do total' }
                : { hint: 'Disponível após a migração 0014' }),
            },
            {
              label: 'Com vínculo no mês', value: formatNumber(summary.linked), icon: 'link-outline',
              tone: '#2C5BB8', delta: `${summary.share(summary.linked)}%`, deltaDirection: 'flat', deltaLabel: 'do total',
            },
          ]} />

          {/* ── Filtros ───────────────────────────────────────────────── */}
          <View style={[styles.card, elevation('sm')]}>
            <View style={isDesktop ? styles.filterRow : undefined}>
              <View style={isDesktop ? styles.searchCell : undefined}>
                <Input
                  size="form"
                  placeholder="Buscar por nome, CNPJ ou cidade..."
                  leftIconComponent={Search}
                  value={search}
                  onChangeText={(v) => { setSearch(v); setPage(1); }}
                />
              </View>
              {typeOptions.length > 1 ? (
                <View style={isDesktop ? styles.filterCell : undefined}>
                  <Select size="form" options={typeOptions} value={typeFilter}
                    onChange={(v) => { setTypeFilter(v); setPage(1); }} />
                </View>
              ) : null}
              {cityOptions.length > 1 ? (
                <View style={isDesktop ? styles.filterCell : undefined}>
                  <Select size="form" options={cityOptions} value={cityFilter}
                    onChange={(v) => { setCityFilter(v); setPage(1); }} />
                </View>
              ) : null}
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
                  <Select size="form" label="Licença ambiental" options={LICENSE_FILTER} value={licenseFilter}
                    onChange={(v) => { setLicenseFilter(v); setPage(1); }} />
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
                    {selected.size} {selected.size === 1 ? 'destinatário selecionado' : 'destinatários selecionados'}
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
                keyExtractor={(r) => r.id}
                rowHeight={46}
                onRowPress={(r) => setPanel({ recipient: r })}
                isRowSelected={(r) => panel?.recipient?.id === r.id}
                rowLabel={(r) => `Abrir detalhes de ${r.name}`}
                empty={<EmptyState title="Nenhum destinatário encontrado" message="Ajuste a busca ou os filtros, ou cadastre um destinatário." />}
                columns={columns}
              />
              {footer}
            </View>
          ) : (
            <>
              <FlatList
                scrollEnabled={false}
                data={visible}
                keyExtractor={(r) => r.id}
                ListEmptyComponent={<EmptyState icon="car-outline" title="Nenhum destinatário" message="Ajuste a busca ou toque em + para cadastrar." />}
                renderItem={({ item }) => (
                  <Card onPress={() => setPanel({ recipient: item })}>
                    <View style={styles.row}>
                      <Avatar recipient={item} size={42} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.name, styles.nameMobile]}>{item.name}</Text>
                        <Text style={styles.mobileSub}>
                          {[item.type, [item.city, item.state].filter(Boolean).join('/')].filter(Boolean).join(' · ')
                            || formatDocument(item.document) || 'Sem classificação'}
                        </Text>
                        <View style={styles.mobilePills}>
                          <StatusPill recipient={item} />
                          <Text style={styles.mobileLicense}>{item.license_number || 'Sem licença'}</Text>
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
            <RecipientPanel
              recipient={panel.recipient}
              usage={panel.recipient ? usage[panel.recipient.id] : undefined}
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
              <RecipientPanel
                recipient={panel.recipient}
                usage={panel.recipient ? usage[panel.recipient.id] : undefined}
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
        <Pressable style={styles.fab} onPress={() => setPanel({ recipient: null })} accessibilityLabel="Novo destinatário">
          <Ionicons name="add" size={28} color={colors.white} />
        </Pressable>
      )}

      <ConfirmModal
        visible={!!toggling}
        title={toggling?.active ? 'Desativar destinatário?' : 'Ativar destinatário?'}
        message={
          toggling?.active
            ? `${toggling?.name} deixa de aparecer na escolha de novas pesagens. As pesagens já enviadas para ele continuam nos relatórios.`
            : `${toggling?.name} volta a aparecer na escolha de destinatário das novas pesagens.`
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
            ? `${selected.size} ${selected.size === 1 ? 'destinatário volta' : 'destinatários voltam'} a aparecer na escolha das novas pesagens.`
            : `${selected.size} ${selected.size === 1 ? 'destinatário deixa' : 'destinatários deixam'} de aparecer para novas pesagens. As pesagens já enviadas continuam nos relatórios.`
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
  searchCell: { flex: 1.5, minWidth: 240 },
  // 240px é o mínimo que cabe "Todas as situações" sem cortar.
  filterCell: { flex: 1, minWidth: 240, maxWidth: 320 },
  filterCellWide: { flex: 1.2, minWidth: 220 },
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
  cellText: { fontSize: 12, color: '#45586B', lineHeight: 16 },
  cellEmpty: { color: colors.form.soft },
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
  mobileLicense: { fontSize: 12.5, color: colors.form.soft },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '700' },
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
