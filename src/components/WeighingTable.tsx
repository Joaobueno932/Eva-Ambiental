import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Weighing } from '@/types';
import { colors, transition } from '@/theme';
import { formatDate, formatWeight } from '@/utils/format';
import { DataTable } from './DataTable';
import { StatusBadge, Tag } from './StatusBadge';

export function WeighingTable({ items, onOpen, empty }: { items: Weighing[]; onOpen: (id: string) => void; empty?: React.ReactNode }) {
  return <DataTable items={items} keyExtractor={w => w.id} empty={empty} columns={[
    {
      key: 'record', label: 'Registro / resíduo', flex: 1.6, render: w => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Abrir pesagem ${w.id}`}
          onPress={() => onOpen(w.id)}
          style={({ hovered }: any) => [s.link, transition('color')]}
        >
          {({ hovered }: any) => (
            <>
              <Text style={[s.linkText, hovered && s.linkTextHover]} numberOfLines={1}>
                {w.waste_type?.name ?? 'Resíduo não informado'}
              </Text>
              <Text style={s.linkMeta}>#{w.id.slice(0, 8)} · {formatDate(w.weighing_date)}</Text>
            </>
          )}
        </Pressable>
      ),
    },
    {
      key: 'origin', label: 'Origem', flex: 1.5, render: w => (
        <View>
          <Text style={s.primary} numberOfLines={1}>{w.unit?.name ?? '—'}</Text>
          <Text style={s.secondary} numberOfLines={1}>{w.client?.name}</Text>
        </View>
      ),
    },
    { key: 'weight', label: 'Massa', render: w => <Text style={s.weight}>{formatWeight(w.weight_kg)}</Text> },
    { key: 'treatment', label: 'Tratamento', render: w => <Text style={s.primary} numberOfLines={2}>{w.treatment_type?.name ?? '—'}</Text> },
    {
      key: 'status', label: 'Situação', render: w => w.canceled_at
        ? <Tag label="Cancelada" color={colors.textMuted} bg={colors.surfaceSunken} dot />
        : <StatusBadge status={w.approval_status} />,
    },
  ]} />;
}

const s = StyleSheet.create({
  link: { minHeight: 40, justifyContent: 'center' },
  linkText: { color: colors.brand[700], fontWeight: '700', fontSize: 13.5 },
  linkTextHover: { color: colors.brand[500], textDecorationLine: 'underline' },
  linkMeta: { color: colors.textSoft, fontSize: 11.5, marginTop: 3, fontVariant: ['tabular-nums'] },
  primary: { color: colors.text, fontSize: 13.5 },
  secondary: { color: colors.textSoft, fontSize: 11.5, marginTop: 2 },
  weight: { color: colors.text, fontWeight: '700', fontSize: 13.5, fontVariant: ['tabular-nums'] },
});
