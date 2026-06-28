import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
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
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.label}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setShowCustom((s) => !s)}
          style={[styles.chip, value.key === 'custom' && styles.chipActive]}
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
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.grayMedium,
  },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: colors.white },
  customBox: { marginTop: spacing.md },
  customRow: { flexDirection: 'row', gap: spacing.md },
  error: { color: colors.danger, fontSize: 12, marginBottom: spacing.sm },
});
