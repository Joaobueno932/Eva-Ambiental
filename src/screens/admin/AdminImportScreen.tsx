import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Header, Loading } from '@/components';
import { colors, radius, spacing } from '@/theme';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import {
  pickXlsxFile,
  validateWeighingsFile,
  executeWeighingsImport,
  validateClientsFile,
  executeClientsImport,
  validateRecipientsFile,
  executeRecipientsImport,
  WeighingsValidation,
  ClientsParseResult,
  RecipientsParseResult,
} from '@/services/imports';
import {
  downloadWeighingsTemplate,
  downloadClientsTemplate,
  downloadRecipientsTemplate,
} from '@/utils/templates';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ImportType = 'weighings' | 'clients' | 'recipients';
type Status = 'idle' | 'parsing' | 'ready' | 'importing' | 'done';
type ParseResult = WeighingsValidation | ClientsParseResult | RecipientsParseResult;

// ─── Config dos tipos de importação ───────────────────────────────────────────

const IMPORT_TYPES: {
  id: ImportType;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
}[] = [
  {
    id: 'weighings',
    icon: 'scale-outline',
    title: 'Pesagens',
    desc: 'Importar registros de pesagem de resíduos',
  },
  {
    id: 'clients',
    icon: 'business-outline',
    title: 'Clientes e Unidades',
    desc: 'Importar clientes com suas unidades/localidades',
  },
  {
    id: 'recipients',
    icon: 'navigate-outline',
    title: 'Destinatários',
    desc: 'Importar destinatários de resíduos',
  },
];

// ─── Componente auxiliar: seção de aviso/bloqueio ─────────────────────────────

function MissingList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.missingBox}>
      <View style={styles.missingHeader}>
        <Ionicons name="warning-outline" size={18} color="#991B1B" />
        <Text style={styles.missingTitle}>{title}</Text>
      </View>
      {items.map((item) => (
        <Text key={item} style={styles.missingItem}>• {item}</Text>
      ))}
    </View>
  );
}

function InfoList({ title, items, color = colors.greenDark }: { title: string; items: string[]; color?: string }) {
  if (items.length === 0) return null;
  return (
    <View style={[styles.infoBox, { borderLeftColor: color }]}>
      <Text style={[styles.infoTitle, { color }]}>{title}</Text>
      {items.map((item) => (
        <Text key={item} style={styles.infoItem}>• {item}</Text>
      ))}
    </View>
  );
}

function SummaryRow({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, accent && styles.summaryAccent]}>{value}</Text>
    </View>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────

