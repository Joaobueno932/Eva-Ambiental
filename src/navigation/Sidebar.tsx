import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
// Um import por ícone, não o índice do pacote: o índice arrasta os ~1.700
// ícones do Lucide para o bundle (de 6,2 MB para 10 MB) para usarmos oito.
import House from 'lucide-react-native/icons/house';
import MapPin from 'lucide-react-native/icons/map-pin';
import Recycle from 'lucide-react-native/icons/recycle';
import Settings from 'lucide-react-native/icons/settings';
import Trash from 'lucide-react-native/icons/trash';
import Truck from 'lucide-react-native/icons/truck';
import Upload from 'lucide-react-native/icons/upload';
import Users from 'lucide-react-native/icons/users';
import { colors, gradient, layout, spacing, transition } from '@/theme';
import { usePermissions } from '@/hooks/usePermissions';
import { EvaImage } from '@/components/EvaImage';
import { ReportsIcon, WeighingsIcon, type MenuIconProps } from '@/components/MenuIcons';
import { SidebarScenery } from './SidebarScenery';
import type { ProfileStackParamList } from './types';

/** Largura do menu lateral. */
export const SIDEBAR_WIDTH = layout.sidebar;

/**
 * Ícones de traço (Lucide), não os preenchidos do Ionicons.
 *
 * O desenho de referência usa linha fina e arredondada em todos os itens. Os
 * glifos do Ionicons têm peso de preenchimento mesmo nas variantes
 * `-outline`, e numa coluna de onze ícones essa diferença de peso é o que
 * fazia o menu parecer mais pesado que o desenho.
 */
type MenuIcon = React.ComponentType<MenuIconProps>;

const ROUTE_ICONS: Record<string, MenuIcon> = {
  Painel: House,
  Pesagens: WeighingsIcon,
  Relatorios: ReportsIcon,
};

/** Rotas que o menu principal lista, na ordem. As demais entram nas seções. */
const PRIMARY_ROUTES = ['Painel', 'Pesagens', 'Relatorios'];

/**
 * Seções de cadastro e administração.
 *
 * Antes eram dois itens — "Cadastros" e "Administração" — que abriam telas
 * de índice. Chegar a "Tipos de Tratamento" custava dois cliques e uma tela
 * intermediária que não fazia nada além de listar links. Com o menu aberto,
 * o destino é um clique e fica visível sem navegar.
 */
const SECTIONS: {
  caption: string;
  items: { route: keyof ProfileStackParamList; label: string; icon: MenuIcon }[];
}[] = [
  {
    caption: 'Cadastros',
    items: [
      { route: 'AdminClients', label: 'Clientes', icon: Users },
      { route: 'AdminUnits', label: 'Unidades', icon: MapPin },
      { route: 'AdminWasteTypes', label: 'Tipos de Resíduos', icon: Trash },
      { route: 'AdminTreatmentTypes', label: 'Tipos de Tratamento', icon: Recycle },
      { route: 'AdminRecipients', label: 'Destinatários', icon: Truck },
    ],
  },
  {
    caption: 'Administração',
    items: [
      { route: 'AdminUsers', label: 'Usuários', icon: Users },
      { route: 'AdminImport', label: 'Importação', icon: Upload },
    ],
  },
];

/**
 * Menu lateral do site.
 *
 * Substitui a barra de abas do React Navigation em tela grande. A barra padrão
 * sabe listar rotas, mas não tem onde colocar a marca — que num sistema de uso
 * diário precisa estar sempre visível. Por isso a navegação é renderizada
 * aqui, e não via `tabBarPosition`.
 *
 * Medidas e cores seguem o desenho de referência: itens principais mais altos
 * que os das seções (47px contra 41px de passo), texto em peso regular — o
 * negrito fica reservado ao item aberto — e rótulos de seção legíveis, não
 * miniaturas em caixa alta.
 */
export function Sidebar(props: BottomTabBarProps) {
  const { isAdmin } = usePermissions();
  return <SidebarView {...props} isAdmin={isAdmin} />;
}

/**
 * O menu em si, com a permissão recebida em vez de lida.
 *
 * Separado de `Sidebar` para poder ser desenhado sem sessão — a visão de
 * administrador, que é a mais completa, só existiria atrás de um login.
 */
