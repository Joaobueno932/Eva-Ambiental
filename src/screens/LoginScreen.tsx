import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { Button, EvaImage, Input } from '@/components';
import { colors, radius, spacing } from '@/theme';
import { describeSignInError } from '@/utils/authErrors';

export function LoginScreen() {
  const { signIn, authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [loading, setLoading] = useState(false);
  const [kbVisible, setKbVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Acompanha o teclado: quando abre, rola até o fim para revelar
  // o campo de senha e o botão Entrar; quando fecha, recentraliza.
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, () => {
      setKbVisible(true);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    });
    const hideSub = Keyboard.addListener(hideEvt, () => setKbVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const scrollToEnd = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);

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
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[styles.scroll, kbVisible ? styles.scrollOpen : styles.scrollCentered]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <EvaImage name="hero" width={170} height={190} style={styles.hero} />
          <Text style={styles.brand}>Eva Ambiental</Text>
          <Text style={styles.tagline}>Controle e rastreabilidade de pesagens de resíduos</Text>

          <View style={styles.card}>
            {/* Mensagem do contexto: inativo, sem perfil, role inválido, permissão ou rede */}
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
              onFocus={scrollToEnd}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="next"
              error={errors.email}
            />
            <Input
              label="Senha"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              onFocus={scrollToEnd}
              isPassword
              autoComplete="password"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.greenBg },
  flex: { flex: 1 },
  scroll: { padding: spacing.xl },
  // Sem teclado: conteúdo centralizado e bonito.
  scrollCentered: { flexGrow: 1, justifyContent: 'center' },
  // Com teclado: alinha ao topo e garante espaço extra para rolar até o botão.
  scrollOpen: { flexGrow: 1, justifyContent: 'flex-start', paddingBottom: spacing.xxl * 3 },
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
