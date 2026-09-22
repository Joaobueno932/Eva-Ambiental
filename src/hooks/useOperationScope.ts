import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { showAlert } from '@/utils/alert';
import { getDashboardStats } from '@/services/dashboard';
import { listWeighings } from '@/services/weighings';
import { listClients, listUnits } from '@/services/masters';
import { Client, DashboardStats, Unit, Weighing } from '@/types';
import { buildPreset, DateRange } from '@/utils/dateRanges';
import { operationSummary } from '@/utils/operations';
import { formatDelta } from '@/utils/format';
import { generateCsvReport, generatePdfReport, generateXlsxReport } from '@/utils/reports';

/** Presets do filtro de período, na ordem do mais curto ao mais longo. */
export const PERIOD_OPTIONS = [
  { label: 'Hoje', value: 'today' },
  { label: 'Esta Semana', value: 'week' },
  { label: 'Este Mês', value: 'month' },
  { label: 'Este Ano', value: 'year' },
  { label: 'Personalizado', value: 'custom' },
];

export type ExportType = 'xlsx' | 'pdf' | 'csv';

/**
 * Escopo da operação: período, cliente e unidade, e os dados que eles recortam.
 *
 * Compartilhado entre o painel e a central de relatórios, que olham o mesmo
 * recorte de ângulos diferentes — um para acompanhar, o outro para exportar.
 * Antes o relatório era o painel com uma chave `reportsOnly` espalhada em dez
 * condicionais; com os dois layouts divergindo, o que eles de fato dividem é
 * isto aqui, não a tela.
 *
 * Filtros em duas camadas: o que está nos controles (`draft`) e o que os
 * números refletem. No painel o botão "Aplicar filtros" promove um no outro —
 * com três filtros, cada toque num select disparando uma consulta recarregaria
 * a tela três vezes para montar um recorte só. Na central de relatórios não há
 * esse botão (`autoApply`): lá o recorte é o assunto da página, e ver o
 * conjunto mudar a cada escolha é justamente o que se quer.
 */
