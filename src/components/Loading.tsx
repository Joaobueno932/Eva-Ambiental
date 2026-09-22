import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';

export function Loading({ message = 'Carregando...' }: { message?: string }) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.halo}>
        <ActivityIndicator size="large" color={colors.brand[600]} />
      </View>
      {message ? <Text style={styles.text}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.pageBg },
  halo: {
    width: 76,
    height: 76,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { marginTop: spacing.lg, color: colors.textMuted, fontSize: 13.5, fontWeight: '500' },
});
