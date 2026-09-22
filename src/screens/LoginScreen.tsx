import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useIsDesktop } from '@/hooks/useLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button, EvaImage, Input } from '@/components';
import { colors, elevation, gradient, gradients, radius, spacing } from '@/theme';
import { sceneImages } from '@/theme/images';
import { describeSignInError } from '@/utils/authErrors';

/** O que o sistema entrega, dito em uma palavra e uma linha cada. */
const PILLARS: { icon: keyof typeof Ionicons.glyphMap; title: string; hint: string }[] = [
  { icon: 'document-text-outline', title: 'Controle', hint: 'Gestão completa\ndas suas operações' },
  { icon: 'shield-checkmark-outline', title: 'Evidência', hint: 'Dados confiáveis\ne auditáveis' },
  { icon: 'leaf-outline', title: 'Rastreabilidade', hint: 'Da origem ao\ndestino do resíduo' },
];

/** Assinatura do rodapé — três afirmações soltas, lidas de cima para baixo. */
const CLAIMS = ['Meio ambiente', 'Dados', 'Resultados reais'];

/** Marca da Eva: o selo com a folha, o nome e uma linha de apoio. */
function Brandmark({ tone, caption, size }: { tone: 'light' | 'dark'; caption: string; size: number }) {
  const dark = tone === 'dark';
  return (
    <View style={styles.brandRow}>
      <View style={[styles.mark, { width: size, height: size }, gradient(gradients.accent, colors.accent)]}>
        <Ionicons name="leaf" size={size * 0.46} color={colors.brand[800]} />
      </View>
      <View style={styles.shrink}>
        <Text style={[styles.markName, dark && styles.markNameDark, { fontSize: size * 0.42 }]}>Eva Ambiental</Text>
        <Text style={[styles.markCaption, dark && styles.markCaptionDark]}>{caption}</Text>
      </View>
    </View>
  );
}

