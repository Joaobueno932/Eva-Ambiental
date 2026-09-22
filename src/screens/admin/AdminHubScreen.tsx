import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import BookOpen from 'lucide-react-native/icons/book-open';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import CircleQuestionMark from 'lucide-react-native/icons/circle-question-mark';
import CloudUpload from 'lucide-react-native/icons/cloud-upload';
import Database from 'lucide-react-native/icons/database';
import MapPin from 'lucide-react-native/icons/map-pin';
import Recycle from 'lucide-react-native/icons/recycle';
import Settings from 'lucide-react-native/icons/settings';
import Trash from 'lucide-react-native/icons/trash';
import Truck from 'lucide-react-native/icons/truck';
import Users from 'lucide-react-native/icons/users';
import Wrench from 'lucide-react-native/icons/wrench';
import { Button, EvaInfoModal, Header, Topbar } from '@/components';
import { CardHead, PageHeader } from '@/components/FormKit';
import { BuildingIcon } from '@/components/MenuIcons';
import { useAuth } from '@/contexts/AuthContext';
import { useIsDesktop } from '@/hooks/useLayout';
import { getAdminCounts } from '@/services/masters';
import { colors, elevation, gradient, radius, spacing, transition } from '@/theme';
import { formatLongDate, formatNumber, roleLabel } from '@/utils/format';
import { HOW_TO_USE, SETUP_ORDER } from '@/utils/guides';
import { ProfileStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'AdminHub'>;
type IconComponent = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

interface HubItem {
  route: keyof ProfileStackParamList;
  icon: IconComponent;
  title: string;
  sub: string;
}

/** Cadastros que a operação precisa para funcionar, na ordem de dependência. */
const BASE: HubItem[] = [
  { route: 'AdminUsers', icon: Users, title: 'Usuários', sub: 'Criar, ativar e definir perfis de acesso ao sistema.' },
  { route: 'AdminClients', icon: BuildingIcon, title: 'Clientes', sub: 'Gerenciar clientes e suas informações cadastrais.' },
  { route: 'AdminUnits', icon: MapPin, title: 'Unidades', sub: 'Cadastrar e administrar unidades por cliente.' },
  { route: 'AdminWasteTypes', icon: Trash, title: 'Tipos de Resíduos', sub: 'Definir e classificar os tipos de resíduos.' },
  { route: 'AdminTreatmentTypes', icon: Recycle, title: 'Tipos de Tratamento', sub: 'Configurar as opções de tratamento e destinação.' },
  { route: 'AdminRecipients', icon: Truck, title: 'Destinatários', sub: 'Gerenciar os locais de destino dos resíduos.' },
];

const TOOLS: HubItem[] = [
  { route: 'AdminImport', icon: CloudUpload, title: 'Importação', sub: 'Importar dados via planilha Excel de forma rápida e segura.' },
];

/** Folhas decorativas do rodapé de ajuda — ambientação, sem conteúdo. */
function HelpLeaves() {
  return (
    <View style={styles.leaves} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 240 120">
        <Path d="M232 8c-52 0-92 22-92 62 0 9 2 17 7 23 12-33 34-52 65-63-21 14-38 33-47 63 7 4 15 6 25 6 40 0 48-38 42-91Z" fill="#CFE6D2" fillOpacity={0.75} />
        <Path d="M150 44c-38 0-66 16-66 45 0 7 1 13 5 17 9-24 25-38 47-46-15 10-27 24-34 46 5 3 11 4 18 4 29 0 35-27 30-66Z" fill="#DCEFDF" fillOpacity={0.8} />
      </Svg>
    </View>
  );
}

/**
 * Cadastros e administração.
 *
 * A porta de entrada do que sustenta a operação. Os cartões estão na ordem em
 * que os cadastros se tornam necessários — cliente antes de unidade, resíduo e
 * tratamento antes da primeira pesagem —, e os três totais no topo dizem, de
 * relance, se a base está montada ou ainda vazia.
 */
export function AdminHubScreen() {
  const isDesktop = useIsDesktop();
  const navigation = useNavigation<Nav>();
  const { profile, signOut } = useAuth();
  const [counts, setCounts] = useState({ activeUsers: 0, clients: 0, units: 0 });
  const [guide, setGuide] = useState(false);
  const [docs, setDocs] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // Contagens são informativas: se falharem, a tela continua navegável.
      getAdminCounts().then(setCounts).catch(() => {});
    }, [])
  );

  const card = (item: HubItem, full?: boolean) => {
    const Icon = item.icon;
    return (
      <Pressable
        key={item.route}
        onPress={() => navigation.navigate(item.route as any)}
        accessibilityRole="button"
        accessibilityLabel={item.title}
        style={({ hovered }: any) => [
          styles.item,
          isDesktop && !full && styles.itemGrid,
          elevation('sm'),
          transition(),
          hovered && styles.itemHover,
        ]}
      >
        <View style={styles.itemSeal}>
          <Icon size={26} strokeWidth={1.9} color={colors.form.tileIcon} />
        </View>
        <View style={styles.grow}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemSub}>{item.sub}</Text>
        </View>
        <ChevronRight size={20} strokeWidth={2} color={colors.form.soft} />
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, isDesktop && gradient(PAGE_TOP, colors.pageBg)]}>
      {isDesktop ? (
        <Topbar
          plain
          crumbs={[
            { label: 'Painel', icon: 'chevron-back', onPress: () => navigation.getParent()?.navigate('Painel' as never) },
            { label: 'Administração' },
          ]}
          userName={profile?.full_name}
          userRole={roleLabel[profile?.role ?? 'viewer']}
          onUser={() => navigation.navigate('ProfileHome')}
          onNotifications={() => navigation.getParent()?.navigate('Pesagens' as never)}
          onSignOut={signOut}
        />
      ) : (
        <Header
          eyebrow="Administração"
          title="Cadastros e administração"
          subtitle="Estruture a operação e gerencie os acessos"
          onBack={() => navigation.goBack()}
        />
      )}

      <ScrollView contentContainerStyle={isDesktop ? styles.deskScroll : styles.scroll}>
        {isDesktop ? (
          <PageHeader
            titleSize={34}
            seal={<Settings size={30} strokeWidth={1.9} color={colors.form.tileIcon} />}
            title="Cadastros e administração"
            subtitle="Estruture a operação e gerencie os acessos do sistema."
            right={
              <View style={styles.todayRow}>
                <Ionicons name="calendar-outline" size={15} color={colors.form.muted} />
                <Text style={styles.today}>{formatLongDate()}</Text>
              </View>
            }
          />
        ) : null}

        {/* ── Totais ────────────────────────────────────────────────── */}
        <View style={[styles.highlight, !isDesktop && styles.highlightStacked]}>
          <View style={styles.highlightIntro}>
            <View style={styles.highlightSeal}>
              <Database size={28} strokeWidth={1.9} color={colors.form.tileIcon} />
            </View>
            <View style={styles.grow}>
              <Text style={styles.highlightTitle}>Gestão organizada,{'\n'}operação mais eficiente</Text>
              <Text style={styles.highlightText}>
                Mantenha seus cadastros atualizados e garanta o bom funcionamento da sua operação.
              </Text>
            </View>
          </View>
          <View style={[styles.stats, !isDesktop && styles.statsStacked]}>
            <Stat icon="people" label="Usuários ativos" value={counts.activeUsers} />
            <View style={isDesktop ? styles.statDivider : styles.statDividerH} />
            <Stat icon="business" label="Clientes cadastrados" value={counts.clients} />
            <View style={isDesktop ? styles.statDivider : styles.statDividerH} />
            <Stat icon="location" label="Unidades cadastradas" value={counts.units} />
          </View>
        </View>

        {/* ── Base da operação ──────────────────────────────────────── */}
        <CardHead
          tone="green"
          icon={Database}
          title="Base da operação"
          description="Cadastros essenciais para o funcionamento do sistema."
          right={isDesktop ? (
            <Button
              title="Ver guia rápido"
              variant="outline"
              iconComponent={BookOpen}
              fullWidth={false}
              onPress={() => setGuide(true)}
              style={styles.headerButton}
            />
          ) : undefined}
        />
        <View style={isDesktop ? styles.grid : undefined}>{BASE.map((item) => card(item))}</View>
        {!isDesktop ? (
          <Button title="Ver guia rápido" variant="outline" iconComponent={BookOpen} onPress={() => setGuide(true)} style={styles.mobileGuide} />
        ) : null}

        {/* ── Utilitários ───────────────────────────────────────────── */}
        <View style={styles.toolsHead}>
          <CardHead
            tone="green"
            icon={Wrench}
            title="Utilitários e suporte"
            description="Ferramentas para facilitar a gestão e manutenção dos dados."
          />
        </View>
        {TOOLS.map((item) => card(item, true))}

        {/* ── Ajuda ─────────────────────────────────────────────────── */}
        <View style={[styles.help, !isDesktop && styles.helpStacked]}>
          {isDesktop ? <HelpLeaves /> : null}
          <View style={styles.helpSeal}>
            <CircleQuestionMark size={26} strokeWidth={2} color={colors.form.tileIcon} />
          </View>
          <View style={styles.grow}>
            <Text style={styles.helpTitle}>Precisa de ajuda?</Text>
            <Text style={styles.helpText}>Consulte o guia de uso do sistema.</Text>
          </View>
          <Button
            title="Ver documentação"
            variant="outline"
            iconComponent={BookOpen}
            fullWidth={!isDesktop}
            onPress={() => setDocs(true)}
            style={styles.helpButton}
          />
        </View>
      </ScrollView>

      <EvaInfoModal
        visible={guide}
        eva="pointing"
        title="Por onde começar"
        message={SETUP_ORDER}
        onClose={() => setGuide(false)}
      />
      <EvaInfoModal
        visible={docs}
        eva="pointing"
        title="Como usar o Eva Ambiental"
        message={HOW_TO_USE}
        onClose={() => setDocs(false)}
      />
    </View>
  );
}

