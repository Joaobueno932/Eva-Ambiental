import React, { useState } from 'react';
import { Dimensions, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, elevation, radius, ring, spacing, transition } from '@/theme';
import { useIsDesktop } from '@/hooks/useLayout';
import { formStyles } from './Input';

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
  /** `form`: o mesmo campo alto de rótulo escuro do `Input` nos formulários de registro. */
  size?: 'md' | 'form';
  /** Asterisco vermelho depois do rótulo. */
  required?: boolean;
  /** Ícone preenchido à esquerda do valor — diz do que é o filtro sem ler o rótulo. */
  leftIcon?: keyof typeof Ionicons.glyphMap;
  /** Cor do ícone — por padrão o verde escuro dos ícones de formulário. */
  leftIconColor?: string;
  /** Ícone de traço (ex.: Lucide) no lugar do glifo do Ionicons. */
  leftIconComponent?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

export function Select({ label, placeholder = 'Selecione...', value, options, onChange, error, disabled, size = 'md', required, leftIcon, leftIconColor, leftIconComponent: LeftIcon }: Props) {
  const isForm = size === 'form';
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();
  const { height: screenHeight } = Dimensions.get('window');
  const selected = options.find((o) => o.value === value);

  // Máximo de 60% da altura da tela para a lista, respeitando safe area inferior.
  const listMaxHeight = screenHeight * 0.6 - Math.max(insets.bottom, spacing.lg) - 60;

  return (
    <View style={isForm ? formStyles.wrapper : styles.wrapper}>
      {label && (
        <Text style={isForm ? formStyles.label : isDesktop ? webStyles.label : styles.label}>
          {label}
          {required ? <Text style={formStyles.required}>{'  *'}</Text> : null}
        </Text>
      )}
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label ?? placeholder}: ${selected?.label ?? placeholder}`}
        accessibilityState={{ disabled, expanded: open }}
        style={({ hovered }: any) => [
          isDesktop ? webStyles.field : styles.field,
          isForm && formField.field,
          transition('background-color, border-color, box-shadow'),
          isDesktop && hovered && !disabled && { borderColor: colors.borderStrong, backgroundColor: colors.white },
          open && !disabled && [{ borderColor: colors.brand[500], backgroundColor: colors.white }, ring(colors.brand[500])],
          error ? styles.fieldError : null,
          disabled && styles.fieldDisabled,
        ]}
      >
        {LeftIcon ? (
          <View style={{ marginRight: 10 }}>
            <LeftIcon size={18} strokeWidth={2} color={leftIconColor ?? colors.form.tileIcon} />
          </View>
        ) : leftIcon ? (
          <Ionicons name={leftIcon} size={16} color={leftIconColor ?? colors.form.tileIcon} style={{ marginRight: 10 }} />
        ) : null}
        <Text
          style={[
            isDesktop ? webStyles.value : styles.value,
            isForm && formField.value,
            !selected && { color: isForm ? colors.form.soft : colors.textSoft },
          ]}
          numberOfLines={1}
        >
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={isForm ? 18 : isDesktop ? 15 : 20}
          color={open ? colors.brand[600] : isForm ? colors.form.label : colors.textSoft}
        />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={isDesktop ? webStyles.backdrop : styles.backdrop}
          onPress={() => setOpen(false)}
        >
          <Pressable
            style={
              isDesktop
                ? [webStyles.dialog, elevation('xl')]
                : [styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }, elevation('xl')]
            }
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={isDesktop ? webStyles.dialogTitle : styles.sheetTitle}>{label ?? 'Selecione'}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: isDesktop ? 340 : listMaxHeight }}
              ListEmptyComponent={<Text style={styles.empty}>Nenhuma opção disponível.</Text>}
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <Pressable
                    style={({ hovered }: any) => [
                      isDesktop ? webStyles.option : styles.option,
                      transition('background-color'),
                      isDesktop && hovered && { backgroundColor: colors.surfaceAlt },
                      active && { backgroundColor: colors.greenBg },
                    ]}
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        isDesktop ? webStyles.optionText : styles.optionText,
                        active && { color: colors.brand[700], fontWeight: '700' },
                      ]}
                    >
                      {item.label}
                    </Text>
                    {active && <Ionicons name="checkmark" size={18} color={colors.brand[600]} />}
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
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 },
  field: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldError: { borderColor: colors.danger, backgroundColor: colors.dangerBg },
  fieldDisabled: { opacity: 0.55, backgroundColor: colors.surfaceSunken },
  value: { fontSize: 16, color: colors.text, flex: 1, marginRight: spacing.sm },
  error: { color: colors.danger, fontSize: 12, fontWeight: '500', marginTop: 5 },
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.lg,
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
  empty: { color: colors.textMuted, textAlign: 'center', padding: spacing.lg, fontSize: 13 },
});

const webStyles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 6, letterSpacing: 0.2 },
  field: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  value: { fontSize: 14, color: colors.text, flex: 1, marginRight: spacing.sm },
  // Com mouse a folha vinda de baixo não faz sentido: o diálogo nasce no centro.
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    width: '100%',
    maxWidth: 420,
  },
  dialogTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  optionText: { fontSize: 14, color: colors.text },
});

/** Campo do tamanho `form`: mesma caixa do `Input` equivalente. */
const formField = StyleSheet.create({
  field: {
    backgroundColor: colors.form.fieldBg,
    borderWidth: 1,
    borderColor: colors.form.border,
    borderRadius: radius.sm,
    paddingHorizontal: 16,
    minHeight: 50,
    height: 50,
  },
  value: { fontSize: 16, color: colors.form.label },
});
