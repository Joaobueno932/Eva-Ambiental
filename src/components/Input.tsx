import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, ring, spacing, transition } from '@/theme';
import { useIsDesktop } from '@/hooks/useLayout';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  /** Campo de senha com botão de mostrar/ocultar (ícone de olho à direita). */
  isPassword?: boolean;
  /** Ícone decorativo à esquerda — diz do que é o campo antes de se ler o rótulo. */
  leftIcon?: keyof typeof Ionicons.glyphMap;
  /**
   * Altura do campo. `md` segue o padrão de cada formato (compacto no site,
   * alto no celular). `lg` mantém o campo alto em qualquer tela — usado onde o
   * formulário é o próprio assunto da página, como no acesso.
   */
  size?: 'md' | 'lg';
}

/**
 * Campo de texto.
 *
 * No site os campos são mais baixos e o foco ganha um anel verde — no celular
 * o teclado já indica onde se está digitando, mas com mouse e Tab o realce é o
 * que diz qual campo está ativo. O repouso é levemente rebaixado em relação ao
 * cartão: o campo se lê como espaço a preencher, não como mais uma caixa.
 */
export function Input({
  label,
  error,
  hint,
  style,
  isPassword,
  leftIcon,
  size = 'md',
  secureTextEntry,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const isDesktop = useIsDesktop();

  // Quando isPassword, a senha começa oculta e o olho alterna a visibilidade.
  const secure = isPassword ? !visible : secureTextEntry;
  // `tall` é o campo de toque: no celular sempre, no site só quando pedido.
  const tall = size === 'lg' || !isDesktop;
  const eyeSize = tall ? 52 : 38;
  const iconGutter = tall ? 46 : 34;

  return (
    <View style={styles.wrapper}>
      {label && <Text style={tall ? styles.label : webStyles.label}>{label}</Text>}

      <View style={styles.fieldRow}>
        {leftIcon && (
          <View style={[styles.leftIcon, { width: iconGutter }]} pointerEvents="none">
            <Ionicons
              name={leftIcon}
              size={tall ? 18 : 15}
              color={error ? colors.danger : focused ? colors.brand[500] : colors.textSoft}
            />
          </View>
        )}
        <TextInput
          accessibilityLabel={label ?? rest.placeholder}
          placeholderTextColor={colors.textSoft}
          secureTextEntry={secure}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            tall ? styles.input : webStyles.input,
            isDesktop && webOnly.noOutline,
            transition('background-color, border-color, box-shadow'),
            isPassword && { paddingRight: eyeSize },
            leftIcon && { paddingLeft: iconGutter },
            focused && (tall ? styles.inputFocused : webStyles.inputFocused),
            focused && isDesktop && ring(colors.brand[500]),
            error ? styles.inputError : null,
            error && focused ? ring(colors.danger) : null,
            style,
          ]}
          {...rest}
        />
        {isPassword && (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            hitSlop={12}
            style={[styles.eyeButton, { height: eyeSize, width: eyeSize - 8 }]}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}
          >
            <Ionicons
              name={visible ? 'eye-off-outline' : 'eye-outline'}
              size={isDesktop ? 18 : 22}
              color={colors.textMuted}
            />
          </Pressable>
        )}
      </View>

      {error ? (
        <View style={styles.messageRow}>
          <Ionicons name="alert-circle" size={13} color={colors.danger} />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 },
  fieldRow: { justifyContent: 'center' },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    minHeight: 52,
  },
  inputFocused: { borderColor: colors.brand[500], backgroundColor: colors.white },
  inputError: { borderColor: colors.danger, backgroundColor: colors.dangerBg },
  leftIcon: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  eyeButton: {
    position: 'absolute',
    right: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  error: { color: colors.danger, fontSize: 12, fontWeight: '500', flex: 1 },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 5, lineHeight: 17 },
});

/**
 * Propriedades que só existem no react-native-web e não constam no tipo
 * TextStyle do React Native — daí o cast.
 */
const webOnly = {
  /** Remove o contorno azul padrão do navegador; o anel verde o substitui. */
  noOutline: { outlineStyle: 'none' } as any,
};

const webStyles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    fontSize: 14,
    color: colors.text,
    minHeight: 40,
  },
  inputFocused: { borderColor: colors.brand[500], backgroundColor: colors.white },
});
