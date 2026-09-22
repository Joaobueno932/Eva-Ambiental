import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, elevation, radius, spacing, transition } from '@/theme';
import { Button } from './Button';
import { Input } from './Input';

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  /** Se definido, exibe um campo de texto (ex.: motivo da rejeição). */
  withInput?: boolean;
  inputValue?: string;
  inputPlaceholder?: string;
  onChangeInput?: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive,
  loading,
  withInput,
  inputValue,
  inputPlaceholder,
  onChangeInput,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.box, elevation('xl')]}>
          <View style={[styles.icon, destructive ? styles.iconDanger : styles.iconBrand]}>
            <Ionicons
              name={destructive ? 'alert-circle' : 'help-circle'}
              size={20}
              color={destructive ? colors.danger : colors.brand[600]}
            />
          </View>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {withInput && (
            <Input
              value={inputValue}
              onChangeText={onChangeInput}
              placeholder={inputPlaceholder}
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />
          )}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              style={({ hovered }: any) => [styles.cancel, transition(), hovered && styles.cancelHover]}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Button
                title={confirmLabel}
                onPress={onConfirm}
                loading={loading}
                variant={destructive ? 'danger' : 'primary'}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  box: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  // Um ícone antes do título diz, antes da leitura, se a confirmação é
  // rotineira ou destrutiva.
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconBrand: { backgroundColor: colors.brand[50], borderWidth: 1, borderColor: colors.greenLine },
  iconDanger: { backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.dangerBorder },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.sm, letterSpacing: -0.3 },
  message: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.lg, lineHeight: 20 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  cancel: { paddingVertical: 12, paddingHorizontal: spacing.lg, borderRadius: radius.sm },
  cancelHover: { backgroundColor: colors.surfaceAlt },
  cancelText: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
});
