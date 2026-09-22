import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Weighing } from '@/types';
import { colors, radius, spacing, transition } from '@/theme';
import { formatDate, formatTime, formatWeighingCode } from '@/utils/format';
import { DataTable, TableColumn } from './DataTable';
import { StatusBadge, Tag } from './StatusBadge';

/**
 * Últimas pesagens do painel.
 *
 * Diferente da `WeighingTable` da listagem, que agrupa campos em duas linhas
 * por célula para caber num espaço estreito: aqui cada campo tem sua coluna,
 * porque o painel serve para bater o olho e conferir, não para navegar. Um
 * campo por coluna é o que permite varrer a tabela na vertical.
 *
 * A massa vai alinhada à direita — números se comparam pela unidade, e com
 * alinhamento à esquerda "8,20" e "25,00" não compartilham casa decimal.
 */
export function LatestWeighingsTable({
  items,
  onOpen,
  empty,
  compact,
}: {
  items: Weighing[];
  onOpen: (id: string) => void;
  empty?: React.ReactNode;
  /**
   * Prévia em meia largura (central de relatórios): sem resíduo e tratamento,
   * data e hora numa linha só. Com as nove colunas em meia tela cada célula
   * ficaria estreita demais para o nome do cliente.
   */
  compact?: boolean;
}) {
  const columns: TableColumn<Weighing>[] = [
        {
          key: 'code',
          label: '#',
          flex: 0.7,
          render: (w) => <Text style={s.code}>{formatWeighingCode(w)}</Text>,
        },
        {
          key: 'date',
          label: 'Data e hora',
          flex: compact ? 1.4 : 1.1,
          render: (w: Weighing) => compact ? (
            <Text style={[s.primary, s.small]} numberOfLines={1}>
              {formatDate(w.weighing_date)}  {formatTime(w.weighing_date)}
            </Text>
          ) : (
            <View style={s.stackedCell}>
              <Text style={s.primary}>{formatDate(w.weighing_date)}</Text>
              <Text style={s.time}>{formatTime(w.weighing_date)}</Text>
            </View>
          ),
        },
        {
          key: 'client',
          label: 'Cliente',
          flex: 1.15,
          render: (w) => (
            <Text style={[s.primary, compact && s.small]} numberOfLines={1}>
              {w.client?.name ?? '—'}
            </Text>
          ),
        },
        {
          key: 'unit',
          label: 'Unidade',
          flex: 1.25,
          render: (w) => (
            <Text style={[s.primary, compact && s.small]} numberOfLines={1}>
              {w.unit?.name ?? '—'}
            </Text>
          ),
        },
        {
          key: 'waste',
          label: 'Resíduo',
          flex: 1.2,
          render: (w) => (
            <Text style={s.primary} numberOfLines={1}>
              {w.waste_type?.name ?? '—'}
            </Text>
          ),
        },
        {
          key: 'weight',
          label: 'Peso (kg)',
          flex: 0.9,
          render: (w) => (
            <Text style={s.weight}>
              {Number(w.weight_kg ?? 0).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
          ),
        },
        {
          key: 'treatment',
          label: 'Tratamento',
          flex: 1.05,
          render: (w) => (
            <Text style={s.primary} numberOfLines={1}>
              {w.treatment_type?.name ?? '—'}
            </Text>
          ),
        },
        {
          key: 'status',
          label: 'Status',
          flex: 1.75,
          render: (w) =>
            w.canceled_at ? (
              <Tag label="Cancelada" color={colors.textMuted} bg={colors.surfaceSunken} dot />
            ) : (
              <StatusBadge status={w.approval_status} small={compact} />
            ),
        },
        {
          key: 'actions',
          label: compact ? '' : 'Ações',
          flex: 0.5,
          render: (w) => (
            <Pressable
              onPress={() => onOpen(w.id)}
              accessibilityRole="button"
              accessibilityLabel={`Abrir pesagem ${formatWeighingCode(w)}`}
              style={({ hovered }: any) => [s.action, transition(), hovered && s.actionHover]}
            >
              <Ionicons name="ellipsis-vertical" size={16} color={colors.textMuted} />
            </Pressable>
          ),
        },
  ];
  return (
    <DataTable
      items={items}
      keyExtractor={(w) => w.id}
      empty={empty}
      dense={compact}
      columns={compact ? columns.filter((c) => c.key !== 'waste' && c.key !== 'treatment').map(narrow) : columns}
    />
  );
}

/**
 * Larguras da prévia, medidas no desenho da central de relatórios (em px,
 * usados como pesos). Status é a coluna mais larga: "Aguardando validação" é
 * o maior texto da linha e não pode ser cortado — é a informação que diz se o
 * registro ainda pode mudar.
 */
const COMPACT_FLEX: Record<string, number> = {
  code: 63, date: 125, client: 118, unit: 118, weight: 80, status: 151, actions: 42,
};
const narrow = (c: TableColumn<Weighing>) => ({ ...c, flex: COMPACT_FLEX[c.key] ?? c.flex });

const s = StyleSheet.create({
  code: { color: colors.text, fontSize: 12.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  stackedCell: { gap: 1 },
  primary: { color: colors.text, fontSize: 13 },
  small: { fontSize: 12.5 },
  time: { color: colors.textSoft, fontSize: 11.5, fontVariant: ['tabular-nums'] },
  weight: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  action: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  actionHover: { backgroundColor: colors.surfaceSunken },
});