export function LoginScreen() {
  const isDesktop = useIsDesktop();
  const { signIn, authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(true);
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

  /*
   * Os quatro blocos da página são montados soltos porque a ordem muda com o
   * formato: no site o discurso fica à esquerda e o formulário à direita; no
   * celular, empilhar tudo na mesma ordem enterraria o campo de e-mail a uma
   * tela e meia de rolagem, então o cartão sobe logo depois da chamada.
   */
  const pitch = (
    <>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Operação ambiental</Text>
      </View>

      <Text style={[styles.headline, isDesktop && styles.headlineDesktop]}>
        Cada registro.{'\n'}Uma origem.{'\n'}
        <Text style={styles.headlineAccent}>Um destino melhor.</Text>
      </Text>

      <Text style={[styles.tagline, isDesktop && styles.taglineDesktop]}>
        Controle, evidência e rastreabilidade para a sua operação ambiental em tempo real.
      </Text>
    </>
  );

  const pillars = (
    <View style={[styles.pillars, isDesktop && styles.pillarsDesktop]}>
      {PILLARS.map((pillar) => (
        <View key={pillar.title} style={styles.pillar}>
          <View style={styles.pillarIcon}>
            <Ionicons name={pillar.icon} size={20} color={colors.accent} />
          </View>
          <Text style={styles.pillarTitle}>{pillar.title}</Text>
          <Text style={styles.pillarHint}>{pillar.hint}</Text>
        </View>
      ))}
    </View>
  );

  const signature = (
    <View style={[styles.heroFooter, isDesktop && styles.heroFooterDesktop]}>
      <View style={styles.promise}>
        <Ionicons name="leaf" size={16} color={colors.accent} />
        <Text style={styles.promiseText}>Um futuro mais limpo{'\n'}começa com boas decisões.</Text>
      </View>

      <View style={styles.claims}>
        <View style={styles.claimsRule} />
        <View>
          {CLAIMS.map((claim) => (
            <Text key={claim} style={styles.claim}>
              {claim}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );

  const card = (
    <View style={[styles.card, elevation('xl'), isDesktop && styles.cardDesktop]}>
      <Brandmark tone="dark" caption="Operações" size={48} />

      <Text style={styles.cardTitle}>Acesse sua operação</Text>
      <Text style={styles.cardSubtitle}>Entre com sua conta corporativa para continuar.</Text>

      {/* Mensagem do contexto: inativo, sem perfil, role inválido, permissão ou rede */}
      {authError ? (
        <View style={styles.notice}>
          <Ionicons name="alert-circle" size={17} color={colors.danger} />
          <Text style={styles.noticeText}>{authError}</Text>
        </View>
      ) : null}

      <Input
        label="E-mail"
        placeholder="voce@empresa.com"
        leftIcon="mail-outline"
        size="lg"
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
        leftIcon="lock-closed-outline"
        size="lg"
        value={password}
        onChangeText={setPassword}
        onFocus={scrollToEnd}
        isPassword
        autoComplete="password"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
        error={errors.password}
      />

      <View style={styles.optionsRow}>
        <Pressable
          onPress={() => setKeepSignedIn((v) => !v)}
          style={styles.keep}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: keepSignedIn }}
          accessibilityLabel="Manter-me conectado neste dispositivo"
        >
          <View style={[styles.checkbox, keepSignedIn && styles.checkboxOn]}>
            {keepSignedIn && <Ionicons name="checkmark" size={14} color={colors.white} />}
          </View>
          <Text style={styles.keepText}>Manter-me conectado neste dispositivo</Text>
        </Pressable>

        <Text style={styles.forgot}>Esqueci minha senha</Text>
      </View>

      {errors.general ? (
        <View style={styles.notice}>
          <Ionicons name="close-circle" size={17} color={colors.danger} />
          <Text style={styles.noticeText}>{errors.general}</Text>
        </View>
      ) : null}

      <Button title="Entrar" icon="log-in-outline" onPress={onSubmit} loading={loading} style={styles.submit} />

      <View style={styles.cardDivider} />

      <View style={styles.secure}>
        <Ionicons name="lock-closed" size={15} color={colors.brand[600]} />
        <View style={styles.shrink}>
          <Text style={styles.secureTitle}>Acesso restrito a contas autorizadas.</Text>
          <Text style={styles.secureHint}>Seus dados são protegidos e criptografados.</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      {/*
        A foto entra como irmã, e não por ImageBackground: no react-native-web
        aquele componente joga a imagem em `z-index: -1`, atrás da cor de fundo
        da própria View — a mata simplesmente não aparecia.
      */}
      <Image source={sceneImages.login} resizeMode="cover" style={styles.photo} />

      {/* Véu sobre a fotografia: escurece o lado do texto e deixa a mata à mostra do outro. */}
      <View style={[StyleSheet.absoluteFill, gradient(gradients.loginVeil, 'rgba(2,29,21,0.90)')]} />

      {/*
        A Eva assina a página pelo canto. Vem antes do conteúdo de propósito:
        em janela baixa o cartão desce até perto do rodapé, e o que a alcança
        passa por cima dela em vez de ser atravessado.
      */}
      {isDesktop && (
        <View style={styles.mascot} pointerEvents="none">
          <View style={[styles.mascotBubble, gradient(gradients.brand, colors.brand[600])]}>
            <Text style={styles.mascotText}>Juntos por{'\n'}um futuro{'\n'}mais limpo.</Text>
          </View>
          <EvaImage name="hero" width={96} height={112} style={styles.mascotImage} />
        </View>
      )}

      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={[
              styles.scroll,
              isDesktop ? styles.scrollDesktop : kbVisible ? styles.scrollOpen : styles.scrollCentered,
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.topBar, isDesktop && styles.topBarDesktop]}>
              <Brandmark tone="light" caption="Controle que transforma" size={isDesktop ? 52 : 44} />
            </View>

            {isDesktop ? (
              <View style={styles.mainDesktop}>
                <View style={styles.heroDesktop}>
                  {pitch}
                  {pillars}
                  {signature}
                </View>
                {card}
              </View>
            ) : (
              <View style={styles.main}>
                {pitch}
                <View style={styles.cardSlot}>{card}</View>
                {pillars}
                {signature}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sidebar },
  photo: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  flex: { flex: 1 },
  /** Coluna de texto que precisa ceder largura em vez de empurrar o vizinho. */
  shrink: { flex: 1, flexShrink: 1 },

  /** `width: 100%` prende o conteúdo à janela em vez de deixá-lo medir-se sozinho. */
  scroll: { width: '100%', padding: spacing.xl, paddingBottom: spacing.xxl },
  scrollDesktop: { flexGrow: 1, paddingHorizontal: 56, paddingVertical: 40 },
  // Sem teclado: conteúdo centralizado.
  scrollCentered: { flexGrow: 1, justifyContent: 'center' },
  // Com teclado: alinha ao topo e garante espaço extra para rolar até o botão.
  scrollOpen: { flexGrow: 1, justifyContent: 'flex-start', paddingBottom: spacing.xxl * 3 },

  topBar: { alignSelf: 'stretch', marginBottom: spacing.xl },
  topBarDesktop: { marginBottom: 0 },

  /** Selo + nome, usado no topo da página e de novo no cartão. */
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mark: {
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markName: { color: colors.white, fontWeight: '700', letterSpacing: -0.5 },
  markNameDark: { color: colors.text },
  markCaption: { color: colors.onSidebarMuted, fontSize: 13, marginTop: 1 },
  markCaptionDark: { color: colors.textMuted },

  main: { alignSelf: 'stretch' },
  mainDesktop: {
    alignSelf: 'stretch',
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 72,
  },

  heroDesktop: { flex: 1, maxWidth: 620 },

  /** Pílula de seção — o assunto da página antes do título. */
  badge: {
    alignSelf: 'flex-start',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: 'rgba(199,244,100,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(199,244,100,0.24)',
    marginBottom: spacing.xl,
  },
  badgeText: {
    color: colors.accent,
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },

  headline: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: -1.3,
    marginBottom: spacing.lg,
  },
  headlineDesktop: { fontSize: 54, lineHeight: 63, letterSpacing: -2 },
  headlineAccent: { color: colors.accent },

  tagline: { fontSize: 15, lineHeight: 24, color: colors.onSidebar },
  taglineDesktop: { fontSize: 18, lineHeight: 29, maxWidth: 470 },

  pillars: { alignSelf: 'stretch', marginTop: spacing.xxl, gap: spacing.xl },
  pillarsDesktop: { flexDirection: 'row', gap: 48, marginTop: 44 },
  pillar: { flex: 1, minWidth: 130 },
  pillarIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(199,244,100,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(199,244,100,0.26)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  pillarTitle: { color: colors.white, fontSize: 15.5, fontWeight: '700', letterSpacing: -0.2, marginBottom: 5 },
  pillarHint: { color: colors.onSidebarMuted, fontSize: 13.5, lineHeight: 20 },

  heroFooter: {
    alignSelf: 'stretch',
    marginTop: spacing.xxl,
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
    gap: spacing.lg,
  },
  heroFooterDesktop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 48 },

  promise: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm + 2 },
  promiseText: { color: colors.onSidebar, fontSize: 13.5, lineHeight: 20 },

  claims: { flexDirection: 'row', gap: spacing.md },
  claimsRule: { width: 3, borderRadius: radius.full, backgroundColor: colors.accent },
  claim: {
    color: colors.onSidebarMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    lineHeight: 21,
  },

  /**
   * No celular o cartão respira entre a chamada e os pilares. O `alignItems`
   * importa em tela média (tablet, abaixo do corte de site): sem ele o cartão
   * encosta na margem esquerda e deixa meia tela vazia ao lado.
   */
  cardSlot: { alignSelf: 'stretch', alignItems: 'center', marginTop: spacing.xxl },

  // maxWidth + alignSelf: no navegador o cartão ficaria com a largura inteira
  // do monitor; no celular o maxWidth não tem efeito e o layout segue igual.
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    padding: spacing.xl,
    width: '100%',
    maxWidth: 480,
  },
  cardDesktop: { padding: 40, width: 480, alignSelf: 'auto' },
  cardTitle: { fontSize: 27, fontWeight: '700', color: colors.text, letterSpacing: -0.8, marginTop: spacing.xl },
  cardSubtitle: { fontSize: 14, color: colors.textMuted, marginTop: 6, marginBottom: spacing.xl },

  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  noticeText: { color: colors.danger, flex: 1, fontSize: 13, lineHeight: 18 },

  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  keep: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, flexShrink: 1 },
  checkbox: {
    width: 21,
    height: 21,
    borderRadius: radius.xs,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.brand[700], borderColor: colors.brand[700] },
  keepText: { color: colors.slate[700], fontSize: 13, flexShrink: 1 },
  forgot: {
    color: colors.brand[600],
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
    flexShrink: 1,
  },

  submit: { marginTop: spacing.xs },

  cardDivider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: spacing.xl },

  secure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm + 2 },
  secureTitle: { color: colors.slate[700], fontSize: 13, fontWeight: '600' },
  secureHint: { color: colors.textSoft, fontSize: 12, marginTop: 2 },

  mascot: {
    position: 'absolute',
    right: 28,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  mascotBubble: {
    backgroundColor: colors.brand[600],
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(199,244,100,0.24)',
    paddingVertical: spacing.lg,
    paddingLeft: spacing.xl,
    paddingRight: 64,
    marginRight: -56,
  },
  mascotText: { color: colors.white, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  mascotImage: { marginBottom: -4 },
});
