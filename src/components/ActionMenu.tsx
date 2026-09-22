import React, { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors, elevation, radius, transition } from '@/theme';

type IconComponent = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export interface MenuAction {
  label: string;
  icon?: IconComponent;
  onPress: () => void;
  /** Ação que desfaz algo (desativar, excluir): texto e ícone em vermelho. */
  destructive?: boolean;
  disabled?: boolean;
  /** Por que está desabilitada — aparece no lugar da ação, em vez de sumir. */
  hint?: string;
}

const MENU_WIDTH = 220;

/**
 * Menu suspenso ancorado no botão que o abriu.
 *
 * Usado pelo "⋮" das linhas e pela seta do "Exportar". Abre colado no gatilho,
 * alinhado pela direita — ações de linha ficam no fim da linha, e um menu que
 * abrisse no centro da tela perderia a ligação com o registro clicado. Se não
 * couber abaixo, abre acima.
 */
export function ActionMenu({ actions, renderTrigger, accessibilityLabel }: {
  actions: MenuAction[];
  renderTrigger: (open: () => void) => React.ReactNode;
  accessibilityLabel?: string;
}) {
  const anchor = useRef<View>(null);
  const [pos, setPos] = useState<{ x: number; y: number; h: number } | null>(null);
  const { height: screenH } = useWindowDimensions();

  const open = () => {
    anchor.current?.measureInWindow((x, y, w, h) => setPos({ x: x + w, y, h }));
  };
  const close = () => setPos(null);

  const estimated = actions.length * 42 + 12;
  const above = pos ? pos.y + pos.h + estimated > screenH - 12 : false;

  return (
    <View ref={anchor} collapsable={false} accessibilityLabel={accessibilityLabel}>
      {renderTrigger(open)}
      <Modal visible={!!pos} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Fechar menu">
          {pos ? (
            <View
              style={[
                s.menu,
                elevation('lg'),
                {
                  left: Math.max(8, pos.x - MENU_WIDTH),
                  top: above ? Math.max(8, pos.y - estimated - 4) : pos.y + pos.h + 4,
                },
              ]}
              onStartShouldSetResponder={() => true}
            >
              {actions.map((a) => {
                const Icon = a.icon;
                const tone = a.destructive ? colors.danger : colors.text;
                return (
                  <Pressable
                    key={a.label}
                    disabled={a.disabled}
                    accessibilityRole="menuitem"
                    onPress={() => {
                      close();
                      a.onPress();
                    }}
                    style={({ hovered }: any) => [s.item, transition('background-color'), hovered && !a.disabled && s.itemHover, a.disabled && s.itemDisabled]}
                  >
                    {Icon ? <Icon size={16} strokeWidth={2} color={tone} /> : null}
                    <View style={{ flex: 1 }}>
                      <Text style={[s.itemText, { color: tone }]}>{a.label}</Text>
                      {a.disabled && a.hint ? <Text style={s.hint}>{a.hint}</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  menu: {
    position: 'absolute',
    width: MENU_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  itemHover: { backgroundColor: colors.surfaceAlt },
  itemDisabled: { opacity: 0.55 },
  itemText: { fontSize: 13.5, fontWeight: '500' },
  hint: { fontSize: 11.5, color: colors.textSoft, marginTop: 2 },
});