export function AdminImportScreen() {
  const navigation = useNavigation();
  const { profile } = useAuth();
  const { isAdmin } = usePermissions();

  const [importType, setImportType] = useState<ImportType>('weighings');
  const [status, setStatus] = useState<Status>('idle');
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [doneMessage, setDoneMessage] = useState('');
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  // Muda tipo e reseta estado
  const selectType = (type: ImportType) => {
    if (status === 'importing') return;
    setImportType(type);
    setStatus('idle');
    setFileName(null);
    setParseResult(null);
    setDoneMessage('');
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      if (importType === 'weighings') await downloadWeighingsTemplate();
      else if (importType === 'clients') await downloadClientsTemplate();
      else await downloadRecipientsTemplate();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível gerar o modelo.');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handlePickFile = async () => {
    const file = await pickXlsxFile();
    if (!file) return;

    setFileName(file.name);
    setStatus('parsing');
    setParseResult(null);
    setDoneMessage('');

    try {
      let result: ParseResult;
      if (importType === 'weighings') {
        result = await validateWeighingsFile(file.uri);
      } else if (importType === 'clients') {
        result = await validateClientsFile(file.uri);
      } else {
        result = await validateRecipientsFile(file.uri);
      }
      setParseResult(result);
      setStatus('ready');
    } catch (e: any) {
      setStatus('idle');
      setFileName(null);
      Alert.alert('Erro ao processar planilha', e?.message ?? 'Verifique se o arquivo é um .xlsx válido.');
    }
  };

  const handleConfirm = async () => {
    // Proteção contra duplo clique: só executa quando status é 'ready'
    if (!parseResult || !profile || status !== 'ready') return;
    setStatus('importing');
    try {
      if (importType === 'weighings') {
        const v = parseResult as WeighingsValidation;
        const count = await executeWeighingsImport(v, profile.id);
        setDoneMessage(`${count} pesagem(ns) importada(s) com sucesso.`);
      } else if (importType === 'clients') {
        const v = parseResult as ClientsParseResult;
        const r = await executeClientsImport(v);
        setDoneMessage(`${r.clients} cliente(s) e ${r.units} unidade(s) cadastrada(s).`);
      } else {
        const v = parseResult as RecipientsParseResult;
        const count = await executeRecipientsImport(v);
        setDoneMessage(`${count} destinatário(s) cadastrado(s) com sucesso.`);
      }
      setStatus('done');
      setParseResult(null);
      setFileName(null);
    } catch (e: any) {
      setStatus('ready');
      Alert.alert('Erro na importação', e?.message ?? 'Tente novamente.');
    }
  };

  // ── Renderiza o resumo da validação ──

  const renderValidationSummary = () => {
    if (!parseResult || status !== 'ready') return null;

    if (importType === 'weighings') {
      const v = parseResult as WeighingsValidation;
      const blocked = !v.canImport;

      return (
        <Card>
          <Text style={styles.sectionTitle}>Resultado da análise</Text>

          <SummaryRow label="Linhas na planilha" value={v.totalRows} />
          <SummaryRow label="Registros válidos" value={v.validRows.length} accent={v.validRows.length > 0} />
          {v.parseErrors.length > 0 && (
            <SummaryRow label="Linhas com erro de formato" value={v.parseErrors.length} />
          )}

          {v.newWasteTypes.length > 0 && (
            <InfoList
              title={`${v.newWasteTypes.length} novo(s) tipo(s) de resíduo serão criados automaticamente:`}
              items={v.newWasteTypes}
              color={colors.greenDark}
            />
          )}
          {v.newTreatmentTypes.length > 0 && (
            <InfoList
              title={`${v.newTreatmentTypes.length} novo(s) tipo(s) de tratamento serão criados automaticamente:`}
              items={v.newTreatmentTypes}
              color="#2563EB"
            />
          )}

          {blocked && (
            <View style={styles.blockBanner}>
              <Ionicons name="close-circle" size={20} color="#991B1B" />
              <Text style={styles.blockText}>
                Importação bloqueada. Cadastre os itens abaixo antes de continuar.
              </Text>
            </View>
          )}

          <MissingList title="Clientes não cadastrados:" items={v.missingClients} />
          <MissingList title="Unidades não cadastradas:" items={v.missingUnits} />
          <MissingList title="Destinatários não cadastrados:" items={v.missingRecipients} />

          {v.parseErrors.length > 0 && (
            <View style={styles.errorsBox}>
              <Text style={styles.errorsTitle}>Erros de formato (linhas ignoradas):</Text>
              {v.parseErrors.map((e, i) => (
                <Text key={i} style={styles.errorsItem}>{e}</Text>
              ))}
            </View>
          )}
        </Card>
      );
    }

    if (importType === 'clients') {
      const v = parseResult as ClientsParseResult;
      const p = v.preview;
      return (
        <Card>
          <Text style={styles.sectionTitle}>Resultado da análise</Text>
          <SummaryRow label="Linhas na planilha" value={p.totalRows} />
          <SummaryRow label="Novos clientes a criar" value={p.newClients.length} accent={p.newClients.length > 0} />
          <SummaryRow label="Clientes já existentes (serão mantidos)" value={p.existingClients.length} />
          <SummaryRow label="Novas unidades a criar" value={p.newUnits} accent={p.newUnits > 0} />
          <SummaryRow label="Unidades já existentes" value={p.existingUnits} />

          {p.newClients.length > 0 && (
            <InfoList title="Novos clientes:" items={p.newClients} color={colors.greenDark} />
          )}
          {p.existingClients.length > 0 && (
            <InfoList title="Clientes já cadastrados (sem alteração):" items={p.existingClients} color={colors.grayText} />
          )}
        </Card>
      );
    }

    // recipients
    const v = parseResult as RecipientsParseResult;
    const p = v.preview;
    return (
      <Card>
        <Text style={styles.sectionTitle}>Resultado da análise</Text>
        <SummaryRow label="Linhas na planilha" value={p.totalRows} />
        <SummaryRow label="Novos destinatários a criar" value={p.newRecipients.length} accent={p.newRecipients.length > 0} />
        <SummaryRow label="Destinatários já existentes" value={p.existingRecipients.length} />

        {p.newRecipients.length > 0 && (
          <InfoList title="Novos destinatários:" items={p.newRecipients} color={colors.greenDark} />
        )}
        {p.existingRecipients.length > 0 && (
          <InfoList title="Já cadastrados (sem alteração):" items={p.existingRecipients} color={colors.grayText} />
        )}
      </Card>
    );
  };

  // ── Verifica se pode confirmar ──

  const canConfirm = (() => {
    if (!parseResult || status !== 'ready') return false;
    if (importType === 'weighings') return (parseResult as WeighingsValidation).canImport;
    if (importType === 'clients') return (parseResult as ClientsParseResult).preview.newClients.length > 0 || (parseResult as ClientsParseResult).preview.newUnits > 0;
    if (importType === 'recipients') return (parseResult as RecipientsParseResult).preview.newRecipients.length > 0;
    return false;
  })();

  // Guard de admin: bloqueia o acesso na camada de UI mesmo se o usuário navegar diretamente.
  // A verificação definitiva ocorre em assertAdmin() dentro de cada função execute no serviço.
  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <Header title="Importação" onBack={() => navigation.goBack()} />
        <View style={styles.denied}>
          <Ionicons name="lock-closed-outline" size={52} color={colors.grayText} />
          <Text style={styles.deniedTitle}>Acesso restrito</Text>
          <Text style={styles.deniedMsg}>
            A importação de dados via planilha está disponível somente para administradores.
          </Text>
        </View>
      </View>
    );
  }

  if (status === 'parsing' || status === 'importing') {
    return (
      <View style={styles.container}>
        <Header title="Importação" onBack={() => navigation.goBack()} />
        <Loading message={status === 'parsing' ? 'Analisando planilha...' : 'Importando dados...'} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Importação de Dados" subtitle="Somente administradores" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── Tipo de importação ── */}
        <Card>
          <Text style={styles.sectionTitle}>1. Tipo de importação</Text>
          {IMPORT_TYPES.map((item) => {
            const active = importType === item.id;
            return (
              <Pressable
                key={item.id}
                style={[styles.typeCard, active && styles.typeCardActive]}
                onPress={() => selectType(item.id)}
              >
                <View style={[styles.typeIcon, active && styles.typeIconActive]}>
                  <Ionicons name={item.icon} size={22} color={active ? colors.white : colors.greenDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.typeTitle, active && styles.typeTitleActive]}>{item.title}</Text>
                  <Text style={styles.typeDesc}>{item.desc}</Text>
                </View>
                {active && <Ionicons name="checkmark-circle" size={22} color={colors.green} />}
              </Pressable>
            );
          })}
        </Card>

        {/* ── Download do modelo ── */}
        <Card>
          <Text style={styles.sectionTitle}>2. Baixar modelo de planilha</Text>
          <Text style={styles.hintText}>
            Use a planilha modelo para garantir que os dados estejam no formato correto.
          </Text>
          <Button
            title="Baixar modelo .xlsx"
            icon="download-outline"
            variant="outline"
            onPress={handleDownloadTemplate}
            loading={downloadingTemplate}
          />
        </Card>

        {/* ── Selecionar arquivo ── */}
        <Card>
          <Text style={styles.sectionTitle}>3. Selecionar planilha</Text>
          {fileName ? (
            <View style={styles.fileRow}>
              <Ionicons name="document-outline" size={22} color={colors.green} />
              <Text style={styles.fileName} numberOfLines={2}>{fileName}</Text>
              <Pressable onPress={() => { setFileName(null); setParseResult(null); setStatus('idle'); }}>
                <Ionicons name="close-circle" size={22} color={colors.grayText} />
              </Pressable>
            </View>
          ) : (
            <Text style={styles.hintText}>
              Selecione um arquivo .xlsx do seu dispositivo.
            </Text>
          )}
          <Button
            title={fileName ? 'Trocar arquivo' : 'Selecionar arquivo .xlsx'}
            icon="folder-open-outline"
            variant={fileName ? 'outline' : 'primary'}
            onPress={handlePickFile}
            style={{ marginTop: fileName ? spacing.sm : 0 }}
          />
        </Card>

        {/* ── Resultado da análise ── */}
        {status === 'ready' && renderValidationSummary()}

        {/* ── Sucesso ── */}
        {status === 'done' && (
          <Card>
            <View style={styles.doneBox}>
              <Ionicons name="checkmark-circle" size={48} color={colors.green} />
              <Text style={styles.doneTitle}>Importação concluída!</Text>
              <Text style={styles.doneMsg}>{doneMessage}</Text>
            </View>
            <Button
              title="Nova importação"
              icon="refresh-outline"
              variant="outline"
              onPress={() => {
                setStatus('idle');
                setFileName(null);
                setParseResult(null);
                setDoneMessage('');
              }}
            />
          </Card>
        )}

        {/* ── Botão de confirmação ── */}
        {canConfirm && (
          <Button
            title="Confirmar importação"
            icon="cloud-upload-outline"
            onPress={handleConfirm}
          />
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.greenBg },
  scroll: { padding: spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  hintText: { color: colors.grayText, fontSize: 13, marginBottom: spacing.md, lineHeight: 18 },

  // Tipo
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginBottom: spacing.sm,
    backgroundColor: colors.greenBg,
  },
  typeCardActive: {
    borderColor: colors.green,
    backgroundColor: '#F0FBE8',
  },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.greenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconActive: { backgroundColor: colors.green },
  typeTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  typeTitleActive: { color: colors.greenDark },
  typeDesc: { fontSize: 12, color: colors.grayText, marginTop: 2 },

  // Arquivo selecionado
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.greenBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  fileName: { flex: 1, fontSize: 13, color: colors.greenDark, fontWeight: '600' },

  // Resumo
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray,
  },
  summaryLabel: { fontSize: 13, color: colors.grayText },
  summaryValue: { fontSize: 13, fontWeight: '700', color: colors.text },
  summaryAccent: { color: colors.greenDark },

  // Info box (novos tipos auto-criados)
  infoBox: {
    borderLeftWidth: 3,
    borderLeftColor: colors.green,
    paddingLeft: spacing.md,
    marginTop: spacing.md,
  },
  infoTitle: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  infoItem: { fontSize: 12, color: colors.text, paddingVertical: 1 },

  // Bloqueio
  blockBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#FEE2E2',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  blockText: { flex: 1, color: '#991B1B', fontSize: 13, fontWeight: '600' },

  // Faltando (erro crítico)
  missingBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  missingHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  missingTitle: { fontSize: 13, fontWeight: '700', color: '#991B1B' },
  missingItem: { fontSize: 12, color: '#991B1B', paddingVertical: 2 },

  // Erros de formato
  errorsBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  errorsTitle: { fontSize: 12, fontWeight: '700', color: '#92400E', marginBottom: 4 },
  errorsItem: { fontSize: 12, color: '#92400E', paddingVertical: 1 },

  // Done
  doneBox: { alignItems: 'center', paddingVertical: spacing.xl },
  doneTitle: { fontSize: 20, fontWeight: '800', color: colors.greenDark, marginTop: spacing.md },
  doneMsg: { color: colors.grayText, fontSize: 14, marginTop: spacing.sm, textAlign: 'center' },

  // Acesso negado
  denied: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  deniedTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: spacing.lg },
  deniedMsg: { color: colors.grayText, fontSize: 14, marginTop: spacing.sm, textAlign: 'center', lineHeight: 20 },
});
