import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme';

type Edge = 'top' | 'bottom' | 'left' | 'right';

interface Props {
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** centraliza o conteúdo verticalmente (ex.: tela de Login) */
  center?: boolean;
  /** compensação quando há cabeçalho fixo acima (geralmente 0) */
  keyboardVerticalOffset?: number;
  edges?: Edge[];
}

/**
 * Envólucro padrão para telas com formulário. Garante que o teclado não
 * cubra os campos e que o conteúdo suba/rola adequadamente.
 *
 * iOS usa behavior="padding". No Android, o Expo já aplica `adjustResize`
 * por padrão; por isso o behavior fica indefinido para evitar "double resize"
 * e manter a rolagem estável. O paddingBottom generoso mantém o botão
 * acessível com o teclado aberto.
 */
export function FormScreenContainer({
  children,
  contentContainerStyle,
  center,
  keyboardVerticalOffset = 0,
  edges = ['bottom'],
}: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, center && styles.center, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.greenBg },
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl + 96 },
  center: { flexGrow: 1, justifyContent: 'center' },
});
