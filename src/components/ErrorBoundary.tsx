import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';

interface Props {
  children: React.ReactNode;
}
interface State {
  hasError: boolean;
  message?: string;
}

/**
 * Captura erros de renderização em toda a árvore para evitar tela branca /
 * crash silencioso no APK. Exibe mensagem amigável e loga o erro no console.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: (error as Error)?.message };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Log para diagnóstico (adb logcat / console), sem expor dados sensíveis.
    console.error('[Eva Ambiental] Erro não tratado:', error, info);
  }

  handleReset = () => this.setState({ hasError: false, message: undefined });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.circle}>
            <Ionicons name="warning-outline" size={48} color={colors.danger} />
          </View>
          <Text style={styles.title}>Ops! Algo deu errado</Text>
          <Text style={styles.message}>
            O aplicativo encontrou um erro inesperado. Tente novamente. Se o problema persistir,
            feche e abra o app novamente.
          </Text>
          {__DEV__ && this.state.message ? <Text style={styles.detail}>{this.state.message}</Text> : null}
          <Pressable style={styles.button} onPress={this.handleReset}>
            <Ionicons name="refresh" size={20} color={colors.white} />
            <Text style={styles.buttonText}>Tentar novamente</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.greenBg },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  circle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  message: { fontSize: 14, color: colors.grayText, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
  detail: { fontSize: 12, color: colors.danger, textAlign: 'center', marginTop: spacing.md },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.green,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    marginTop: spacing.xl,
  },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
