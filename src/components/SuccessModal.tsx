import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
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
        <View style={styles.box}>
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  box: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.xl, width: '100%', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.greenDark, marginBottom: spacing.xs },
  message: { fontSize: 15, color: colors.grayText, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 21 },
});
