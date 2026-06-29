import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  /** Campo de senha com botão de mostrar/ocultar (ícone de olho à direita). */
  isPassword?: boolean;
}

export function Input({ label, error, hint, style, isPassword, secureTextEntry, ...rest }: Props) {
  const [visible, setVisible] = useState(false);

  // Quando isPassword, a senha começa oculta e o olho alterna a visibilidade.
  const secure = isPassword ? !visible : secureTextEntry;

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={styles.fieldRow}>
        <TextInput
          placeholderTextColor={colors.grayText}
          secureTextEntry={secure}
          style={[styles.input, isPassword && styles.inputWithIcon, error ? styles.inputError : null, style]}
          {...rest}
        />
        {isPassword && (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            hitSlop={12}
            style={styles.eyeButton}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}
          >
            <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.grayText} />
          </Pressable>
        )}
      </View>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  fieldRow: { justifyContent: 'center' },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.grayMedium,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    minHeight: 52,
  },
  inputWithIcon: { paddingRight: 52 },
  inputError: { borderColor: colors.danger },
  eyeButton: {
    position: 'absolute',
    right: 4,
    height: 52,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { color: colors.danger, fontSize: 12, marginTop: 4 },
  hint: { color: colors.grayText, fontSize: 12, marginTop: 4 },
});
