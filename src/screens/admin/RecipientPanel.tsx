import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import Clock from 'lucide-react-native/icons/clock';
import ExternalLink from 'lucide-react-native/icons/external-link';
import Flame from 'lucide-react-native/icons/flame';
import Globe from 'lucide-react-native/icons/globe';
import Layers from 'lucide-react-native/icons/layers';
import MapPin from 'lucide-react-native/icons/map-pin';
import Package from 'lucide-react-native/icons/package';
import Phone from 'lucide-react-native/icons/phone';
import Recycle from 'lucide-react-native/icons/recycle';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import Trash from 'lucide-react-native/icons/trash';
import User from 'lucide-react-native/icons/user';
import X from 'lucide-react-native/icons/x';
import { Button, ConfirmModal, Input, Loading, Select } from '@/components';
import { Timeline } from '@/components/Operations';
import {
  AuditEntry, listRecipientHistory, RecipientUsage, saveRecipient, setRecipientActive,
} from '@/services/masters';
import { colors, radius, transition } from '@/theme';
import { showAlert } from '@/utils/alert';
import { formatDate, formatDateTime, formatDocument, formatNumber, formatWeightShort } from '@/utils/format';
import { ColumnCheck, missingColumns, onlyExisting } from '@/utils/columns';
import { Recipient } from '@/types';

/**
 * Tipos de destinação.
 *
 * Lista fechada: escrito à mão, "Aterro Sanitário" e "aterro sanitario"
 * viram dois tipos e a coluna deixa de agrupar. Um tipo já gravado fora da
 * lista continua selecionável.
 */
export const RECIPIENT_TYPES = [
  'Reciclagem',
  'Coprocessamento',
  'Aterro Sanitário',
  'Tratamento',
  'Logística Reversa',
  'Reutilização',
  'Outro',
];

/**
 * O tipo que representa disposição final.
 *
 * `is_landfill` decide o que o painel conta como aterro; deixá-lo como um
 * segundo interruptor ao lado do tipo permitiria um "Aterro Sanitário" que
 * não é aterro. Então ele é derivado daqui.
 */
export const LANDFILL_TYPE = 'Aterro Sanitário';

const TYPE_ICON: Record<string, React.ComponentType<any>> = {
  'Reciclagem': Recycle,
  'Coprocessamento': Flame,
  'Aterro Sanitário': Layers,
  'Tratamento': RefreshCw,
  'Logística Reversa': RefreshCw,
  'Reutilização': RefreshCw,
};

export function typeIcon(type?: string | null) {
  return (type && TYPE_ICON[type]) || Package;
}

const STATUS_OPTIONS = [
  { label: 'Ativo', value: 'active' },
  { label: 'Pendente', value: 'pending' },
  { label: 'Inativo', value: 'inactive' },
];

/** Cores de cada situação — três estados, não dois. */
export const STATUS_LOOK: Record<string, { label: string; bg: string; fg: string }> = {
  active: { label: 'Ativo', bg: '#EEF8F1', fg: '#15803D' },
  pending: { label: 'Pendente', bg: '#FDF4E3', fg: '#B0700F' },
  inactive: { label: 'Inativo', bg: '#FDEBEC', fg: '#C0272D' },
};

/**
 * Situação de um destinatário.
 *
 * Num banco sem a migração 0014 não há `status`, e a única informação
 * disponível é o booleano: aí "ativo" e "inativo" são tudo o que se pode
 * afirmar — "pendente" não seria dedução, seria invenção.
 */
export function recipientStatus(r: Recipient): 'active' | 'pending' | 'inactive' {
  if (r.status === 'active' || r.status === 'pending' || r.status === 'inactive') return r.status;
  return r.active ? 'active' : 'inactive';
}

const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

const NOTES_LIMIT = 500;

/** Campos que só existem depois da migração 0014 — ver o aviso do topo. */
const EXTENDED_COLUMNS = [
  'type', 'contact_name', 'city', 'state', 'postal_code', 'street', 'neighborhood',
  'website', 'license_number', 'license_url', 'status', 'notes',
];

