import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { colors, elevation, radius, spacing } from '@/theme';
import { Button } from './Button';
import { EvaImage } from './EvaImage';

interface Props {
  visible: boolean;
  title?: string;
  message?: string;
  buttonLabel?: string;
  onClose: () => void;
}

/**
 * Confirmação visual de sucesso com a Eva — usada após salvar uma pesagem.
 */
export function SuccessModal({
  visible,
  title = 'Tudo certo!',
  message = 'Pesagem registrada com sucesso.',
  buttonLabel = 'Continuar',
  onClose,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.box, elevation('xl')]}>
          <EvaImage name="pointing" width={140} height={170} style={{ marginBottom: spacing.sm }} />
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <Button title={buttonLabel} icon="checkmark-circle" onPress={onClose} />
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
    maxWidth: 400,
    alignSelf: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 21, fontWeight: '700', color: colors.brand[700], marginBottom: spacing.xs, letterSpacing: -0.4 },
  message: { fontSize: 14.5, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 21 },
});
