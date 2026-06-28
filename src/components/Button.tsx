import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';

interface Props {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
  fullWidth = true,
}: Props) {
  const isDisabled = disabled || loading;
  const palette = getPalette(variant);

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: palette.bg, borderColor: palette.border },
        fullWidth && { alignSelf: 'stretch' },
        pressed && !isDisabled && { opacity: 0.85 },
        isDisabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <View style={styles.content}>
          {icon && <Ionicons name={icon} size={20} color={palette.text} style={{ marginRight: spacing.sm }} />}
          <Text style={[styles.text, { color: palette.text }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

function getPalette(v: Variant) {
  switch (v) {
    case 'secondary':
      return { bg: colors.greenLight, border: colors.greenLight, text: colors.text };
    case 'outline':
      return { bg: colors.white, border: colors.green, text: colors.greenDark };
    case 'danger':
      return { bg: colors.danger, border: colors.danger, text: colors.white };
    case 'ghost':
      return { bg: 'transparent', border: 'transparent', text: colors.greenDark };
    default:
      return { bg: colors.green, border: colors.green, text: colors.white };
  }
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 16, fontWeight: '700' },
});
