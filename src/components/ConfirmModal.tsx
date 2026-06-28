import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
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
        <View style={styles.box}>
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
            <Pressable style={styles.cancel} onPress={onCancel} disabled={loading}>
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  box: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.xl, width: '100%' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  message: { fontSize: 14, color: colors.grayText, marginBottom: spacing.lg, lineHeight: 20 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  cancel: { paddingVertical: 14, paddingHorizontal: spacing.lg },
  cancelText: { fontSize: 16, fontWeight: '600', color: colors.grayText },
});
