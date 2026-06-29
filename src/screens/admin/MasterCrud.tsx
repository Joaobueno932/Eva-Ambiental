import React, { useCallback, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, EmptyState, Header, Input, Loading, Select, SelectOption } from '@/components';
import { colors, radius, spacing } from '@/theme';

export interface FieldConfig {
  key: string;
  label: string;
  type: 'text' | 'switch' | 'select';
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  options?: SelectOption[];
  required?: boolean;
  /** valor padrão ao criar novo registro */
  default?: any;
}

interface Props<T extends { id?: string; active?: boolean }> {
  title: string;
  subtitle?: string;
  fields: FieldConfig[];
  load: () => Promise<T[]>;
  upsert: (item: Partial<T>) => Promise<T>;
  /** Texto principal exibido no card de cada item */
  renderTitle: (item: T) => string;
  /** Texto secundário do card */
  renderSubtitle?: (item: T) => string;
}

export function MasterCrud<T extends { id?: string; active?: boolean }>({
  title,
  subtitle,
  fields,
  load,
  upsert,
  renderTitle,
  renderSubtitle,
}: Props<T>) {
  const navigation = useNavigation();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await load());
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao carregar.');
    } finally {
      setLoading(false);
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      fetch();
    }, [fetch])
  );

  const openNew = () => {
    const initial: Record<string, any> = {};
    fields.forEach((f) => {
      initial[f.key] = f.default ?? (f.type === 'switch' ? true : '');
    });
    initial.active = true;
    setForm(initial);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (item: T) => {
    setForm({ ...item });
    setErrors({});
    setModalOpen(true);
  };

  const save = async () => {
    const e: Record<string, string> = {};
    fields.forEach((f) => {
      if (f.required && !String(form[f.key] ?? '').trim()) e[f.key] = 'Campo obrigatório.';
    });
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    try {
      await upsert(form as Partial<T>);
      setModalOpen(false);
      await fetch();
    } catch (err: any) {
      Alert.alert('Erro ao salvar', err?.message ?? 'Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: T) => {
    try {
      await upsert({ ...item, active: !item.active });
      await fetch();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao atualizar.');
    }
  };

  return (
    <View style={styles.container}>
      <Header title={title} subtitle={subtitle} onBack={() => navigation.goBack()} />

      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, idx) => item.id ?? String(idx)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState icon="folder-open-outline" title="Nenhum registro" message="Toque em + para cadastrar." />}
          renderItem={({ item }) => (
            <Card>
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{renderTitle(item)}</Text>
                  {renderSubtitle ? <Text style={styles.itemSub}>{renderSubtitle(item)}</Text> : null}
                </View>
                <View style={styles.actions}>
                  <View style={[styles.statusDot, { backgroundColor: item.active ? colors.success : colors.grayMedium }]} />
                  <Switch
                    value={!!item.active}
                    onValueChange={() => toggleActive(item)}
                    trackColor={{ true: colors.greenLight, false: colors.grayMedium }}
                    thumbColor={item.active ? colors.green : colors.gray}
                  />
                  <Pressable onPress={() => openEdit(item)} hitSlop={8}>
                    <Ionicons name="create-outline" size={24} color={colors.greenDark} />
                  </Pressable>
                </View>
              </View>
            </Card>
          )}
        />
      )}

      <Pressable style={styles.fab} onPress={openNew} accessibilityLabel="Adicionar">
        <Ionicons name="add" size={32} color={colors.white} />
      </Pressable>

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{form.id ? 'Editar' : 'Novo'} registro</Text>
              <Pressable onPress={() => setModalOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={26} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {fields.map((f) => {
                if (f.type === 'switch') {
                  return (
                    <View key={f.key} style={styles.switchRow}>
                      <Text style={styles.switchLabel}>{f.label}</Text>
                      <Switch
                        value={!!form[f.key]}
                        onValueChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))}
                        trackColor={{ true: colors.greenLight, false: colors.grayMedium }}
                        thumbColor={form[f.key] ? colors.green : colors.gray}
                      />
                    </View>
                  );
                }
                if (f.type === 'select') {
                  return (
                    <Select
                      key={f.key}
                      label={f.label}
                      placeholder={f.placeholder}
                      options={f.options ?? []}
                      value={form[f.key] ?? ''}
                      onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))}
                      error={errors[f.key]}
                    />
                  );
                }
                return (
                  <Input
                    key={f.key}
                    label={f.label}
                    placeholder={f.placeholder}
                    keyboardType={f.keyboardType}
                    value={String(form[f.key] ?? '')}
                    onChangeText={(v) => setForm((s) => ({ ...s, [f.key]: v }))}
                    error={errors[f.key]}
                  />
                );
              })}
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Ativo</Text>
                <Switch
                  value={form.active !== false}
                  onValueChange={(v) => setForm((s) => ({ ...s, active: v }))}
                  trackColor={{ true: colors.greenLight, false: colors.grayMedium }}
                  thumbColor={form.active !== false ? colors.green : colors.gray}
                />
              </View>
              <Button title="Salvar" icon="checkmark" onPress={save} loading={saving} />
              <View style={{ height: spacing.xl }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.greenBg },
  list: { padding: spacing.lg, paddingBottom: 120 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  itemTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  itemSub: { color: colors.grayText, fontSize: 13, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  fab: {
    position: 'absolute', right: spacing.lg, bottom: spacing.xl, width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', elevation: 6,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.greenBg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: '88%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md },
  switchLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
});
