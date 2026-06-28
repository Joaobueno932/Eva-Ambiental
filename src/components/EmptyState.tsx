import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/theme';
import { EvaImageKey } from '@/theme/images';
import { EvaImage } from './EvaImage';

interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  /** Quando informado, exibe a Eva no lugar do ícone (estados vazios acolhedores) */
  eva?: EvaImageKey;
  title: string;
  message?: string;
  children?: React.ReactNode;
}

export function EmptyState({ icon = 'leaf-outline', eva, title, message, children }: Props) {
  return (
    <View style={styles.wrapper}>
      {eva ? (
        <EvaImage name={eva} width={150} height={170} style={{ marginBottom: spacing.md }} />
      ) : (
        <View style={styles.circle}>
          <Ionicons name={icon} size={48} color={colors.green} />
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {children ? <View style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  circle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.greenBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
  message: { fontSize: 14, color: colors.grayText, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 },
});
