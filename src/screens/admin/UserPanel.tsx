import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import Calendar from 'lucide-react-native/icons/calendar';
import Clock from 'lucide-react-native/icons/clock';
import Crown from 'lucide-react-native/icons/crown';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import Trash from 'lucide-react-native/icons/trash';
import User from 'lucide-react-native/icons/user';
import X from 'lucide-react-native/icons/x';
import { Button, ConfirmModal, Input, Select } from '@/components';
import { Timeline } from '@/components/Operations';
import { permissionsForRole } from '@/hooks/usePermissions';
import { createUser, setUserActive, updateUser } from '@/services/users';
import { colors, radius, transition } from '@/theme';
import { showAlert } from '@/utils/alert';
import {
  formatAccess, formatBrDate, formatDate, formatDateTime, isValidCpf, maskCpf, maskDate,
  minutesSince, parseBrDate, roleLabel,
} from '@/utils/format';
import { ColumnCheck, missingColumns, onlyExisting } from '@/utils/columns';
import { Profile, Role } from '@/types';

const ROLE_OPTIONS = [
  { label: 'Administrador', value: 'admin' },
  { label: 'Analista', value: 'analyst' },
  { label: 'Operador', value: 'operator' },
  { label: 'Visualizador', value: 'viewer' },
];
const STATUS_OPTIONS = [
  { label: 'Ativo', value: 'active' },
  { label: 'Inativo', value: 'inactive' },
];

const NOTES_LIMIT = 500;

/**
 * Campos que dependem de migração: observações (0008), CPF e data de
 * nascimento (0015). O aviso do topo conta quantos estão esperando coluna.
 */
const EXTENDED_COLUMNS = ['notes', 'cpf', 'birth_date'];
/** Tempo desde o login em que "entrou agora" ainda é verdade. */
const JUST_IN_MINUTES = 15;

type Tab = 'details' | 'permissions' | 'history';

/** O que cada perfil pode fazer, lido das mesmas regras que o app aplica. */
function abilities(role: Role) {
  const p = permissionsForRole(role);
  return [
    { label: 'Registrar pesagens', allowed: p.canCreateWeighing },
    { label: 'Aprovar e rejeitar pesagens', allowed: p.canApprove },
    { label: 'Cancelar pesagens', allowed: p.canCancelWeighing },
    {
      label: p.canEditAnyWeighing ? 'Editar qualquer pesagem' : 'Editar as próprias pesagens pendentes',
      allowed: p.canCreateWeighing,
    },
    { label: 'Gerenciar cadastros (clientes, unidades, tipos)', allowed: p.canManageMasters },
    { label: 'Gerenciar usuários e acessos', allowed: p.canManageUsers },
    { label: 'Gerar e exportar relatórios', allowed: p.canExportReports },
  ];
}

/**
 * Painel lateral de usuário: detalhes, permissões e histórico.
 *
 * Substitui o diálogo que cobria a tela: aqui a lista continua visível ao
 * lado, e dá para conferir uma conta contra as vizinhas enquanto se edita.
 * O mesmo painel cria e edita — o formulário é o mesmo, muda só o que ainda
 * não existe (senha provisória) e o que só existe depois (último acesso,
 * observações e a desativação).
 */
