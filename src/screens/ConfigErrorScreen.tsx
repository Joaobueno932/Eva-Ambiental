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
        <Ionicons name="construct-outline" size={48} color={colors.warning} />
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
  container: { flex: 1, backgroundColor: colors.greenBg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  circle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
  message: { fontSize: 14, color: colors.grayText, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22 },
  code: {
    fontWeight: '700',
    color: colors.greenDark,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
  },
});
