import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { Button, EvaImage, FormScreenContainer, Input } from '@/components';
import { colors, radius, spacing } from '@/theme';
import { describeSignInError } from '@/utils/authErrors';

export function LoginScreen() {
  const { signIn, authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Informe seu e-mail.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'E-mail inválido.';
    if (!password) e.password = 'Informe sua senha.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      await signIn(email, password);
    } catch (err: any) {
      setErrors({ general: describeSignInError(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormScreenContainer center edges={['top', 'bottom']} contentContainerStyle={styles.scroll}>
      <EvaImage name="hero" width={180} height={200} style={styles.hero} />
      <Text style={styles.brand}>Eva Ambiental</Text>
      <Text style={styles.tagline}>Controle e rastreabilidade de pesagens de resíduos</Text>

      <View style={styles.card}>
        {/* Mensagem do contexto de auth: inativo, sem perfil, role inválido, permissão ou rede */}
        {authError && (
          <View style={styles.notice}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.noticeText}>{authError}</Text>
          </View>
        )}

        <Input
          label="E-mail"
          placeholder="voce@empresa.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          error={errors.email}
        />
        <Input
          label="Senha"
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          isPassword
          autoComplete="password"
          error={errors.password}
        />

        {errors.general ? (
          <View style={styles.error}>
            <Ionicons name="close-circle" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{errors.general}</Text>
          </View>
        ) : null}

        <Button title="Entrar" icon="log-in-outline" onPress={onSubmit} loading={loading} />
      </View>

      <Text style={styles.footer}>🌱 Sustentabilidade, confiança e organização</Text>
    </FormScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.xl },
  hero: { alignSelf: 'center', marginBottom: spacing.sm },
  brand: { fontSize: 30, fontWeight: '800', color: colors.greenDark, textAlign: 'center' },
  tagline: { fontSize: 14, color: colors.grayText, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.xl },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.xl },
  error: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  errorText: { color: colors.danger, flex: 1 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FEE2E2',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  noticeText: { color: colors.danger, flex: 1, fontSize: 13 },
  footer: { textAlign: 'center', color: colors.grayText, marginTop: spacing.xl, fontSize: 13 },
});
