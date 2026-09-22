import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsWide } from '@/hooks/useLayout';
import { colors, spacing } from '@/theme';

type Edge = 'top' | 'bottom' | 'left' | 'right';

interface Props {
  children: React.ReactNode;
  aside?: React.ReactNode;
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
  aside,
  contentContainerStyle,
  center,
  keyboardVerticalOffset = 0,
  edges = ['bottom'],
}: Props) {
  const isDesktop = useIsWide();
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <View style={{ flex: 1, flexDirection: 'row' }}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, center && styles.center, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {/* No monitor o formulário não deve ocupar a tela inteira: campos de
              1000px de largura são desconfortáveis de ler e preencher. */}
          <View style={styles.column}>{children}</View>
        </ScrollView>
        {isDesktop && aside && <ScrollView style={{ width: 280, flexGrow: 0, borderLeftWidth: 1, borderLeftColor: colors.border }} contentContainerStyle={{ padding: spacing.lg }}>{aside}</ScrollView>}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.pageBg },
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl + 96 },
  center: { flexGrow: 1, justifyContent: 'center' },
  column: { width: '100%', maxWidth: 760, alignSelf: 'center' },
});