export function SidebarView({ state, descriptors, navigation, isAdmin }: BottomTabBarProps & { isAdmin: boolean }) {
  const insets = useSafeAreaInsets();

  // Cadastros e administração vivem dentro da aba Perfil: a aba sozinha não
  // diz qual deles está aberto. A tela interna é que decide o destaque — sem
  // isso, em "Usuários" o menu não marcava nada, e perdia-se a referência de
  // onde se está.
  const currentTab = state.routes[state.index] as any;
  const nestedScreen: string | undefined =
    currentTab?.name === 'Perfil'
      ? currentTab.state?.routes?.[currentTab.state.index ?? 0]?.name ?? 'ProfileHome'
      : undefined;

  const renderItem = (opts: {
    key: string;
    label: string;
    icon: MenuIcon;
    focused: boolean;
    onPress: () => void;
    role: 'tab' | 'button';
    /** Itens das seções são mais baixos que os da navegação principal. */
    compact?: boolean;
  }) => {
    const Icon = opts.icon;
    return (
      <Pressable
        key={opts.key}
        onPress={opts.onPress}
        accessibilityRole={opts.role}
        accessibilityState={opts.role === 'tab' ? { selected: opts.focused } : undefined}
        accessibilityLabel={opts.label}
        style={({ hovered }: any) => [
          styles.item,
          opts.compact ? styles.itemCompact : styles.itemPrimary,
          transition(),
          hovered && !opts.focused && styles.itemHover,
          opts.focused && styles.itemActive,
        ]}
      >
        <View style={[styles.itemMarker, opts.focused && styles.itemMarkerOn]} />
        <Icon
          size={22}
          strokeWidth={2}
          color={opts.focused ? colors.accent : colors.sidebarIcon}
        />
        <Text style={[styles.itemText, opts.focused && styles.itemTextActive]} numberOfLines={1}>
          {opts.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.sidebar,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.md },
      ]}
    >
      <SidebarScenery />

      <View style={styles.brand}>
        <View style={[styles.brandMark, gradient(`linear-gradient(145deg, ${colors.accent} 0%, #93CF4B 100%)`, colors.accent)]}>
          <Ionicons name="leaf" size={23} color={colors.sidebar} />
        </View>
        <View style={styles.grow}>
          <Text style={styles.brandText}>Eva Ambiental</Text>
          <Text style={styles.brandSub}>Controle que transforma</Text>
        </View>
      </View>

      {/* A navegação rola: com as seções abertas a lista passa da altura da
          janela em telas baixas, e a marca acima / a Eva abaixo ficam fixas. */}
      <ScrollView style={styles.grow} contentContainerStyle={styles.navScroll} showsVerticalScrollIndicator={false}>
        {state.routes
          .map((route, index) => ({ route, index }))
          .filter(({ route }) => PRIMARY_ROUTES.includes(route.name))
          .map(({ route, index }) => {
            const focused = state.index === index;
            const { options } = descriptors[route.key];
            const label =
              typeof options.tabBarLabel === 'string'
                ? options.tabBarLabel
                : options.title ?? route.name;

            return renderItem({
              key: route.key,
              label,
              icon: ROUTE_ICONS[route.name] ?? House,
              focused,
              role: 'tab',
              onPress: () => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  navigation.dispatch({
                    ...CommonActions.navigate(route.name, route.params),
                    target: state.key,
                  });
                }
              },
            });
          })}

        {/* Cadastros e administração são de quem administra. Para os demais
            perfis o menu termina na operação, sem itens que negariam acesso
            depois do clique. */}
        {isAdmin
          ? SECTIONS.map((section) => (
              <View key={section.caption}>
                <View style={styles.divider} />
                <Text style={styles.caption}>{section.caption}</Text>
                {section.items.map((item) =>
                  renderItem({
                    key: item.route,
                    label: item.label,
                    icon: item.icon,
                    focused: nestedScreen === item.route,
                    role: 'button',
                    compact: true,
                    onPress: () => navigation.navigate('Perfil', { screen: item.route }),
                  })
                )}
              </View>
            ))
          : null}

        {/* Configurações abre a administração para quem administra — é o que
            o desenho mostra — e a própria conta para os demais perfis. O
            administrador chega ao seu perfil pelo nome na barra superior. */}
        {!isAdmin ? <View style={styles.divider} /> : null}
        {renderItem({
          key: 'settings',
          label: 'Configurações',
          icon: Settings,
          focused: isAdmin ? nestedScreen === 'AdminHub' : nestedScreen === 'ProfileHome',
          role: 'button',
          compact: true,
          onPress: () => navigation.navigate('Perfil', { screen: isAdmin ? 'AdminHub' : 'ProfileHome' }),
        })}
      </ScrollView>

      {/* A Eva de pé sobre o morro, acenando — sem linha separando o rodapé:
          é a paisagem que marca o fim do menu. */}
      <View style={styles.footer}>
        <EvaImage name="hero" width={83} height={147} fallbackColor={colors.accent} style={styles.mascot} />
        <Text style={styles.footerText}>Juntos por um futuro mais limpo.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: colors.sidebar,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
  },

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 6,
    paddingBottom: 35,
  },
  // Canto superior direito mais aberto: o selo tem silhueta de folha.
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderTopRightRadius: 19,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { fontSize: 17, fontWeight: '700', color: colors.white, letterSpacing: -0.3 },
  brandSub: { fontSize: 12.5, color: colors.onSidebarMuted, marginTop: 1 },

  navScroll: { paddingBottom: spacing.lg },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 21,
    paddingLeft: 19,
    paddingRight: spacing.sm,
    borderRadius: 10,
    marginBottom: 3,
  },
  itemPrimary: { minHeight: 44 },
  itemCompact: { minHeight: 38 },
  itemHover: { backgroundColor: 'rgba(255,255,255,0.05)' },
  itemActive: { backgroundColor: colors.sidebarActive },
  /** Faixa vertical à esquerda: marca o item ativo sem inverter as cores. */
  itemMarker: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  itemMarkerOn: { backgroundColor: colors.accent },
  itemText: { fontSize: 14.5, fontWeight: '400', color: colors.sidebarText, flex: 1 },
  itemTextActive: { color: colors.white, fontWeight: '600' },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.09)',
    marginTop: 8,
    marginBottom: 16,
    marginHorizontal: 6,
  },
  caption: {
    color: colors.sidebarCaption,
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    paddingLeft: 15,
    marginBottom: 8,
  },

  /** Rodapé: a Eva e o propósito da operação, sobre a paisagem. */
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingLeft: 8,
  },
  // A imagem tem ~20px transparentes sob os pés; puxar para baixo apoia a Eva
  // no chão do morro em vez de deixá-la flutuando.
  mascot: { marginBottom: -12 },
  // 76px quebra em "Juntos por / um futuro / mais limpo.", como no desenho.
  // Acima do centro da mascote, na altura do peito, como no desenho.
  footerText: { maxWidth: 76, fontSize: 13, lineHeight: 18, color: colors.onSidebarMuted, marginBottom: 22 },
});