/** Rótulo de cada campo no histórico — o log guarda o nome da coluna. */
const FIELD_LABELS: Record<string, string> = {
  name: 'Nome do destinatário',
  type: 'Tipo de destinatário',
  document: 'CNPJ',
  contact_name: 'Responsável',
  email: 'E-mail',
  phone: 'Telefone',
  city: 'Cidade',
  state: 'Estado',
  postal_code: 'CEP',
  street: 'Logradouro',
  neighborhood: 'Bairro',
  website: 'Site',
  license_number: 'Licença ambiental',
  license_url: 'Documento da licença',
  status: 'Situação',
  is_landfill: 'Disposição final',
  notes: 'Observações',
  active: 'Situação',
};

const ACTION_LABELS: Record<string, string> = {
  create_recipient: 'Destinatário cadastrado',
  update_recipient: 'Cadastro alterado',
};

type Tab = 'details' | 'contact' | 'history';

/**
 * Painel lateral de destinatário: detalhes, contato e histórico.
 *
 * Mesmo desenho dos demais painéis de cadastro. A aba Contato guarda o
 * endereço e o site — o que o e-mail e o telefone de Detalhes não dizem e que
 * um documento de transporte exige: para onde o resíduo vai.
 */
export function RecipientPanel({ recipient, usage, can, onClose, onSaved, actorId }: {
  /** `null` abre em modo de criação. */
  recipient: Recipient | null;
  usage?: RecipientUsage;
  /** A coluna de cada campo existe no banco? (migração 0014) */
  can: ColumnCheck;
  onClose: () => void;
  onSaved: () => void;
  /** Quem está salvando — vai para o histórico. */
  actorId?: string | null;
}) {
  const creating = !recipient;
  const [tab, setTab] = useState<Tab>('details');
  const [name, setName] = useState(recipient?.name ?? '');
  const [type, setType] = useState(recipient?.type ?? '');
  const [document, setDocument] = useState(formatDocument(recipient?.document));
  const [contactName, setContactName] = useState(recipient?.contact_name ?? '');
  const [email, setEmail] = useState(recipient?.email ?? '');
  const [phone, setPhone] = useState(recipient?.phone ?? '');
  const [city, setCity] = useState(recipient?.city ?? '');
  const [uf, setUf] = useState(recipient?.state ?? '');
  const [license, setLicense] = useState(recipient?.license_number ?? '');
  const [licenseUrl, setLicenseUrl] = useState(recipient?.license_url ?? '');
  const [status, setStatus] = useState(recipient ? recipientStatus(recipient) : 'active');
  const [postalCode, setPostalCode] = useState(recipient?.postal_code ?? '');
  const [street, setStreet] = useState(recipient?.street ?? '');
  const [neighborhood, setNeighborhood] = useState(recipient?.neighborhood ?? '');
  const [website, setWebsite] = useState(recipient?.website ?? '');
  const [notes, setNotes] = useState(recipient?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [busyOff, setBusyOff] = useState(false);

  const [history, setHistory] = useState<AuditEntry[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!recipient) return;
    try {
      setHistory(await listRecipientHistory(recipient.id));
    } catch (e: any) {
      setHistoryError(e?.message ?? 'Falha ao carregar o histórico.');
      setHistory([]);
    }
  }, [recipient]);

  useEffect(() => {
    if (tab === 'history' && history === null) loadHistory();
  }, [tab, history, loadHistory]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Informe o nome do destinatário.';
    const digits = document.replace(/\D/g, '');
    if (digits && digits.length !== 14 && digits.length !== 11) {
      e.document = 'Informe um CNPJ (14 dígitos) ou CPF (11 dígitos).';
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'E-mail inválido.';
    if (licenseUrl.trim() && !/^https?:\/\//i.test(licenseUrl.trim())) {
      e.licenseUrl = 'O endereço precisa começar com http:// ou https://';
    }
    if (website.trim() && !/^https?:\/\//i.test(website.trim())) {
      e.website = 'O endereço precisa começar com http:// ou https://';
    }
    if (notes.length > NOTES_LIMIT) e.notes = `Máximo de ${NOTES_LIMIT} caracteres.`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const base: Partial<Recipient> = {
        ...(creating ? {} : { id: recipient!.id }),
        name: name.trim(),
        // Grava só os dígitos: o campo mostra o documento pontuado, mas
        // guardar a pontuação faria o mesmo CNPJ existir em duas formas.
        document: document.replace(/\D/g, '') || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
      };
      // Cada campo entra no envio só se a coluna dele existir: uma coluna
      // inexistente faria o banco recusar a gravação inteira, inclusive os
      // campos que existem. Sem `status`, a situação volta a ser o booleano
      // de sempre — e aí é `active` que precisa ir.
      const patch: Partial<Recipient> = {
        ...base,
        ...onlyExisting({
          type: type || null,
          contact_name: contactName.trim() || null,
          city: city.trim() || null,
          state: uf || null,
          postal_code: postalCode.trim() || null,
          street: street.trim() || null,
          neighborhood: neighborhood.trim() || null,
          website: website.trim() || null,
          license_number: license.trim() || null,
          license_url: licenseUrl.trim() || null,
          status,
          is_landfill: type === LANDFILL_TYPE,
          notes: notes.trim() || null,
        }, can),
        ...(can('status') ? {} : { active: status === 'active' }),
      };
      await saveRecipient(patch, { id: actorId, previous: recipient });
      onSaved();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao salvar destinatário.');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    setBusyOff(true);
    try {
      await setRecipientActive(recipient!.id, false, can('status'));
      setConfirmOff(false);
      onSaved();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao desativar destinatário.');
    } finally {
      setBusyOff(false);
    }
  };

  const openLicense = async () => {
    const url = licenseUrl.trim();
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      showAlert('Não foi possível abrir', 'Confira o endereço do documento da licença.');
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ComponentType<any> }[] = [
    { key: 'details', label: 'Detalhes', icon: User },
    { key: 'contact', label: 'Contato', icon: Phone },
    { key: 'history', label: 'Histórico', icon: Clock },
  ];

  // Quais campos estão sem coluna — o aviso do topo fala em número.
  const locked = missingColumns(EXTENDED_COLUMNS, can);

  const typeOptions = [
    { label: 'Não informado', value: '' },
    ...(type && !RECIPIENT_TYPES.includes(type) ? [{ label: type, value: type }] : []),
    ...RECIPIENT_TYPES.map((t) => ({ label: t, value: t })),
  ];
  const ufOptions = [{ label: '—', value: '' }, ...UFS.map((u) => ({ label: u, value: u }))];
  const look = STATUS_LOOK[status];
  const TypeIcon = typeIcon(type);

  return (
    <View style={s.panel}>
      {/* ── Identificação ──────────────────────────────────────────── */}
      <View style={s.head}>
        <View style={s.headRow}>
          {creating ? (
            <View style={[s.avatar, s.avatarNew]}>
              <Package size={26} strokeWidth={2} color={colors.form.tileIcon} />
            </View>
          ) : (
            <View style={[s.avatar, { backgroundColor: colors.avatars[avatarIndex(recipient!.id)].bg }]}>
              <Text style={[s.avatarText, { color: colors.avatars[avatarIndex(recipient!.id)].fg }]}>
                {initials(recipient!.name)}
              </Text>
            </View>
          )}
          <View style={s.grow}>
            <View style={s.nameRow}>
              <Text style={s.name} numberOfLines={2}>{creating ? 'Novo destinatário' : recipient!.name}</Text>
              {!creating ? (
                <View style={[s.statusPill, { backgroundColor: STATUS_LOOK[recipientStatus(recipient!)].bg }]}>
                  <View style={[s.dot, { backgroundColor: STATUS_LOOK[recipientStatus(recipient!)].fg }]} />
                  <Text style={[s.statusText, { color: STATUS_LOOK[recipientStatus(recipient!)].fg }]}>
                    {STATUS_LOOK[recipientStatus(recipient!)].label}
                  </Text>
                </View>
              ) : null}
            </View>
            {creating ? (
              <Text style={s.sub}>Defina o destino e a licença que o autoriza</Text>
            ) : (
              <>
                <Text style={s.sub} numberOfLines={1}>
                  {recipient!.document ? `CNPJ ${formatDocument(recipient!.document)}` : 'Documento não informado'}
                </Text>
                <Text style={s.since}>Parceiro desde {formatDate(recipient!.created_at)}</Text>
              </>
            )}
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
                  {' '}Aplique a migração 0014 para liberá-los; o que está editável já é gravado
                  normalmente. Sem a coluna de situação, ela continua entre ativo e inativo.
                </Text>
              </View>
            ) : null}

            <View style={s.row}>
              <View style={s.cellWide}>
                <Input size="form" label="Nome do destinatário" required value={name} onChangeText={setName} error={errors.name} />
              </View>
              <View style={s.cell}>
                <Select
                  size="form"
                  label="Tipo de destinatário"
                  leftIconComponent={TypeIcon}
                  options={typeOptions}
                  value={type}
                  onChange={setType}
                  disabled={!can('type')}
                />
              </View>
            </View>

            <Input
              size="form"
              label="CNPJ"
              value={document}
              onChangeText={setDocument}
              onBlur={() => setDocument((v) => formatDocument(v) || v)}
              placeholder="00.000.000/0001-00"
              error={errors.document}
            />

            <Input
              size="form"
              label="Responsável"
              value={contactName}
              onChangeText={setContactName}
              editable={can('contact_name')}
              placeholder={can('contact_name') ? 'Quem atende pelo destinatário' : 'Após a migração 0014'}
            />

            <View style={s.row}>
              <View style={s.cell}>
                <Input
                  size="form"
                  label="E-mail"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  error={errors.email}
                  placeholder="contato@destinatario.com.br"
                />
              </View>
              <View style={s.cell}>
                <Input
                  size="form"
                  label="Telefone"
                  leftIconComponent={Phone}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="(00) 0000-0000"
                />
              </View>
            </View>

            <View style={s.row}>
              <View style={s.cellCity}>
                <Input
                  size="form"
                  label="Cidade"
                  value={city}
                  onChangeText={setCity}
                  editable={can('city')}
                  placeholder={can('city') ? 'Cidade do destino' : 'Após a migração 0014'}
                />
              </View>
              <View style={s.cellUf}>
                <Select size="form" label="Estado" options={ufOptions} value={uf} onChange={setUf} disabled={!can('state')} />
              </View>
            </View>

            <View style={s.row}>
              <View style={s.cellWide}>
                <Text style={s.fieldLabel}>Licença ambiental</Text>
                <View style={s.licenseRow}>
                  <View style={s.grow}>
                    <Input
                      size="form"
                      value={license}
                      onChangeText={setLicense}
                      editable={can('license_number')}
                      placeholder={can('license_number') ? 'SP-000000-0' : 'Após a migração 0014'}
                    />
                  </View>
                  {/* O botão só existe quando há um documento para abrir: um
                      botão que não leva a lugar nenhum é enfeite. */}
                  {licenseUrl.trim() ? (
                    <Pressable
                      onPress={openLicense}
                      accessibilityRole="link"
                      accessibilityLabel="Abrir o documento da licença"
                      style={({ hovered }: any) => [s.linkButton, transition(), hovered && s.linkButtonHover]}
                    >
                      <ExternalLink size={18} strokeWidth={2} color={colors.form.action} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
              <View style={s.cell}>
                <Select
                  size="form"
                  label="Situação"
                  leftIcon="ellipse"
                  leftIconColor={look.fg}
                  options={STATUS_OPTIONS}
                  value={status}
                  onChange={(v) => setStatus(v as typeof status)}
                />
              </View>
            </View>

            {can('license_url') ? (
              <Input
                size="form"
                label="Documento da licença (opcional)"
                value={licenseUrl}
                onChangeText={setLicenseUrl}
                autoCapitalize="none"
                placeholder="https://..."
                hint="Endereço do arquivo ou da consulta pública da licença."
                error={errors.licenseUrl}
              />
            ) : null}

            <View style={s.notesBlock}>
              <Input
                size="form"
                label="Observações (opcional)"
                placeholder={can('notes') ? 'O que este destinatário recebe, condições, restrições...' : 'Após a migração 0014'}
                value={notes}
                onChangeText={(v) => setNotes(v.slice(0, NOTES_LIMIT))}
                editable={can('notes')}
                multiline
                numberOfLines={3}
                style={s.notesInput}
                error={errors.notes}
              />
              {can('notes') ? <Text style={s.counter}>{notes.length}/{NOTES_LIMIT}</Text> : null}
            </View>
          </>
        ) : null}

        {tab === 'contact' && !creating ? (
          <View>
            <Text style={s.blockTitle}>Endereço do destino</Text>
            <Text style={s.blockHint}>
              É para cá que o resíduo vai. Cidade e estado ficam em Detalhes; aqui entra o
              endereço completo, que o documento de transporte exige.
            </Text>

            <View style={s.row}>
              <View style={s.cell}>
                <Input
                  size="form"
                  label="CEP"
                  value={postalCode}
                  onChangeText={setPostalCode}
                  editable={can('postal_code')}
                  placeholder={can('postal_code') ? '00000-000' : 'Após a migração 0014'}
                />
              </View>
              <View style={s.cell} />
            </View>
            <Input
              size="form"
              label="Logradouro"
              leftIconComponent={MapPin}
              value={street}
              onChangeText={setStreet}
              editable={can('street')}
              placeholder={can('street') ? 'Rua, avenida ou rodovia, com número' : 'Após a migração 0014'}
            />
            <Input
              size="form"
              label="Bairro"
              value={neighborhood}
              onChangeText={setNeighborhood}
              editable={can('neighborhood')}
              placeholder={can('neighborhood') ? 'Bairro ou distrito' : 'Após a migração 0014'}
            />
            <Input
              size="form"
              label="Site"
              leftIconComponent={Globe}
              value={website}
              onChangeText={setWebsite}
              autoCapitalize="none"
              editable={can('website')}
              placeholder={can('website') ? 'https://...' : 'Após a migração 0014'}
              error={errors.website}
            />

            <View style={s.contactBox}>
              <Text style={s.contactLabel}>Quem atende</Text>
              <Text style={s.contactValue}>{recipient!.contact_name || 'Responsável não informado'}</Text>
              <Text style={s.contactValue}>{recipient!.email || 'E-mail não informado'}</Text>
              <Text style={s.contactValue}>{recipient!.phone || 'Telefone não informado'}</Text>
              <Text style={s.contactHint}>Esses três campos ficam na aba Detalhes.</Text>
            </View>
          </View>
        ) : null}

        {tab === 'history' && !creating ? (
          <View>
            <Text style={s.blockTitle}>Uso em pesagens</Text>
            <View style={s.ruleRow}>
              <Text style={s.ruleLabel}>Pesagens para este destinatário</Text>
              <Text style={s.ruleValue}>{formatNumber(usage?.weighings ?? 0)}</Text>
            </View>
            <View style={s.ruleRow}>
              <Text style={s.ruleLabel}>Peso recebido</Text>
              <Text style={s.ruleValue}>{formatWeightShort(usage?.kg ?? 0)}</Text>
            </View>
            <View style={[s.ruleRow, s.ruleLast]}>
              <Text style={s.ruleLabel}>Neste mês</Text>
              <Text style={s.ruleValue}>
                {usage?.month
                  ? `${formatNumber(usage.month)} ${usage.month === 1 ? 'pesagem' : 'pesagens'}`
                  : 'Nenhuma pesagem'}
              </Text>
            </View>

            <Text style={[s.blockTitle, s.blockSpaced]}>Histórico do cadastro</Text>
            <Text style={s.blockHint}>
              {history && history.length > 0
                ? 'Cada alteração salva por aqui registra quais campos mudaram.'
                : 'Ainda não há alterações registradas. As próximas edições feitas neste painel entram aqui com os campos que mudaram.'}
            </Text>
            {historyError ? <Text style={s.historyError}>{historyError}</Text> : null}
            {history === null ? (
              <Loading />
            ) : (
              <Timeline
                events={[
                  ...(usage?.last
                    ? [{ label: 'Última pesagem recebida', date: formatDateTime(usage.last), detail: null }]
                    : []),
                  ...history.map((h) => ({
                    label: ACTION_LABELS[h.action] ?? h.action,
                    date: formatDateTime(h.created_at),
                    detail: changedFields(h),
                  })),
                  ...(can('updated_at') && recipient!.updated_at && history.length === 0
                    ? [{ label: 'Última alteração no cadastro', date: formatDateTime(recipient!.updated_at), detail: null }]
                    : []),
                  { label: 'Destinatário cadastrado', date: formatDateTime(recipient!.created_at), detail: null },
                ]}
              />
            )}
          </View>
        ) : null}
      </ScrollView>

      {/* ── Ações ──────────────────────────────────────────────────── */}
      <View style={s.actions}>
        {!creating && recipient!.active ? (
          <View style={s.cell}>
            <Button
              title="Desativar"
              variant="dangerOutline"
              iconComponent={Trash}
              onPress={() => setConfirmOff(true)}
              style={s.dangerButton}
            />
          </View>
        ) : null}
        <View style={s.cell}>
          <Button
            title={creating ? 'Criar destinatário' : 'Salvar alterações'}
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
        title="Desativar destinatário?"
        message={`${recipient?.name} deixa de aparecer na escolha de novas pesagens. As ${formatNumber(usage?.weighings ?? 0)} pesagens já enviadas para ele continuam nos relatórios.`}
        confirmLabel="Desativar"
        destructive
        loading={busyOff}
        onConfirm={deactivate}
        onCancel={() => setConfirmOff(false)}
      />
    </View>
  );
}

