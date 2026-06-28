import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';

export interface SelectOption {
  label: string;
  value: string;
}

interface Props {
  label?: string;
  placeholder?: string;
  value?: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export function Select({ label, placeholder = 'Selecione...', value, options, onChange, error, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        style={[styles.field, error ? styles.fieldError : null, disabled && { opacity: 0.5 }]}
      >
        <Text style={[styles.value, !selected && { color: colors.grayText }]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.grayText} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{label ?? 'Selecione'}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              ListEmptyComponent={<Text style={styles.empty}>Nenhuma opção disponível.</Text>}
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <Pressable
                    style={[styles.option, active && { backgroundColor: colors.greenBg }]}
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                  >
                    <Text style={[styles.optionText, active && { color: colors.greenDark, fontWeight: '700' }]}>
                      {item.label}
                    </Text>
                    {active && <Ionicons name="checkmark" size={20} color={colors.green} />}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  field: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.grayMedium,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldError: { borderColor: colors.danger },
  value: { fontSize: 16, color: colors.text, flex: 1, marginRight: spacing.sm },
  error: { color: colors.danger, fontSize: 12, marginTop: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '70%',
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  optionText: { fontSize: 16, color: colors.text },
  empty: { color: colors.grayText, textAlign: 'center', padding: spacing.lg },
});
