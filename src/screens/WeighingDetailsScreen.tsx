import React, { useCallback, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { showAlert } from '@/utils/alert';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, ConfirmModal, Header, Loading, StatusBadge, Tag } from '@/components';
import { weighingEvents } from '@/utils/operations';
import { Timeline, SectionHeading } from '@/components/Operations';
import { colors, radius, spacing } from '@/theme';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { approveWeighing, cancelWeighing, getWeighing, rejectWeighing } from '@/services/weighings';
import { downloadWeighingPhotos, listWeighingPhotos } from '@/services/photos';
import { Weighing, WeighingPhoto } from '@/types';
import { WeighingsStackParamList } from '@/navigation/types';
import { formatDate, formatDateTime, formatTime, formatWeight } from '@/utils/format';

type Nav = NativeStackNavigationProp<WeighingsStackParamList, 'WeighingDetails'>;
type Rt = RouteProp<WeighingsStackParamList, 'WeighingDetails'>;

interface ViewProps {
  id: string;
  /** Fecha o detalhe: volta na pilha (tela) ou fecha o modal (site). */
  onClose: () => void;
  /** true quando o conteúdo está dentro de um modal, e não ocupando a tela. */
  embedded?: boolean;
}

/**
 * Conteúdo do detalhe de uma pesagem.
 *
 * Vive separado da tela porque no site ele também é aberto em modal, a partir
 * do cartão na listagem — lá trocar de página para ler um registro e voltar
 * perde o lugar na lista e os filtros aplicados.
 */
