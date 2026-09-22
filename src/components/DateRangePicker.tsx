import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, transition } from '@/theme';
import { Input } from './Input';
import { Button } from './Button';
import { buildPreset, customRange, DateRange, PresetKey } from '@/utils/dateRanges';

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const PRESETS: { key: Exclude<PresetKey, 'custom'>; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: 'week', label: 'Esta Semana' },
  { key: 'month', label: 'Este Mês' },
  { key: 'year', label: 'Este Ano' },
];

export function DateRangePicker({ value, onChange }: Props) {
  const [showCustom, setShowCustom] = useState(value.key === 'custom');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState<string | undefined>();

  const applyCustom = () => {
    const r = customRange(start, end);
    if (!r) {
      setError('Use o formato DD/MM/AAAA nas duas datas.');
      return;
    }
    setError(undefined);
    onChange(r);
  };

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {PRESETS.map((p) => {
          const active = value.key === p.key;
          return (
            <Pressable
              key={p.key}
              onPress={() => {
                setShowCustom(false);
                onChange(buildPreset(p.key));
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={({ hovered }: any) => [styles.chip, transition(), hovered && !active && styles.chipHover, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.label}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setShowCustom((s) => !s)}
          accessibilityRole="button"
          accessibilityState={{ selected: value.key === 'custom' }}
          style={({ hovered }: any) => [
            styles.chip,
            transition(),
            hovered && value.key !== 'custom' && styles.chipHover,
            value.key === 'custom' && styles.chipActive,
          ]}
        >
          <Text style={[styles.chipText, value.key === 'custom' && styles.chipTextActive]}>Personalizado</Text>
        </Pressable>
      </ScrollView>

      {showCustom && (
        <View style={styles.customBox}>
          <View style={styles.customRow}>
            <View style={{ flex: 1 }}>
              <Input label="Data inicial" placeholder="DD/MM/AAAA" value={start} onChangeText={setStart} keyboardType="numbers-and-punctuation" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Data final" placeholder="DD/MM/AAAA" value={end} onChangeText={setEnd} keyboardType="numbers-and-punctuation" />
            </View>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Aplicar período" icon="calendar-outline" onPress={applyCustom} variant="outline" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipHover: { borderColor: colors.borderStrong, backgroundColor: colors.surfaceAlt },
  chipActive: { backgroundColor: colors.brand[700], borderColor: colors.brand[800] },
  chipText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: colors.white },
  customBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
  },
  customRow: { flexDirection: 'row', gap: spacing.md },
  error: { color: colors.danger, fontSize: 12, marginBottom: spacing.sm },
});