export function useOperationScope({ autoApply = false }: { autoApply?: boolean } = {}) {
  const loadVersion = useRef(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [records, setRecords] = useState<Weighing[]>([]);
  const [range, setRange] = useState<DateRange>(buildPreset('month'));
  const [clientId, setClientId] = useState<string>('');
  const [unitId, setUnitId] = useState<string>('');
  const [draftRange, setDraftRange] = useState<DateRange>(range);
  const [draftClientId, setDraftClientId] = useState<string>('');
  const [draftUnitId, setDraftUnitId] = useState<string>('');
  const [clients, setClients] = useState<Client[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadMasters = useCallback(async () => {
    try {
      const [c, u] = await Promise.all([listClients(true), listUnits(true)]);
      setClients(c);
      setUnits(u);
    } catch {
      /* silencioso — filtros opcionais */
    }
  }, []);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getDashboardStats({
        startDate: range.startDate,
        endDate: range.endDate,
        clientId: clientId || undefined,
        unitId: unitId || undefined,
        presetKey: range.key,
      });
      const rows = await listWeighings({ startDate: range.startDate, endDate: range.endDate, clientId: clientId || undefined, unitId: unitId || undefined });
      if (version !== loadVersion.current) return;
      setRecords(rows);
      setStats(data);
    } catch (e: any) {
      if (version === loadVersion.current) setLoadError(e?.message ?? 'Falha ao carregar o painel.');
    } finally {
      if (version === loadVersion.current) { setLoading(false); setRefreshing(false); }
    }
  }, [range, clientId, unitId]);

  useFocusEffect(
    useCallback(() => {
      loadMasters();
      load();
    }, [loadMasters, load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  // Unidades exibidas no filtro: todas, ou apenas as do cliente selecionado.
  const filteredUnits = useMemo(
    () => (draftClientId ? units.filter((u) => u.client_id === draftClientId) : units),
    [units, draftClientId]
  );
  const clientOptions = useMemo(
    () => [{ label: 'Todos os clientes', value: '' }, ...clients.map((c) => ({ label: c.name, value: c.id }))],
    [clients]
  );
  const unitOptions = useMemo(
    () => [{ label: 'Todas as unidades', value: '' }, ...filteredUnits.map((u) => ({ label: u.name, value: u.id }))],
    [filteredUnits]
  );

  const onChangeClient = (v: string) => {
    setDraftClientId(v);
    // Se a unidade selecionada não pertence ao novo cliente, limpa a seleção.
    if (v && draftUnitId) {
      const stillValid = units.some((u) => u.id === draftUnitId && u.client_id === v);
      if (!stillValid) setDraftUnitId('');
    }
  };

  /**
   * Troca o preset de período.
   *
   * "Personalizado" não resolve datas sozinho — mantém as que já estavam e
   * abre o seletor, para o campo não ficar vazio enquanto se escolhe.
   */
  const onChangePeriod = (key: string) => {
    if (key === 'custom') {
      setDraftRange({ ...draftRange, key: 'custom', label: 'Personalizado' });
      return;
    }
    setDraftRange(buildPreset(key as 'today' | 'week' | 'month' | 'year'));
  };

  /** Promove o rascunho: é aqui, e só aqui, que a consulta é refeita. */
  const applyFilters = useCallback(() => {
    setRange(draftRange);
    setClientId(draftClientId);
    setUnitId(draftUnitId);
  }, [draftRange, draftClientId, draftUnitId]);

  // Sem botão de aplicar, todo rascunho vale na hora.
  useEffect(() => {
    if (autoApply) applyFilters();
  }, [autoApply, applyFilters]);

  const clearFilters = () => {
    const base = buildPreset('month');
    setDraftClientId('');
    setDraftUnitId('');
    setDraftRange(base);
    setClientId('');
    setUnitId('');
    setRange(base);
  };

  // Há rascunho pendente de aplicação? Decide o destaque do botão.
  const dirtyFilters =
    draftClientId !== clientId ||
    draftUnitId !== unitId ||
    draftRange.startDate !== range.startDate ||
    draftRange.endDate !== range.endDate;

  const clientName = clients.find((c) => c.id === clientId)?.name;
  const unitName = units.find((u) => u.id === unitId)?.name;
  const hasEntityFilter = !!clientId || !!unitId;

  const exportReport = async (type: ExportType) => {
    if (!stats) return;
    setExporting(true);
    try {
      const weighings = await listWeighings({
        startDate: range.startDate,
        endDate: range.endDate,
        clientId: clientId || undefined,
        unitId: unitId || undefined,
        excludeCanceled: true,
      });
      const scope = [clientName, unitName].filter(Boolean).join(' • ');
      const periodLabel = scope ? `${range.label} — ${scope}` : range.label;
      const ctx = { periodLabel, stats, weighings };
      if (type === 'xlsx') await generateXlsxReport(ctx);
      else if (type === 'pdf') await generatePdfReport(ctx);
      else await generateCsvReport(ctx);
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao gerar relatório.');
    } finally {
      setExporting(false);
    }
  };

  const operations = operationSummary(records);

  /**
   * Traduz uma variação do serviço nas props do cartão.
   *
   * Devolve objeto vazio quando não há comparação — o cartão então não mostra
   * selo algum, em vez de um "0%" que se confundiria com "não mudou".
   */
  const deltaProps = (value: number | null | undefined, kind: 'percent' | 'points' = 'percent') => {
    if (value == null || !stats?.trend) return {};
    // Arredonda antes de decidir a direção: +0,4% exibido como "0%" com uma
    // seta para cima seria uma seta apontando para nada.
    const rounded = kind === 'points' ? Number(value.toFixed(1)) : Math.round(value);
    return {
      delta: formatDelta(rounded, kind),
      deltaDirection: (rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat') as 'up' | 'down' | 'flat',
      deltaLabel: rounded === 0 ? 'sem variação' : stats.trend.label,
    };
  };

  return {
    // dados
    records, stats, clients, units, operations,
    loading, loadError, refreshing, exporting,
    // escopo aplicado
    range, clientId, unitId, clientName, unitName, hasEntityFilter,
    // rascunho e controles
    draftRange, setDraftRange, draftClientId, draftUnitId, setDraftUnitId,
    clientOptions, unitOptions, dirtyFilters,
    onChangeClient, onChangePeriod, applyFilters, clearFilters,
    // ações
    load, onRefresh, exportReport, deltaProps,
  };
}
