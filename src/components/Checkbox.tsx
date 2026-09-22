import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import Minus from 'lucide-react-native/icons/minus';
import { colors, radius, transition } from '@/theme';

/**
 * Caixa de seleção de linha.
 *
 * `indeterminate` é o estado do cabeçalho quando só parte das linhas está
 * marcada: um traço, não um visto — visto ali diria "tudo selecionado", que é
 * justamente o que não está.
 */
export function Checkbox({ checked, indeterminate, onToggle, label, disabled }: {
  checked: boolean;
  indeterminate?: boolean;
  onToggle: () => void;
  label: string;
  disabled?: boolean;
}) {
  const on = checked || indeterminate;
  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: indeterminate ? 'mixed' : checked, disabled }}
      accessibilityLabel={label}
      hitSlop={8}
      style={({ hovered }: any) => [
        s.box,
        on && s.boxOn,
        transition(),
        hovered && !disabled && !on && s.boxHover,
        disabled && s.disabled,
      ]}
    >
      {indeterminate ? (
        <Minus size={13} strokeWidth={3} color={colors.white} />
      ) : checked ? (
        <Check size={13} strokeWidth={3} color={colors.white} />
      ) : (
        <View />
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  box: {
    width: 18,
    height: 18,
    borderRadius: radius.xs - 2,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxHover: { borderColor: colors.brand[400] },
  boxOn: { backgroundColor: colors.form.action, borderColor: colors.form.action },
  disabled: { opacity: 0.4 },
});
