import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
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
        <View style={styles.sheet}>
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, maxHeight: '80%' },
  content: { alignItems: 'center', paddingBottom: spacing.lg },
  title: { fontSize: 20, fontWeight: '800', color: colors.greenDark, marginBottom: spacing.sm, textAlign: 'center' },
  message: { fontSize: 15, color: colors.text, textAlign: 'center', lineHeight: 22 },
});
