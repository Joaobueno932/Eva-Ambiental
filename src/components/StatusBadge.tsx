import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/theme';
import { ApprovalStatus } from '@/types';
import { approvalLabel } from '@/utils/format';

const map: Record<ApprovalStatus, { bg: string; text: string }> = {
  pending: { bg: '#FEF3C7', text: '#92400E' },
  approved: { bg: '#DCFCE7', text: '#166534' },
  rejected: { bg: '#FEE2E2', text: '#991B1B' },
};

export function StatusBadge({ status, large }: { status: ApprovalStatus; large?: boolean }) {
  const c = map[status] ?? map.pending;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }, large && styles.large]}>
      <Text style={[styles.text, { color: c.text }, large && { fontSize: 14 }]}>{approvalLabel[status]}</Text>
    </View>
  );
}

/** Badge genérico para texto livre (ex.: classificação de desempenho). */
export function Tag({ label, color = colors.green, bg = colors.greenBg }: { label: string; color?: string; bg?: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  large: { paddingHorizontal: 14, paddingVertical: 6 },
  text: { fontSize: 12, fontWeight: '700' },
});
