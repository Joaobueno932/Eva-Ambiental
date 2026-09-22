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
  size?: 'md' | 'lg' | 'form';
  /**
   * Ícone de traço à esquerda (ex.: Lucide), no lugar do glifo do Ionicons.
   * Usado pelo tamanho `form`, que segue a família de ícones do menu.
   */
  leftIconComponent?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  /** Marca o campo como obrigatório: asterisco vermelho depois do rótulo. */
  required?: boolean;
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
  leftIconComponent: LeftIcon,
  required,
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
  const isForm = size === 'form';
  const tall = size === 'lg' || !isDesktop;
  const eyeSize = tall ? 52 : 38;
  const iconGutter = isForm ? 54 : tall ? 46 : 34;
  const hasIcon = !!(leftIcon || LeftIcon);

  return (
    <View style={isForm ? formStyles.wrapper : styles.wrapper}>
      {label && (
        <Text style={isForm ? formStyles.label : tall ? styles.label : webStyles.label}>
          {label}
          {required ? <Text style={formStyles.required}>{'  *'}</Text> : null}
        </Text>
      )}

      <View style={styles.fieldRow}>
        {LeftIcon && (
          <View style={[styles.leftIcon, { width: iconGutter }]} pointerEvents="none">
            <LeftIcon
              size={20}
              strokeWidth={2}
              color={error ? colors.danger : focused ? colors.brand[500] : colors.form.label}
            />
          </View>
        )}
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
          placeholderTextColor={isForm ? colors.form.soft : colors.textSoft}
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
            isForm ? formStyles.input : tall ? styles.input : webStyles.input,
            isDesktop && webOnly.noOutline,
            transition('background-color, border-color, box-shadow'),
            isPassword && { paddingRight: eyeSize },
            hasIcon && { paddingLeft: iconGutter },
            focused && (isForm ? formStyles.inputFocused : tall ? styles.inputFocused : webStyles.inputFocused),
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

/**
 * Tamanho `form`: formulários de registro, medidos no desenho de referência.
 *
 * Rótulo em 16px e escuro — no formulário o rótulo é a pergunta, não uma
 * legenda —, campo de 50px com borda fina e fundo quase branco.
 */
export const formStyles = StyleSheet.create({
  wrapper: { marginBottom: 22 },
  label: { fontSize: 16, fontWeight: '500', color: colors.form.label, marginBottom: 9 },
  required: { color: colors.form.required, fontWeight: '600' },
  input: {
    backgroundColor: colors.form.fieldBg,
    borderWidth: 1,
    borderColor: colors.form.border,
    borderRadius: radius.sm,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.form.label,
    height: 50,
  },
  inputFocused: { borderColor: colors.brand[500], backgroundColor: colors.white },
});
