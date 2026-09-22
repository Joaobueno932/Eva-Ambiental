import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, gradient, gradients, radius, spacing, transition } from '@/theme';

export interface TableColumn<T> { key: string; label: string; flex?: number; render: (item: T) => React.ReactNode }

/**
 * Linha com realce sob o ponteiro.
 *
 * `Pressable` daria o estado de hover pronto, mas a linha já contém o botão
 * que abre o registro — aninhar áreas clicáveis confunde leitor de tela e
 * ordem de foco. O react-native-web repassa `onMouseEnter`/`onMouseLeave` do
 * `View` para o DOM, e no Android eles simplesmente não são chamados.
 */
function Row({ children, last }: { children: React.ReactNode; last?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const hoverProps = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  } as any;
  return (
    <View {...hoverProps} style={[s.row, transition('background-color'), hovered && s.rowHover, last && s.lastRow]}>
      {children}
    </View>
  );
}

/**
 * Tabela do site — no celular as listas continuam em cartões.
 *
 * Sem zebra: o listrado resolve alinhamento em tabela impressa, mas na tela
 * compete com a própria informação. Aqui a leitura é guiada pela divisória
 * fina e pelo realce da linha sob o ponteiro.
 */
export function DataTable<T>({ items, columns, keyExtractor, empty }: {
  items: T[]; columns: TableColumn<T>[]; keyExtractor: (item: T) => string; empty?: React.ReactNode;
}) {
  return <View style={s.frame}>
    <ScrollView horizontal contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }} showsHorizontalScrollIndicator={false}>
      <View style={s.table}>
        <View style={[s.row, s.header, gradient(gradients.tableHead, colors.surfaceAlt)]}>
          {columns.map(c => <Text key={c.key} style={[s.cell, s.label, { flex: c.flex ?? 1 }]} numberOfLines={1}>{c.label}</Text>)}
        </View>
        {items.length === 0 ? empty : items.map((item, i) => <Row key={keyExtractor(item)} last={i === items.length - 1}>
          {columns.map(c => <View key={c.key} style={[s.cell, { flex: c.flex ?? 1 }]}>{c.render(item)}</View>)}
        </Row>)}
      </View>
    </ScrollView>
  </View>;
}

const s = StyleSheet.create({
  frame: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  table: { flex: 1, minWidth: 620, backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 64, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  lastRow: { borderBottomWidth: 0 },
  rowHover: { backgroundColor: colors.brand[50] },
  header: { backgroundColor: colors.surfaceAlt, minHeight: 40, borderBottomColor: colors.border },
  cell: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minWidth: 0 },
  label: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase' },
});
