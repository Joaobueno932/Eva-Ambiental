import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';

/**
 * Exibida quando as variáveis do Supabase não estão presentes no build.
 * Evita crash e orienta a correção, em vez de tela branca.
 */
export function ConfigErrorScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.circle}>
        <Ionicons name="construct-outline" size={32} color={colors.warning} />
      </View>
      <Text style={styles.title}>Configuração ausente</Text>
      <Text style={styles.message}>
        O app não encontrou as credenciais do Supabase. As variáveis{'\n'}
        <Text style={styles.code}>EXPO_PUBLIC_SUPABASE_URL</Text> e{'\n'}
        <Text style={styles.code}>EXPO_PUBLIC_SUPABASE_ANON_KEY</Text>{'\n'}
        precisam estar definidas no momento do build (eas.json env) ou no arquivo .env.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  circle: {
    width: 84,
    height: 84,
    borderRadius: radius.full,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { fontSize: 19, fontWeight: '700', color: colors.text, textAlign: 'center', letterSpacing: -0.3 },
  message: { fontSize: 13.5, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22, maxWidth: 480 },
  code: {
    fontWeight: '700',
    color: colors.brand[700],
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.xs,
  },
});