/** Um total do bloco verde: selo, legenda e o número. */
function Stat({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statSeal}>
        <Ionicons name={icon} size={22} color={colors.form.tileIcon} />
      </View>
      <View style={styles.grow}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{formatNumber(value)}</Text>
      </View>
    </View>
  );
}

/** Topo um tom mais claro que o fundo, sem faixa nem linha — como nas demais telas. */
const PAGE_TOP = `linear-gradient(180deg, #FAFBFC 0px, #FAFBFC 140px, ${colors.pageBg} 250px)`;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  grow: { flex: 1, minWidth: 0 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  deskScroll: { paddingHorizontal: 27, paddingTop: 6, paddingBottom: spacing.xxl },

  todayRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingTop: 8 },
  today: { color: colors.form.muted, fontSize: 14 },
  headerButton: { minHeight: 44, paddingHorizontal: 20, borderRadius: 10 },

  /** Bloco verde do topo: o convite e os três totais. */
  highlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
    backgroundColor: '#EEF5EF',
    borderRadius: 14,
    paddingVertical: 22,
    paddingHorizontal: 24,
    marginBottom: 26,
  },
  highlightStacked: { flexDirection: 'column', alignItems: 'stretch', gap: 20 },
  highlightIntro: { flex: 1.15, flexDirection: 'row', alignItems: 'flex-start', gap: 18, minWidth: 0 },
  highlightSeal: {
    width: 56, height: 56, borderRadius: 14, backgroundColor: '#D8EDD3',
    alignItems: 'center', justifyContent: 'center',
  },
  highlightTitle: { fontSize: 17.5, fontWeight: '700', color: colors.text, lineHeight: 24, letterSpacing: -0.2 },
  highlightText: { fontSize: 14, lineHeight: 20, color: '#3D5A50', marginTop: 8 },

  stats: { flex: 2, flexDirection: 'row', alignItems: 'center' },
  statsStacked: { flexDirection: 'column', alignItems: 'stretch', gap: 14 },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 16, minWidth: 0 },
  statSeal: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: '#D8EDD3',
    alignItems: 'center', justifyContent: 'center',
  },
  statLabel: { fontSize: 13.5, color: '#3D5A50' },
  statValue: { fontSize: 30, fontWeight: '700', color: colors.text, letterSpacing: -0.8, marginTop: 1 },
  statDivider: { width: 1, height: 52, backgroundColor: '#D3E4D6', marginHorizontal: 22 },
  statDividerH: { height: 1, backgroundColor: '#D3E4D6' },

  /** Cartões de cadastro: três por linha no site, um por linha no celular. */
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 17 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F1',
    padding: 26,
    marginBottom: 17,
  },
  itemGrid: { flexGrow: 1, flexBasis: '30%', minWidth: 300, marginBottom: 0 },
  itemHover: { borderColor: colors.greenLine, backgroundColor: '#FCFEFC' },
  itemSeal: {
    width: 56, height: 56, borderRadius: 14, backgroundColor: '#EBF4ED',
    alignItems: 'center', justifyContent: 'center',
  },
  itemTitle: { fontSize: 17.5, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  itemSub: { fontSize: 14, lineHeight: 20, color: colors.form.muted, marginTop: 4 },

  toolsHead: { marginTop: 26 },
  mobileGuide: { marginBottom: spacing.lg },

  /** Rodapé de ajuda, com as folhas de ambientação à direita. */
  help: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    backgroundColor: '#EAF4EC',
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 24,
    marginTop: 10,
    overflow: 'hidden',
  },
  helpStacked: { flexDirection: 'column', alignItems: 'stretch' },
  helpSeal: {
    width: 52, height: 52, borderRadius: radius.full, backgroundColor: '#D8EDD3',
    alignItems: 'center', justifyContent: 'center',
  },
  helpTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  helpText: { fontSize: 14, color: '#3D5A50', marginTop: 4 },
  helpButton: { minHeight: 48, paddingHorizontal: 22, borderRadius: 10, backgroundColor: colors.white },
  leaves: { position: 'absolute', right: 0, bottom: 0, width: 260, height: 130 },
});