export function WeighingDetailsView({ id, onClose, embedded }: ViewProps) {
  const navigation = useNavigation<Nav>();
  const { profile } = useAuth();
  const { canApprove, canCancelWeighing, canEditWeighing } = usePermissions();

  const [weighing, setWeighing] = useState<Weighing | null>(null);
  const [photos, setPhotos] = useState<WeighingPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState<string | null>(null);

  const [showReject, setShowReject] = useState(false);
  const [showApprove, setShowApprove] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const [reason, setReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [acting, setActing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [w, ph] = await Promise.all([getWeighing(id), listWeighingPhotos(id)]);
      setWeighing(w);
      setPhotos(ph);
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao carregar pesagem.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onApprove = async () => {
    if (!profile) return;
    setActing(true);
    try {
      await approveWeighing(id, profile.id);
      setShowApprove(false);
      await load();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao aprovar.');
    } finally {
      setActing(false);
    }
  };

  const onReject = async () => {
    if (!profile) return;
    if (!reason.trim()) {
      showAlert('Motivo obrigatório', 'Informe o motivo da rejeição.');
      return;
    }
    setActing(true);
    try {
      await rejectWeighing(id, profile.id, reason.trim());
      setShowReject(false);
      setReason('');
      await load();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao rejeitar.');
    } finally {
      setActing(false);
    }
  };

  const onDownloadPhotos = async () => {
    if (downloading) return;
    if (photos.length === 0) {
      showAlert('Sem fotos', 'Esta pesagem não possui fotos para baixar.');
      return;
    }
    setDownloading(true);
    try {
      const result = await downloadWeighingPhotos(id);
      if (result === 'empty') {
        showAlert('Sem fotos', 'Esta pesagem não possui fotos para baixar.');
      } else if (result === 'unavailable') {
        showAlert('Indisponível', 'O compartilhamento de arquivos não está disponível neste dispositivo.');
      }
    } catch (e: any) {
      showAlert('Erro ao baixar fotos', e?.message ?? 'Verifique sua conexão e tente novamente.');
    } finally {
      setDownloading(false);
    }
  };

  const onCancel = async () => {
    if (!profile) return;
    if (!cancelReason.trim()) {
      showAlert('Motivo obrigatório', 'Informe o motivo do cancelamento.');
      return;
    }
    setActing(true);
    try {
      await cancelWeighing(id, profile.id, cancelReason.trim());
      setShowCancel(false);
      setCancelReason('');
      await load();
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Falha ao cancelar pesagem.');
    } finally {
      setActing(false);
    }
  };

  if (loading) return <Loading message="Carregando detalhes..." />;
  if (!weighing) {
    return (
      <View style={embedded ? styles.embedded : styles.container}>
        <DetailHeader embedded={embedded} onClose={onClose} />
        <Text style={styles.notFound}>Pesagem não encontrada.</Text>
      </View>
    );
  }

  const canEdit = canEditWeighing(weighing);
  const isPending = weighing.approval_status === 'pending';
  const isCanceled = !!weighing.canceled_at;

  const showActionsCard =
    (canEdit && !isCanceled) ||
    (canApprove && isPending && !isCanceled) ||
    (canCancelWeighing && !isCanceled);

  return (
    <View style={embedded ? styles.embedded : styles.container}>
      <DetailHeader embedded={embedded} onClose={onClose} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 12 }}>REGISTRO #{weighing.id.slice(0, 8).toUpperCase()}</Text>
          <Text style={[styles.weightValue, { marginBottom: 16 }]}>{formatWeight(weighing.weight_kg)}</Text>
          <View style={styles.headRow}>
            <Text style={styles.waste}>{weighing.waste_type?.name}</Text>
            <View style={styles.badgesRow}>
              {isCanceled
                ? <Tag label="Cancelada" color="#991B1B" bg="#FEE2E2" />
                : <StatusBadge status={weighing.approval_status} large />}
            </View>
          </View>

          <Info icon="business-outline" label="Cliente" value={weighing.client?.name} />
          <Info icon="location-outline" label="Unidade / Local" value={weighing.unit?.name} />
          <Info icon="calendar-outline" label="Data" value={formatDate(weighing.weighing_date)} />
          <Info icon="time-outline" label="Hora" value={formatTime(weighing.weighing_date)} />
          <Info icon="person-outline" label="Operador responsável" value={weighing.creator?.full_name} />
          <Info icon="cube-outline" label="Tipo de tratamento" value={weighing.treatment_type?.name} />
          <Info icon="navigate-outline" label="Destinatário" value={weighing.recipient?.name ?? 'Não informado'} />
          {weighing.notes ? <Info icon="document-text-outline" label="Observações" value={weighing.notes} /> : null}
        </Card>

        <Card>
          <SectionHeading title="Rastreabilidade" description="Eventos disponíveis neste registro." />
          <Timeline events={weighingEvents(weighing).map(event => ({ ...event, date: formatDateTime(event.date) }))} />
        </Card>
        {/* Cancelamento */}
        {isCanceled && (
          <Card>
            <Text style={styles.sectionTitle}>Cancelamento</Text>
            <View style={styles.cancelBox}>
              <Info icon="person-remove-outline" label="Cancelada por" value={weighing.canceler?.full_name ?? '-'} />
              <Info icon="calendar-outline" label="Data do cancelamento" value={formatDateTime(weighing.canceled_at!)} />
              <View style={styles.cancelReasonBox}>
                <Text style={styles.cancelReasonTitle}>Motivo do cancelamento</Text>
                <Text style={styles.cancelReasonText}>{weighing.cancellation_reason ?? '-'}</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Localização */}
        <Card>
          <Text style={styles.sectionTitle}>Localização</Text>
          <Info
            icon="image-outline"
            label="Origem da imagem"
            value={weighing.image_source === 'camera' ? 'Câmera' : weighing.image_source === 'upload' ? 'Anexo' : 'Sem foto'}
          />
          {weighing.location_formatted_address ? (
            <Info icon="map-outline" label="Endereço" value={weighing.location_formatted_address} />
          ) : null}
          {weighing.location_place_name ? (
            <Info icon="pin-outline" label="Local" value={weighing.location_place_name} />
          ) : null}
          {weighing.manual_location ? (
            <Info icon="navigate-outline" label="Localização manual" value={weighing.manual_location} />
          ) : null}
          {weighing.location_city || weighing.location_state ? (
            <Info
              icon="business-outline"
              label="Cidade / Estado"
              value={[weighing.location_city, weighing.location_state].filter(Boolean).join(' - ')}
            />
          ) : null}
          {weighing.location_postal_code ? (
            <Info icon="mail-outline" label="CEP" value={weighing.location_postal_code} />
          ) : null}
          <Info
            icon="locate-outline"
            label="Coordenadas"
            value={weighing.gps_lat != null ? `${weighing.gps_lat}, ${weighing.gps_lng}` : 'Não informadas'}
          />
          <Info
            icon="time-outline"
            label="Capturado em"
            value={weighing.captured_at ? formatDateTime(weighing.captured_at) : '-'}
          />
          {!weighing.location_formatted_address && weighing.gps_lat != null ? (
            <Text style={styles.locHint}>Coordenadas capturadas, mas o endereço não foi identificado.</Text>
          ) : null}
        </Card>

        {/* Dados gravimétricos */}
        <Card>
          <Text style={styles.sectionTitle}>Dados Gravimétricos</Text>
          <View style={styles.weightBox}>
            <Text style={styles.weightLabel}>Peso total</Text>
            <Text style={styles.weightValue}>{formatWeight(weighing.weight_kg)}</Text>
          </View>
          <View style={styles.measureRow}>
            <Text style={styles.measureLabel}>Medição 1</Text>
            <Text style={styles.measureValue}>{formatWeight(weighing.weight_kg)}</Text>
          </View>
          <View style={styles.measureRow}>
            <Text style={styles.measureLabel}>Fonte</Text>
            <Text style={styles.measureValue}>Manual</Text>
          </View>
        </Card>

        {/* Status de aprovação */}
        <Card>
          <Text style={styles.sectionTitle}>Status de Aprovação</Text>
          <Info icon="ribbon-outline" label="Status" value={undefined}>
            {isCanceled
              ? <Tag label="Cancelada" color="#991B1B" bg="#FEE2E2" />
              : <StatusBadge status={weighing.approval_status} />}
          </Info>
          {isCanceled ? (
            <>
              <Info icon="person-remove-outline" label="Cancelada por" value={weighing.canceler?.full_name ?? '-'} />
              <Info icon="calendar-outline" label="Data do cancelamento" value={formatDateTime(weighing.canceled_at!)} />
              {weighing.cancellation_reason ? (
                <View style={styles.cancelReasonBox}>
                  <Text style={styles.cancelReasonTitle}>Motivo do cancelamento</Text>
                  <Text style={styles.cancelReasonText}>{weighing.cancellation_reason}</Text>
                </View>
              ) : null}
            </>
          ) : (
            <>
              <Info icon="person-circle-outline" label="Aprovado/avaliado por" value={weighing.approver?.full_name ?? '-'} />
              <Info icon="calendar-outline" label="Data da avaliação" value={weighing.approved_at ? formatDateTime(weighing.approved_at) : '-'} />
              {weighing.approval_status === 'rejected' && (
                <View style={styles.rejection}>
                  <Text style={styles.rejectionTitle}>Motivo da rejeição</Text>
                  <Text style={styles.rejectionText}>{weighing.rejection_reason ?? '-'}</Text>
                </View>
              )}
            </>
          )}
        </Card>

        {/* Fotos */}
        <Card>
          <Text style={styles.sectionTitle}>Fotos da Pesagem ({photos.length})</Text>
          {photos.length === 0 ? (
            <Text style={styles.noPhotos}>Nenhuma foto anexada.</Text>
          ) : (
            <>
              <View style={styles.thumbs}>
                {photos.map((p) =>
                  p.public_url ? (
                    <Pressable key={p.id} onPress={() => setZoom(p.public_url!)}>
                      <Image source={{ uri: p.public_url }} style={styles.thumb} />
                      <View style={styles.thumbBadge}>
                        <Ionicons name={p.image_source === 'camera' ? 'camera' : 'image'} size={12} color={colors.white} />
                      </View>
                    </Pressable>
                  ) : null
                )}
              </View>
              <Button
                title={photos.length > 1 ? `Baixar fotos (${photos.length})` : 'Baixar foto'}
                icon="download-outline"
                variant="outline"
                loading={downloading}
                onPress={onDownloadPhotos}
                style={{ marginTop: spacing.md }}
              />
            </>
          )}
        </Card>

        {/* Ações */}
        {showActionsCard && (
          <Card>
            <Text style={styles.sectionTitle}>Decisão e controle do registro</Text>
            {canEdit && !isCanceled && (
              <Button
                title="Editar pesagem"
                icon="create-outline"
                variant="outline"
                onPress={() => {
                  // No modal, sair para o formulário sem fechar deixaria o
                  // detalhe sobreposto ao que o usuário vai editar.
                  if (embedded) onClose();
                  navigation.navigate('WeighingForm', { id: weighing.id });
                }}
                style={{ marginBottom: spacing.md }}
              />
            )}
            {canApprove && isPending && !isCanceled && (
              <>
                <Button title="Aprovar pesagem" icon="checkmark-circle" onPress={() => setShowApprove(true)} style={{ marginBottom: spacing.md }} />
                <Button title="Rejeitar pesagem" icon="close-circle" variant="danger" onPress={() => setShowReject(true)} style={{ marginBottom: spacing.md }} />
              </>
            )}
            {canCancelWeighing && !isCanceled && (
              <Button
                title="Cancelar pesagem"
                icon="ban-outline"
                variant="danger"
                onPress={() => setShowCancel(true)}
              />
            )}
          </Card>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* Zoom da foto */}
      <Modal visible={!!zoom} transparent animationType="fade" onRequestClose={() => setZoom(null)}>
        <Pressable style={styles.zoomBackdrop} onPress={() => setZoom(null)}>
          {zoom && <Image source={{ uri: zoom }} style={styles.zoomImage} resizeMode="contain" />}
          <View style={styles.zoomClose}>
            <Ionicons name="close" size={28} color={colors.white} />
          </View>
        </Pressable>
      </Modal>

      <ConfirmModal
        visible={showApprove}
        title="Aprovar pesagem"
        message="Confirmar a aprovação desta pesagem?"
        confirmLabel="Aprovar"
        loading={acting}
        onConfirm={onApprove}
        onCancel={() => setShowApprove(false)}
      />
      <ConfirmModal
        visible={showReject}
        title="Rejeitar pesagem"
        message="Informe o motivo da rejeição:"
        confirmLabel="Rejeitar"
        destructive
        loading={acting}
        withInput
        inputValue={reason}
        inputPlaceholder="Motivo da rejeição"
        onChangeInput={setReason}
        onConfirm={onReject}
        onCancel={() => {
          setShowReject(false);
          setReason('');
        }}
      />
      <ConfirmModal
        visible={showCancel}
        title="Cancelar pesagem"
        message="Informe o motivo do cancelamento. Essa ação ficará registrada para auditoria."
        confirmLabel="Confirmar cancelamento"
        cancelLabel="Cancelar ação"
        destructive
        loading={acting}
        withInput
        inputValue={cancelReason}
        inputPlaceholder="Motivo do cancelamento"
        onChangeInput={setCancelReason}
        onConfirm={onCancel}
        onCancel={() => {
          setShowCancel(false);
          setCancelReason('');
        }}
      />
    </View>
  );
}

/**
 * Cabeçalho do detalhe: o da tela (com voltar) ou o do modal (com fechar).
 */
function DetailHeader({ embedded, onClose }: { embedded?: boolean; onClose: () => void }) {
  if (!embedded) {
    return <Header title="Ficha de rastreabilidade" onBack={onClose} />;
  }
  return (
    <View style={styles.modalHeader}>
      <Text style={styles.modalTitle}>Ficha de rastreabilidade</Text>
      <Pressable
        onPress={onClose}
        accessibilityLabel="Fechar"
        accessibilityRole="button"
        style={({ hovered }: any) => [styles.modalClose, hovered && { backgroundColor: colors.surfaceAlt }]}
      >
        <Ionicons name="close" size={20} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

/** Tela de rota: o mesmo conteúdo, ocupando a página. */
export function WeighingDetailsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  return <WeighingDetailsView id={route.params.id} onClose={() => navigation.goBack()} />;
}

function Info({
  icon,
  label,
  value,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.info}>
      <Ionicons name={icon} size={18} color={colors.greenDark} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        {value != null ? <Text style={styles.infoValue}>{value}</Text> : children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  // Dentro do modal o conteúdo não ocupa a tela: a altura é limitada pelo
  // próprio modal, e o fundo é a superfície do diálogo.
  embedded: { flex: 1, minHeight: 0, backgroundColor: colors.pageBg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingLeft: spacing.xl,
    paddingRight: spacing.md,
    paddingVertical: spacing.md,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  modalClose: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { padding: spacing.lg },
  notFound: { textAlign: 'center', marginTop: spacing.xxl, color: colors.textMuted },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md, gap: spacing.sm },
  badgesRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 1 },
  waste: { fontSize: 21, fontWeight: '700', color: colors.text, flex: 1, letterSpacing: -0.5 },
  info: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  infoLabel: { fontSize: 11.5, color: colors.textMuted, fontWeight: '600' },
  infoValue: { fontSize: 14.5, color: colors.text, fontWeight: '600', marginTop: 2 },
  sectionTitle: { fontSize: 15.5, fontWeight: '700', color: colors.text, marginBottom: spacing.md, letterSpacing: -0.2 },
  locHint: { color: colors.textSoft, fontSize: 12, fontStyle: 'italic', marginTop: spacing.sm },
  // A massa é o número que se procura primeiro na ficha: fica num bloco
  // próprio, com traço da marca, e não numa linha igual às outras.
  weightBox: {
    backgroundColor: colors.brand[50],
    borderWidth: 1,
    borderColor: colors.greenLine,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  weightLabel: {
    color: colors.brand[600], fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  weightValue: { color: colors.brand[700], fontSize: 34, fontWeight: '700', marginTop: 6, letterSpacing: -1.2 },
  measureRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  measureLabel: { color: colors.textMuted, fontSize: 13.5 },
  measureValue: { color: colors.text, fontWeight: '600', fontSize: 13.5 },
  rejection: {
    backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.dangerBorder,
    borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm,
  },
  rejectionTitle: { color: colors.danger, fontWeight: '700', marginBottom: 4, fontSize: 13 },
  rejectionText: { color: colors.danger, fontSize: 13.5, lineHeight: 19 },
  cancelBox: { borderRadius: radius.md, overflow: 'hidden' },
  cancelReasonBox: {
    backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.dangerBorder,
    borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm,
  },
  cancelReasonTitle: { color: colors.danger, fontWeight: '700', marginBottom: 4, fontSize: 13 },
  cancelReasonText: { color: colors.danger, fontSize: 13.5, lineHeight: 19 },
  noPhotos: { color: colors.textSoft, fontStyle: 'italic', fontSize: 13 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumb: {
    width: 96, height: 96, borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border,
  },
  thumbBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(10,31,25,0.6)', borderRadius: radius.full, padding: 4 },
  zoomBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  zoomImage: { width: '100%', height: '80%' },
  zoomClose: { position: 'absolute', top: 50, right: 24 },
});
