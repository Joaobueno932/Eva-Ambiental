import React, { useCallback, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { showAlert } from '@/utils/alert';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, EmptyState, Header, Input, Loading, Select } from '@/components';
import { DataTable } from '@/components/DataTable';
import { Tag } from '@/components/StatusBadge';
import { colors, elevation, layout, radius, spacing } from '@/theme';
import { useIsDesktop } from '@/hooks/useLayout';
import { useAuth } from '@/contexts/AuthContext';
import { createUser, listUsers, updateUser } from '@/services/users';
import { Profile, Role } from '@/types';
import { roleLabel } from '@/utils/format';

const roleOptions = [
  { label: 'Administrador', value: 'admin' },
  { label: 'Analista', value: 'analyst' },
  { label: 'Operador', value: 'operator' },
  { label: 'Visualizador', value: 'viewer' },
];

export function AdminUsersScreen() {
  const navigation = useNavigation();
  const { profile: me } = useAuth();
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const isDesktop = useIsDesktop();
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('analyst');
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await listUsers());
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetch();
    }, [fetch])
  );

  const openNew = () => {
    setEditing(null);
    setFullName('');
    setEmail('');
    setPassword('');
    setRole('analyst');
    setActive(true);
    setErrors({});
    setModal(true);
  };

  const openEdit = (u: Profile) => {
    setEditing(u);
    setFullName(u.full_name);
    setEmail(u.email);
    setPassword('');
    setRole(u.role);
    setActive(u.active);
    setErrors({});
    setModal(true);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = 'Informe o nome.';
    if (!editing) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'E-mail inválido.';
      if (password.length < 6) e.password = 'Senha de no mínimo 6 caracteres.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateUser(editing.id, { full_name: fullName.trim(), role, active });
      } else {
        await createUser({ email: email.trim(), password, full_name: fullName.trim(), role });
      }
      setModal(false);
      await fetch();
      if (!editing) showAlert('Sucesso', 'Usuário criado com segurança.');
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao salvar usuário.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Usuários"
        subtitle="Gestão de acessos"
        onBack={() => navigation.goBack()}
        right={
          isDesktop ? (
            <Button title="Novo usuário" icon="person-add" fullWidth={false} onPress={openNew} />
          ) : undefined
        }
      />

      <View style={{ padding: spacing.lg, paddingBottom: 0 }}><Input label="Buscar usuários" placeholder="Nome, e-mail ou perfil" value={search} onChangeText={setSearch} /></View>
      {loading ? (
        <Loading />
      ) : isDesktop ? (
        <ScrollView contentContainerStyle={styles.list}>
          <DataTable items={users.filter(u => [u.full_name, u.email, roleLabel[u.role]].join(' ').toLocaleLowerCase().includes(search.toLocaleLowerCase()))} keyExtractor={u => u.id} empty={<EmptyState title="Nenhum usuário encontrado" message="Ajuste a busca ou cadastre um usuário." />} columns={[
            { key: 'name', label: 'USUÁRIO', flex: 2, render: u => <Text style={styles.name}>{u.full_name}{u.id === me?.id ? ' (você)' : ''}</Text> },
            { key: 'email', label: 'E-MAIL', flex: 2, render: u => <Text style={styles.email}>{u.email}</Text> },
            { key: 'role', label: 'PERFIL', render: u => <Text style={styles.role}>{roleLabel[u.role]}</Text> },
            { key: 'status', label: 'SITUAÇÃO', render: u => <Tag label={u.active ? 'Ativo' : 'Inativo'} color={u.active ? colors.success : colors.textMuted} /> },
            { key: 'actions', label: 'ACESSO', render: u => <Button title="Editar" variant="outline" onPress={() => openEdit(u)} /> },
          ]} />
        </ScrollView>
      ) : (
        <FlatList
          data={users.filter(u => [u.full_name, u.email, roleLabel[u.role]].join(' ').toLocaleLowerCase().includes(search.toLocaleLowerCase()))}
          keyExtractor={(u) => u.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState icon="people-outline" title="Nenhum usuário" message={isDesktop ? 'Use o botão "Novo usuário" para criar.' : 'Toque em + para criar.'} />}
          renderItem={({ item }) => (
            <Card onPress={() => openEdit(item)}>
              <View style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.full_name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.full_name}{item.id === me?.id ? ' (você)' : ''}</Text>
                  <Text style={styles.email}>{item.email}</Text>
                  <Text style={styles.role}>{roleLabel[item.role]}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: item.active ? '#DCFCE7' : '#FEE2E2' }]}>
                  <Text style={[styles.badgeText, { color: item.active ? '#166534' : '#991B1B' }]}>
                    {item.active ? 'Ativo' : 'Inativo'}
                  </Text>
                </View>
              </View>
            </Card>
          )}
        />
      )}

      {/* No site a ação vive no cabeçalho, junto do título. */}
      {!isDesktop && (
        <Pressable style={styles.fab} onPress={openNew} accessibilityLabel="Novo usuário">
          <Ionicons name="person-add" size={26} color={colors.white} />
        </Pressable>
      )}

      <Modal
        visible={modal}
        transparent
        animationType={isDesktop ? 'fade' : 'slide'}
        onRequestClose={() => setModal(false)}
      >
        <KeyboardAvoidingView
          style={isDesktop ? webStyles.backdrop : styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={isDesktop ? webStyles.dialog : styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{editing ? 'Editar usuário' : 'Novo usuário'}</Text>
              <Pressable onPress={() => setModal(false)} hitSlop={10}>
                <Ionicons name="close" size={26} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Input label="Nome completo" value={fullName} onChangeText={setFullName} error={errors.fullName} />
              <Input
                label="E-mail"
                value={email}
                onChangeText={setEmail}
                editable={!editing}
                autoCapitalize="none"
                keyboardType="email-address"
                error={errors.email}
                hint={editing ? 'O e-mail não pode ser alterado.' : undefined}
              />
              {!editing && (
                <Input
                  label="Senha provisória"
                  value={password}
                  onChangeText={setPassword}
                  isPassword
                  error={errors.password}
                  hint="Mínimo de 6 caracteres."
                />
              )}
              <Select label="Perfil" options={roleOptions} value={role} onChange={(v) => setRole(v as Role)} />
              {editing && (
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Usuário ativo</Text>
                  <Switch
                    value={active}
                    onValueChange={setActive}
                    trackColor={{ true: colors.greenLight, false: colors.grayMedium }}
                    thumbColor={active ? colors.green : colors.gray}
                  />
                </View>
              )}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 42, height: 42, borderRadius: radius.full,
    backgroundColor: colors.brand[50], borderWidth: 1, borderColor: colors.greenLine,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.brand[700], fontSize: 17, fontWeight: '700' },
  name: { fontSize: 15, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  email: { color: colors.textMuted, fontSize: 12.5, marginTop: 1 },
  role: { color: colors.brand[600], fontSize: 11.5, fontWeight: '700', marginTop: 3, letterSpacing: 0.2 },
  badge: { borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: 'transparent' },
  badgeText: { fontSize: 11.5, fontWeight: '700' },
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
