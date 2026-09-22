import React, { useCallback, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { showAlert } from '@/utils/alert';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, EmptyState, Header, Input, Loading, Select, SelectOption } from '@/components';
import { DataTable } from '@/components/DataTable';
import { Tag } from '@/components/StatusBadge';
import { colors, elevation, layout, radius, spacing } from '@/theme';
import { useIsDesktop } from '@/hooks/useLayout';

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
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const isDesktop = useIsDesktop();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await load());
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao carregar.');
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
      showAlert('Erro ao salvar', err?.message ?? 'Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: T) => {
    try {
      await upsert({ ...item, active: !item.active });
      await fetch();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao atualizar.');
    }
  };

  const filteredItems = items.filter(item => [renderTitle(item), renderSubtitle?.(item)].filter(Boolean).join(' ').toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return (
    <View style={styles.container}>
      <Header
        title={title}
        subtitle={subtitle}
        onBack={() => navigation.goBack()}
        right={
          isDesktop ? (
            <Button title="Novo registro" icon="add" fullWidth={false} onPress={openNew} />
          ) : undefined
        }
      />

      <View style={{ padding: spacing.lg, paddingBottom: 0 }}><Input label="Buscar cadastros" placeholder="Nome ou identificação" value={search} onChangeText={setSearch} /></View>
      {loading ? (
        <Loading />
      ) : isDesktop ? (
        <ScrollView contentContainerStyle={styles.list}>
          <DataTable items={filteredItems} keyExtractor={item => item.id ?? renderTitle(item)} empty={<EmptyState title="Nenhum registro encontrado" message="Ajuste a busca ou cadastre um novo registro." />} columns={[
            { key: 'name', label: 'IDENTIFICAÇÃO', flex: 2, render: item => <Text style={styles.itemTitle}>{renderTitle(item)}</Text> },
            { key: 'details', label: 'INFORMAÇÕES', flex: 2, render: item => <Text style={styles.itemSub}>{renderSubtitle?.(item) ?? '—'}</Text> },
            { key: 'status', label: 'SITUAÇÃO', render: item => <Tag label={item.active ? 'Ativo' : 'Inativo'} color={item.active ? colors.success : colors.textMuted} /> },
            { key: 'actions', label: 'AÇÕES', flex: 1.5, render: item => <View style={styles.actions}><Switch accessibilityLabel={'Ativar ' + renderTitle(item)} value={!!item.active} onValueChange={() => toggleActive(item)} /><Button title="Editar" variant="outline" fullWidth={false} onPress={() => openEdit(item)} /></View> },
          ]} />
        </ScrollView>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item, idx) => item.id ?? String(idx)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState icon="folder-open-outline" title="Nenhum registro" message={isDesktop ? 'Use o botão "Novo registro" para cadastrar.' : 'Toque em + para cadastrar.'} />}
          renderItem={({ item }) => (
            <Card>
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{renderTitle(item)}</Text>
                  {renderSubtitle ? <Text style={styles.itemSub}>{renderSubtitle(item)}</Text> : null}
                </View>
                <View style={styles.actions}>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.active ? 'Ativo' : 'Inativo'}</Text>
                  <Switch
                    value={!!item.active}
                    onValueChange={() => toggleActive(item)}
                    trackColor={{ true: colors.greenLight, false: colors.grayMedium }}
                    thumbColor={item.active ? colors.green : colors.gray}
                  />
                  <Pressable accessibilityRole="button" accessibilityLabel={'Editar ' + renderTitle(item)} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }} onPress={() => openEdit(item)} hitSlop={8}>
                    <Ionicons name="create-outline" size={24} color={colors.greenDark} />
                  </Pressable>
                </View>
              </View>
            </Card>
          )}
        />
      )}

      {/* No site a ação vive no cabeçalho, junto do título. */}
      {!isDesktop && (
        <Pressable style={styles.fab} onPress={openNew} accessibilityLabel="Adicionar">
          <Ionicons name="add" size={32} color={colors.white} />
        </Pressable>
      )}

      <Modal
        visible={modalOpen}
        transparent
        animationType={isDesktop ? 'fade' : 'slide'}
        onRequestClose={() => setModalOpen(false)}
      >
        <KeyboardAvoidingView
          style={isDesktop ? webStyles.backdrop : styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={isDesktop ? webStyles.dialog : styles.sheet}>
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
  container: { flex: 1, backgroundColor: colors.pageBg },
  list: {
    padding: spacing.lg,
    paddingBottom: 120,
    width: '100%',
    maxWidth: layout.content,
    alignSelf: 'center',
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  itemTitle: { fontSize: 15, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  itemSub: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  fab: {
    position: 'absolute', right: spacing.lg, bottom: spacing.xl, width: 56, height: 56,
    borderRadius: radius.full, backgroundColor: colors.brand[700],
    alignItems: 'center', justifyContent: 'center',
    ...elevation('lg'),
  },
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.lg,
    maxHeight: '88%',
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.borderSoft,
    borderRadius: radius.md, padding: spacing.md + 2, marginBottom: spacing.md,
  },
  switchLabel: { fontSize: 14.5, fontWeight: '600', color: colors.text },
});

const webStyles = StyleSheet.create({
  // Com mouse, a folha que sobe do rodapé não faz sentido: o formulário
  // nasce no centro da tela, como qualquer diálogo de sistema.
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 520,
    maxHeight: '88%',
    ...elevation('xl'),
  },
});
