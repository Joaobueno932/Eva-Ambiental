import React, { useCallback, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, EmptyState, Header, Input, Loading, Select } from '@/components';
import { colors, radius, spacing } from '@/theme';
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
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
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
      Alert.alert('Erro', e?.message ?? 'Falha ao carregar usuários.');
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
      if (!editing) Alert.alert('Sucesso', 'Usuário criado com segurança.');
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao salvar usuário.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Usuários" subtitle="Gestão de acessos" onBack={() => navigation.goBack()} />

      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState icon="people-outline" title="Nenhum usuário" message="Toque em + para criar." />}
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

      <Pressable style={styles.fab} onPress={openNew} accessibilityLabel="Novo usuário">
        <Ionicons name="person-add" size={26} color={colors.white} />
      </Pressable>

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.sheet}>
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
  container: { flex: 1, backgroundColor: colors.greenBg },
  list: { padding: spacing.lg, paddingBottom: 120 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: 20, fontWeight: '800' },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  email: { color: colors.grayText, fontSize: 13 },
  role: { color: colors.greenDark, fontSize: 12, fontWeight: '600', marginTop: 1 },
  badge: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
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
