import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/theme';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export function Header({ title, subtitle, onBack, right }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} style={styles.back} accessibilityLabel="Voltar">
            <Ionicons name="chevron-back" size={26} color={colors.white} />
          </Pressable>
        ) : (
          <View style={styles.leaf}>
            <Ionicons name="leaf" size={22} color={colors.white} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.green,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  back: { marginRight: spacing.xs },
  leaf: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.greenDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  title: { color: colors.white, fontSize: 20, fontWeight: '800' },
  subtitle: { color: colors.greenBg, fontSize: 13, marginTop: 1 },
});