export function UserPanel({ user, isSelf, can, onClose, onSaved }: {
  /** `null` abre em modo de criação. */
  user: Profile | null;
  isSelf: boolean;
  /** A coluna de cada campo existe no banco? (migrações 0008 e 0015) */
  can: ColumnCheck;
  onClose: () => void;
  onSaved: () => void;
}) {
  const creating = !user;
  const [tab, setTab] = useState<Tab>('details');
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(user?.role ?? 'analyst');
  const [status, setStatus] = useState(user?.active === false ? 'inactive' : 'active');
  const [notes, setNotes] = useState(user?.notes ?? '');
  const [cpf, setCpf] = useState(maskCpf(user?.cpf ?? ''));
  const [birthDate, setBirthDate] = useState(formatBrDate(user?.birth_date));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [busyOff, setBusyOff] = useState(false);

  const access = formatAccess(user?.last_sign_in_at);
  const justIn = useMemo(() => {
    const m = minutesSince(user?.last_sign_in_at);
    return m !== null && m <= JUST_IN_MINUTES;
  }, [user?.last_sign_in_at]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = 'Informe o nome.';
    if (creating) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'E-mail inválido.';
      if (password.length < 6) e.password = 'Senha de no mínimo 6 caracteres.';
    }
    if (notes.length > NOTES_LIMIT) e.notes = `Máximo de ${NOTES_LIMIT} caracteres.`;
    // CPF e data são opcionais, mas errados não servem para nada: um CPF com
    // dígito verificador inválido não é de ninguém, e uma data de nascimento
    // no futuro é erro de digitação.
    if (cpf.replace(/\D/g, '') && !isValidCpf(cpf)) e.cpf = 'CPF inválido — confira os números.';
    if (birthDate.trim()) {
      const iso = parseBrDate(birthDate);
      if (!iso) e.birthDate = 'Use o formato DD/MM/AAAA.';
      else if (iso >= new Date().toISOString().slice(0, 10)) e.birthDate = 'A data precisa ser anterior a hoje.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (creating) {
        await createUser({ email: email.trim(), password, full_name: fullName.trim(), role });
        showAlert('Sucesso', 'Usuário criado com segurança.');
      } else {
        await updateUser(user!.id, {
          full_name: fullName.trim(),
          role,
          active: status === 'active',
          // Cada campo entra no envio só se a coluna dele existir: uma coluna
          // inexistente faria o banco recusar a gravação inteira.
          ...onlyExisting({
            notes: notes.trim() || null,
            cpf: cpf.replace(/\D/g, '') || null,
            birth_date: birthDate.trim() ? parseBrDate(birthDate) : null,
          }, can),
        });
      }
      onSaved();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao salvar usuário.');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    setBusyOff(true);
    try {
      await setUserActive(user!.id, false);
      setConfirmOff(false);
      onSaved();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao desativar usuário.');
    } finally {
      setBusyOff(false);
    }
  };

  // Quais campos estão sem coluna — o aviso do topo fala em número.
  const locked = missingColumns(EXTENDED_COLUMNS, can);

  const tabs: { key: Tab; label: string; icon: React.ComponentType<any> }[] = [
    { key: 'details', label: 'Detalhes', icon: User },
    { key: 'permissions', label: 'Permissões', icon: ShieldCheck },
    { key: 'history', label: 'Histórico', icon: Clock },
  ];

  return (
    <View style={s.panel}>
      {/* ── Identificação ──────────────────────────────────────────── */}
      <View style={s.head}>
        <View style={s.headRow}>
          {creating ? (
            <View style={[s.avatar, s.avatarNew]}>
              <User size={26} strokeWidth={2} color={colors.form.tileIcon} />
            </View>
          ) : (
            <View style={[s.avatar, { backgroundColor: colors.avatars[avatarIndex(user!.id)].bg }]}>
              <Text style={[s.avatarText, { color: colors.avatars[avatarIndex(user!.id)].fg }]}>{initials(user!.full_name)}</Text>
            </View>
          )}
          <View style={s.grow}>
            <View style={s.nameRow}>
              <Text style={s.name} numberOfLines={1}>{creating ? 'Novo usuário' : user!.full_name}</Text>
              {!creating ? (
                <View style={[s.statusPill, { backgroundColor: user!.active ? '#EEF8F1' : colors.surfaceSunken }]}>
                  <View style={[s.dot, { backgroundColor: user!.active ? colors.success : colors.textMuted }]} />
                  <Text style={[s.statusText, { color: user!.active ? colors.success : colors.textMuted }]}>
                    {user!.active ? 'Ativo' : 'Inativo'}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={s.email} numberOfLines={1}>{creating ? 'Defina os dados de acesso' : user!.email}</Text>
            {!creating && user!.created_at ? (
              <Text style={s.since}>Membro desde {formatDate(user!.created_at)}</Text>
            ) : null}
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fechar painel"
            style={({ hovered }: any) => [s.close, transition(), hovered && s.closeHover]}
          >
            <X size={20} strokeWidth={2} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      {/* ── Abas ───────────────────────────────────────────────────── */}
      {creating ? null : (
        <View style={s.tabs}>
          {tabs.map((t) => {
            const on = tab === t.key;
            const Icon = t.icon;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={({ hovered }: any) => [s.tab, on && s.tabOn, transition(), hovered && !on && s.tabHover]}
              >
                <Icon size={17} strokeWidth={2} color={on ? colors.text : colors.form.muted} />
                <Text style={[s.tabText, on && s.tabTextOn]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {tab === 'details' || creating ? (
          <>
            {locked.length > 0 ? (
              <View style={s.warning}>
                <Text style={s.warningText}>
                  {locked.length === 1
                    ? 'Um campo está desabilitado porque a coluna dele ainda não existe no banco.'
                    : `${locked.length} campos estão desabilitados porque as colunas deles ainda não existem no banco.`}
                  {' '}Aplique as migrações 0008 e 0015 para liberá-los; o que está editável já é
                  gravado normalmente.
                </Text>
              </View>
            ) : null}

            <Input size="form" label="Nome completo" value={fullName} onChangeText={setFullName} error={errors.fullName} />
            <Input
              size="form"
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              editable={creating}
              autoCapitalize="none"
              keyboardType="email-address"
              error={errors.email}
            />
            {creating ? (
              <Input
                size="form"
                label="Senha provisória"
                value={password}
                onChangeText={setPassword}
                isPassword
                error={errors.password}
                hint="Mínimo de 6 caracteres."
              />
            ) : null}

            {/* CPF e nascimento são do cadastro da pessoa, não do acesso: por
                isso ficam depois do e-mail e antes do perfil, que é o que
                define o que ela pode fazer. */}
            <View style={s.row}>
              <View style={s.cellWide}>
                <Input
                  size="form"
                  label="CPF"
                  value={cpf}
                  onChangeText={(v) => setCpf(maskCpf(v))}
                  editable={can('cpf')}
                  keyboardType="numeric"
                  placeholder={can('cpf') ? '000.000.000-00' : 'Após a migração 0015'}
                  error={errors.cpf}
                />
              </View>
              <View style={s.cell}>
                <Input
                  size="form"
                  label="Data de nascimento"
                  leftIconComponent={Calendar}
                  value={birthDate}
                  onChangeText={(v) => setBirthDate(maskDate(v))}
                  editable={can('birth_date')}
                  keyboardType="numeric"
                  placeholder={can('birth_date') ? 'DD/MM/AAAA' : 'Após a migração 0015'}
                  error={errors.birthDate}
                />
              </View>
            </View>
            <View style={s.row}>
              {/* "Administrador" é o rótulo mais longo dos dois campos e não
                  deve ser cortado: o perfil é o que define o que a pessoa faz. */}
              <View style={s.cellWide}>
                <Select
                  size="form"
                  label="Perfil de acesso"
                  leftIconComponent={Crown}
                  leftIconColor={colors.pendingRing}
                  options={ROLE_OPTIONS}
                  value={role}
                  onChange={(v) => setRole(v as Role)}
                />
              </View>
              {!creating ? (
                <View style={s.cell}>
                  <Select
                    size="form"
                    label="Situação"
                    leftIcon="ellipse"
                    leftIconColor={status === 'active' ? colors.success : colors.textMuted}
                    options={STATUS_OPTIONS}
                    value={status}
                    onChange={setStatus}
                    disabled={isSelf}
                  />
                </View>
              ) : null}
            </View>
            {isSelf && !creating ? (
              <Text style={s.selfHint}>Você não pode alterar a situação da própria conta.</Text>
            ) : null}

            {!creating ? (
              <View style={s.accessBox}>
                <View style={s.accessSeal}>
                  <Calendar size={22} strokeWidth={2} color={colors.form.tileIcon} />
                </View>
                <View style={s.grow}>
                  <Text style={s.accessLabel}>Último acesso</Text>
                  <Text style={s.accessValue}>{access ?? 'Nunca acessou'}</Text>
                </View>
                {justIn ? (
                  <View style={s.justIn}>
                    <View style={[s.dot, { backgroundColor: colors.success }]} />
                    <Text style={s.justInText}>Entrou agora</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {!creating ? (
              <View style={s.notesBlock}>
                <Input
                  size="form"
                  label="Observações (opcional)"
                  placeholder={can('notes') ? 'Adicione uma observação sobre este usuário...' : 'Disponível após a migração 0008.'}
                  value={notes}
                  onChangeText={(v) => setNotes(v.slice(0, NOTES_LIMIT))}
                  editable={can('notes')}
                  multiline
                  numberOfLines={3}
                  style={s.notesInput}
                  error={errors.notes}
                />
                {can('notes') ? (
                  <Text style={s.counter}>{notes.length}/{NOTES_LIMIT}</Text>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}

        {tab === 'permissions' && !creating ? (
          <View>
            <Text style={s.blockTitle}>O que o perfil {roleLabel[role]} pode fazer</Text>
            <Text style={s.blockHint}>
              As permissões vêm do perfil de acesso — mude o perfil na aba Detalhes para alterá-las.
            </Text>
            {abilities(role).map((a) => (
              <View key={a.label} style={s.ability}>
                <View style={[s.abilityMark, a.allowed ? s.abilityYes : s.abilityNo]}>
                  {a.allowed ? <Check size={13} strokeWidth={3} color={colors.success} /> : <X size={13} strokeWidth={3} color={colors.textMuted} />}
                </View>
                <Text style={[s.abilityText, !a.allowed && s.abilityTextOff]}>{a.label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {tab === 'history' && !creating ? (
          <View>
            <Text style={s.blockTitle}>Histórico da conta</Text>
            <Text style={s.blockHint}>
              O sistema registra a criação, a última alteração e o último acesso desta conta.
            </Text>
            <Timeline
              events={[
                ...(user!.last_sign_in_at
                  ? [{ label: 'Último acesso', date: formatDateTime(user!.last_sign_in_at), detail: null }]
                  : [{ label: 'Nunca acessou', date: '—', detail: 'A conta existe, mas ninguém entrou com ela ainda.' }]),
                { label: 'Última alteração no cadastro', date: formatDateTime(user!.updated_at), detail: null },
                { label: 'Conta criada', date: formatDateTime(user!.created_at), detail: null },
              ]}
            />
          </View>
        ) : null}
      </ScrollView>

      {/* ── Ações ──────────────────────────────────────────────────── */}
      <View style={s.actions}>
        {!creating && user!.active && !isSelf ? (
          <View style={s.cell}>
            <Button title="Desativar usuário" variant="dangerOutline" iconComponent={Trash} onPress={() => setConfirmOff(true)} style={s.dangerButton} />
          </View>
        ) : null}
        <View style={s.cell}>
          <Button
            title={creating ? 'Criar usuário' : 'Salvar alterações'}
            variant="deep"
            iconComponent={Check}
            loading={saving}
            onPress={save}
            style={s.saveButton}
          />
        </View>
      </View>

      <ConfirmModal
        visible={confirmOff}
        title="Desativar usuário?"
        message={`${user?.full_name} perde o acesso ao sistema na próxima vez que entrar. Os registros feitos por essa pessoa continuam intactos.`}
        confirmLabel="Desativar"
        destructive
        loading={busyOff}
        onConfirm={deactivate}
        onCancel={() => setConfirmOff(false)}
      />
    </View>
  );
}

/** Iniciais das duas primeiras palavras: "João Lucas" → "JL". */
function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || '?';
}

/** Mesma cor de avatar da lista: derivada da pessoa, não da posição. */
function avatarIndex(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % colors.avatars.length;
}

const s = StyleSheet.create({
  panel: { flex: 1, backgroundColor: colors.surface },
  grow: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', gap: 16 },
  cell: { flex: 1, minWidth: 0 },
  cellWide: { flex: 1.3, minWidth: 0 },

  warning: {
    backgroundColor: colors.form.infoBg,
    borderWidth: 1,
    borderColor: colors.form.infoBorder,
    borderRadius: 10,
    padding: 12,
    marginBottom: 18,
  },
  warningText: { fontSize: 12.5, lineHeight: 18, color: colors.form.infoText },

  head: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 18 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarNew: { backgroundColor: colors.form.tile },
  avatarText: { fontSize: 20, fontWeight: '700' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  name: { fontSize: 21, fontWeight: '700', color: colors.text, letterSpacing: -0.3, flexShrink: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  statusText: { fontSize: 12.5, fontWeight: '700' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  email: { fontSize: 14, color: colors.form.muted, marginTop: 4 },
  since: { fontSize: 13, color: colors.form.soft, marginTop: 2 },
  close: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  closeHover: { backgroundColor: colors.surfaceSunken },

  tabs: { flexDirection: 'row', paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: colors.form.divider },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 4, marginRight: 24, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabHover: { opacity: 0.75 },
  tabOn: { borderBottomColor: colors.form.action },
  tabText: { fontSize: 14.5, color: colors.form.muted },
  tabTextOn: { color: colors.text, fontWeight: '700' },

  body: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 },
  selfHint: { fontSize: 12.5, color: colors.form.soft, marginTop: -12, marginBottom: 18 },

  accessBox: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingVertical: 12, marginBottom: 20,
  },
  accessSeal: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.form.rowTile, alignItems: 'center', justifyContent: 'center' },
  accessLabel: { fontSize: 13.5, color: colors.form.muted },
  accessValue: { fontSize: 15.5, fontWeight: '600', color: colors.text, marginTop: 2 },
  justIn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E4F6EE', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  justInText: { fontSize: 12.5, fontWeight: '700', color: colors.success },

  notesBlock: { position: 'relative' },
  notesInput: { height: 96, paddingTop: 12, textAlignVertical: 'top' },
  counter: { position: 'absolute', right: 12, bottom: 30, fontSize: 12, color: colors.form.soft },

  blockTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  blockHint: { fontSize: 13.5, lineHeight: 19, color: colors.form.muted, marginTop: 4, marginBottom: 18 },
  ability: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  abilityMark: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  abilityYes: { backgroundColor: '#E4F6EE' },
  abilityNo: { backgroundColor: colors.surfaceSunken },
  abilityText: { flex: 1, fontSize: 14.5, color: colors.text },
  abilityTextOff: { color: colors.form.soft },

  actions: {
    flexDirection: 'row', gap: 16,
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 22,
    borderTopWidth: 1, borderTopColor: colors.form.divider,
  },
  dangerButton: { minHeight: 50, borderRadius: 10 },
  saveButton: { minHeight: 50, borderRadius: 10 },
});
