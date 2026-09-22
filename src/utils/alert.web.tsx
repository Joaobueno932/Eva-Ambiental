/**
 * Versão web do diálogo de aviso.
 *
 * O `Alert.alert` do react-native-web é um no-op: a mensagem simplesmente
 * sumiria. Aqui um pequeno barramento (fila + assinante) alimenta o
 * `<AlertHost />` montado no App, que desenha um modal com a identidade do
 * sistema — melhor que o `window.alert` do navegador, que trava a aba e exibe
 * o domínio do site no título.
 */
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';

interface AlertItem {
  title: string;
  message?: string;
}

let listener: ((item: AlertItem) => void) | null = null;
/** Mensagens disparadas antes do host montar ficam guardadas aqui. */
const pending: AlertItem[] = [];

export function showAlert(title: string, message?: string): void {
  const item = { title, message };
  if (listener) listener(item);
  else pending.push(item);
}

export function AlertHost() {
  const [queue, setQueue] = useState<AlertItem[]>([]);

  useEffect(() => {
    listener = (item) => setQueue((q) => [...q, item]);
    if (pending.length) {
      setQueue((q) => [...q, ...pending.splice(0, pending.length)]);
    }
    return () => {
      listener = null;
    };
  }, []);

  const current = queue[0];
  const dismiss = () => setQueue((q) => q.slice(1));

  return (
    <Modal visible={!!current} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <Text style={styles.title}>{current?.title}</Text>
          {current?.message ? <Text style={styles.message}>{current.message}</Text> : null}
          <Pressable onPress={dismiss} style={styles.button} accessibilityRole="button">
            <Text style={styles.buttonText}>OK</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  box: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  message: { fontSize: 15, color: colors.grayText, marginTop: spacing.sm, lineHeight: 21 },
  button: {
    marginTop: spacing.xl,
    alignSelf: 'flex-end',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.green,
  },
  buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
