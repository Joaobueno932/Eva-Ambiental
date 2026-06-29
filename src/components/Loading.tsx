import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/theme';

export function Loading({ message = 'Carregando...' }: { message?: string }) {
  return (
    <View style={styles.wrapper}>
      <ActivityIndicator size="large" color={colors.green} />
      {message ? <Text style={styles.text}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.greenBg },
  text: { marginTop: spacing.md, color: colors.grayText, fontSize: 14 },
});
