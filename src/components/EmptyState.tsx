import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
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
          <View style={styles.circleInner}>
            <Ionicons name={icon} size={30} color={colors.brand[600]} />
          </View>
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {children ? <View style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  // Dois anéis concêntricos: o externo bem claro, o interno com o verde da
  // marca. Um disco só, do tamanho que o ícone pedia, virava uma bola de cor.
  circle: {
    width: 84,
    height: 84,
    borderRadius: radius.full,
    backgroundColor: colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  circleInner: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.greenLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16.5, fontWeight: '700', color: colors.text, textAlign: 'center', letterSpacing: -0.2 },
  message: { fontSize: 13.5, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20, maxWidth: 420 },
});
