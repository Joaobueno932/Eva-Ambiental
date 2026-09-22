import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, elevation, radius, spacing } from '@/theme';
import { EvaImageKey } from '@/theme/images';
import { Button } from './Button';
import { EvaImage } from './EvaImage';

interface Props {
  visible: boolean;
  eva: EvaImageKey;
  title: string;
  message: string;
  onClose: () => void;
}

/**
 * Modal informativo apresentado pela Eva — usado em Ajuda e Sobre.
 */
export function EvaInfoModal({ visible, eva, title, message, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, elevation('xl')]}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <EvaImage name={eva} width={150} height={170} style={{ marginBottom: spacing.sm }} />
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
          </ScrollView>
          <Button title="Entendi" icon="leaf" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.xl,
    maxHeight: '80%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  content: { alignItems: 'center', paddingBottom: spacing.lg },
  title: { fontSize: 19, fontWeight: '700', color: colors.brand[700], marginBottom: spacing.sm, textAlign: 'center', letterSpacing: -0.3 },
  message: { fontSize: 14.5, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
});
