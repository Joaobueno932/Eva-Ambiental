import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, gradient, gradients, radius, spacing, transition } from '@/theme';

export interface TableColumn<T> {
  key: string;
  label: string;
  flex?: number;
  render: (item: T) => React.ReactNode;
  /** Coluna ordenável: o cabeçalho vira botão e mostra a direção atual. */
  onSort?: () => void;
  sort?: 'asc' | 'desc' | null;
  /** Cabeçalho próprio — a caixa "marcar todos", por exemplo. */
  renderHeader?: () => React.ReactNode;
}

/**
 * Linha com realce sob o ponteiro.
 *
 * `Pressable` daria o estado de hover pronto, mas a linha já contém o botão
 * que abre o registro — aninhar áreas clicáveis confunde leitor de tela e
 * ordem de foco. O react-native-web repassa `onMouseEnter`/`onMouseLeave` do
 * `View` para o DOM, e no Android eles simplesmente não são chamados.
 */
function Row({ children, last, dense, height, onPress, selected, label }: {
  children: React.ReactNode; last?: boolean; dense?: boolean; height?: number;
  onPress?: () => void; selected?: boolean; label?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const hoverProps = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  } as any;
  const style = [
    s.row,
    dense && s.rowDense,
    height ? { minHeight: height } : null,
    transition('background-color'),
    hovered && !selected && s.rowHover,
    // A faixa verde à esquerda marca a linha aberta no painel: só o fundo
    // claro se confundiria com o realce de quem passa o ponteiro.
    selected && s.rowSelected,
    last && s.lastRow,
  ];
  if (!onPress) return <View {...hoverProps} style={style}>{children}</View>;
  // Sem `accessibilityRole="button"`: a linha contém caixa de seleção e menu,
  // que já são botões, e botão dentro de botão é HTML inválido — o teclado
  // perde a ordem de foco e o leitor de tela anuncia um controle só. O clique
  // na linha é atalho de mouse; quem navega por teclado usa o botão do nome.
  return (
    <Pressable {...hoverProps} onPress={onPress} accessibilityLabel={label} style={style}>
      {children}
    </Pressable>
  );
}

/**
 * Tabela do site — no celular as listas continuam em cartões.
 *
 * Sem zebra: o listrado resolve alinhamento em tabela impressa, mas na tela
 * compete com a própria informação. Aqui a leitura é guiada pela divisória
 * fina e pelo realce da linha sob o ponteiro.
 */
export function DataTable<T>({ items, columns, keyExtractor, empty, dense, rowHeight, labelSize, onRowPress, isRowSelected, rowLabel }: {
  items: T[]; columns: TableColumn<T>[]; keyExtractor: (item: T) => string; empty?: React.ReactNode;
  /** Altura mínima das linhas; o padrão é 64px (43px no modo denso). */
  rowHeight?: number;
  /**
   * Tamanho dos rótulos do cabeçalho. O padrão é 11px (10,5px no modo denso).
   * Tabelas de muitas colunas pedem menos: um rótulo em reticências não diz
   * mais o que a coluna mostra, e aí a coluna inteira perde o nome.
   */
  labelSize?: number;
  /** Abre a linha (painel de detalhes, por exemplo). */
  onRowPress?: (item: T) => void;
  /** Qual linha está aberta — recebe o realce persistente. */
  isRowSelected?: (item: T) => boolean;
  /** Rótulo de acessibilidade da linha clicável. */
  rowLabel?: (item: T) => string;
  /**
   * Tabela dentro de um cartão (prévias): linhas de 43px e sem moldura
   * própria — o cartão já é a moldura, e duas bordas concêntricas viram
   * ruído.
   */
  dense?: boolean;
}) {
  const table = <View style={[s.table, dense && s.tableDense]}>
    <View style={[s.row, s.header, gradient(gradients.tableHead, colors.surfaceAlt)]}>
      {columns.map(c => c.renderHeader ? (
        <View key={c.key} style={[s.cell, dense && s.cellDense, { flex: c.flex ?? 1 }]}>{c.renderHeader()}</View>
      ) : c.onSort ? (
        <Pressable
          key={c.key}
          onPress={c.onSort}
          accessibilityRole="button"
          accessibilityLabel={`Ordenar por ${c.label}`}
          style={({ hovered }: any) => [s.cell, dense && s.cellDense, s.sortCell, { flex: c.flex ?? 1 }, hovered && s.sortHover]}
        >
          <Text style={[s.label, dense && s.labelDense, labelSize ? { fontSize: labelSize } : null, c.sort && s.labelSorted]} numberOfLines={1}>{c.label}</Text>
          {/* Sem ordenação ativa o ícone indica que a coluna ordena; com ela,
              a seta mostra a direção. */}
          <Ionicons
            name={c.sort === 'asc' ? 'chevron-up' : c.sort === 'desc' ? 'chevron-down' : 'chevron-expand'}
            size={12}
            color={c.sort ? colors.brand[700] : colors.textSoft}
          />
        </Pressable>
      ) : (
        <Text key={c.key} style={[s.cell, dense && s.cellDense, s.label, dense && s.labelDense, labelSize ? { fontSize: labelSize } : null, { flex: c.flex ?? 1 }]} numberOfLines={1}>{c.label}</Text>
      ))}
    </View>
    {items.length === 0 ? empty : items.map((item, i) => <Row
      key={keyExtractor(item)}
      last={i === items.length - 1}
      dense={dense}
      height={rowHeight}
      onPress={onRowPress ? () => onRowPress(item) : undefined}
      selected={isRowSelected?.(item)}
      label={rowLabel?.(item)}
    >
      {columns.map(c => <View key={c.key} style={[s.cell, dense && s.cellDense, { flex: c.flex ?? 1 }]}>{c.render(item)}</View>)}
    </Row>)}
  </View>;

  // Densa, a tabela ocupa a largura do cartão e as colunas se dividem nela;
  // dentro de um ScrollView horizontal a largura fica sem limite e o que
  // passa da borda é cortado em vez de reajustado.
  if (dense) return <View style={s.frameDense}>{table}</View>;

  return <View style={s.frame}>
    <ScrollView horizontal contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }} showsHorizontalScrollIndicator={false}>
      {table}
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
  frameDense: { backgroundColor: colors.surface, borderRadius: radius.sm, overflow: 'hidden' },
  rowDense: { minHeight: 43 },
  // Sem largura mínima: dentro de meio cartão a tabela se ajusta à largura
  // disponível em vez de rolar para o lado e esconder a coluna de status.
  tableDense: { minWidth: 0 },
  labelDense: { fontSize: 10.5, letterSpacing: 0.4 },
  sortCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sortHover: { opacity: 0.75 },
  labelSorted: { color: colors.brand[700] },
  cellDense: { paddingHorizontal: 8, paddingVertical: 6 },
  rowHover: { backgroundColor: colors.brand[50] },
  rowSelected: { backgroundColor: '#EFF9F0', borderLeftWidth: 3, borderLeftColor: colors.form.action },
  header: { backgroundColor: colors.surfaceAlt, minHeight: 40, borderBottomColor: colors.border },
  cell: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minWidth: 0 },
  label: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase' },
});