/** Quais campos a alteração mexeu. */
function changedFields(entry: AuditEntry): string | null {
  const keys = Object.keys(entry.new_data ?? {}).filter((k) => {
    if (!entry.old_data) return true;
    return JSON.stringify((entry.old_data as any)[k] ?? null) !== JSON.stringify((entry.new_data as any)[k] ?? null);
  });
  if (keys.length === 0) return null;
  // `is_landfill` e `active` acompanham outro campo; nomeá-los no histórico
  // faria parecer que duas coisas mudaram quando mudou uma.
  const labels = keys
    .filter((k) => k !== 'is_landfill' && k !== 'active')
    .map((k) => FIELD_LABELS[k] ?? k);
  return labels.length > 0 ? labels.join(', ') : null;
}

/** Iniciais das duas primeiras palavras: "Recicla Verde Ltda." → "RV". */
function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || '?';
}

/** Mesma cor de avatar da lista: derivada do destinatário, não da posição. */
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
  // 1.25 e nao 1.45: com o icone do tipo a esquerda, "Reciclagem" precisa de
  // mais que meia largura do painel para nao virar reticencias.
  cellWide: { flex: 1.25, minWidth: 0 },
  cellCity: { flex: 2.4, minWidth: 0 },
  cellUf: { flex: 1, minWidth: 0 },

  head: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 18 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarNew: { backgroundColor: colors.form.tile },
  avatarText: { fontSize: 20, fontWeight: '700' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  name: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.3, flexShrink: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  statusText: { fontSize: 12.5, fontWeight: '700' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  sub: { fontSize: 14, color: colors.form.muted, marginTop: 4 },
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

  warning: {
    backgroundColor: colors.form.infoBg,
    borderWidth: 1,
    borderColor: colors.form.infoBorder,
    borderRadius: 10,
    padding: 12,
    marginBottom: 18,
  },
  warningText: { fontSize: 12.5, lineHeight: 18, color: colors.form.infoText },

  // O rótulo fica fora do campo porque a linha tem o campo e o botão de abrir
  // o documento; dentro do `Input`, o rótulo empurraria o botão para baixo.
  fieldLabel: { fontSize: 16, fontWeight: '500', color: colors.form.label, marginBottom: 8 },
  licenseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  linkButton: {
    width: 50, height: 50, borderRadius: 8,
    borderWidth: 1, borderColor: colors.form.border,
    backgroundColor: colors.form.fieldBg,
    alignItems: 'center', justifyContent: 'center',
  },
  linkButtonHover: { borderColor: colors.form.action, backgroundColor: colors.white },

  notesBlock: { position: 'relative' },
  notesInput: { height: 88, paddingTop: 12, textAlignVertical: 'top' },
  counter: { position: 'absolute', right: 12, bottom: 30, fontSize: 12, color: colors.form.soft },

  blockTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  blockSpaced: { marginTop: 24 },
  blockHint: { fontSize: 13.5, lineHeight: 19, color: colors.form.muted, marginTop: 4, marginBottom: 16 },
  historyError: { fontSize: 13, color: colors.danger, marginBottom: 12 },

  ruleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.form.divider,
  },
  ruleLast: { borderBottomWidth: 0 },
  ruleLabel: { fontSize: 13.5, color: colors.form.muted, flexShrink: 1 },
  ruleValue: { fontSize: 14.5, fontWeight: '700', color: colors.text, textAlign: 'right' },

  contactBox: {
    backgroundColor: colors.form.infoBg,
    borderWidth: 1, borderColor: colors.form.infoBorder,
    borderRadius: 10, padding: 14, marginTop: 4,
  },
  contactLabel: { fontSize: 12.5, fontWeight: '700', color: colors.form.muted, marginBottom: 6 },
  contactValue: { fontSize: 13.5, color: colors.text, marginTop: 2 },
  contactHint: { fontSize: 12, color: colors.form.soft, marginTop: 8 },

  actions: {
    flexDirection: 'row', gap: 16,
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 22,
    borderTopWidth: 1, borderTopColor: colors.form.divider,
  },
  dangerButton: { minHeight: 50, borderRadius: 10 },
  saveButton: { minHeight: 50, borderRadius: 10 },
});
