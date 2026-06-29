import React, { useCallback, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, ConfirmModal, Header, Loading, StatusBadge, Tag } from '@/components';
import { colors, radius, spacing } from '@/theme';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { approveWeighing, cancelWeighing, getWeighing, rejectWeighing } from '@/services/weighings';
import { listWeighingPhotos } from '@/services/photos';
import { Weighing, WeighingPhoto } from '@/types';
import { WeighingsStackParamList } from '@/navigation/types';
import { formatDate, formatDateTime, formatTime, formatWeight } from '@/utils/format';

type Nav = NativeStackNavigationProp<WeighingsStackParamList, 'WeighingDetails'>;
type Rt = RouteProp<WeighingsStackParamList, 'WeighingDetails'>;

export function WeighingDetailsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { id } = route.params;
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

  const load = useCallback(async () => {
    try {
      const [w, ph] = await Promise.all([getWeighing(id), listWeighingPhotos(id)]);
      setWeighing(w);
      setPhotos(ph);
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao carregar pesagem.');
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
      Alert.alert('Erro', e?.message ?? 'Falha ao aprovar.');
    } finally {
      setActing(false);
    }
  };

  const onReject = async () => {
    if (!profile) return;
    if (!reason.trim()) {
      Alert.alert('Motivo obrigatório', 'Informe o motivo da rejeição.');
      return;
    }
    setActing(true);
    try {
      await rejectWeighing(id, profile.id, reason.trim());
      setShowReject(false);
      setReason('');
      await load();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao rejeitar.');
    } finally {
      setActing(false);
    }
  };

  const onCancel = async () => {
    if (!profile) return;
    if (!cancelReason.trim()) {
      Alert.alert('Motivo obrigatório', 'Informe o motivo do cancelamento.');
      return;
    }
    setActing(true);
    try {
      await cancelWeighing(id, profile.id, cancelReason.trim());
      setShowCancel(false);
      setCancelReason('');
      await load();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao cancelar pesagem.');
    } finally {
      setActing(false);
    }
  };

  if (loading) return <Loading message="Carregando detalhes..." />;
  if (!weighing) {
    return (
      <View style={styles.container}>
        <Header title="Pesagem" onBack={() => navigation.goBack()} />
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
    <View style={styles.container}>
      <Header title="Detalhes da Pesagem" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card>
          <View style={styles.headRow}>
            <Text style={styles.waste}>{weighing.waste_type?.name}</Text>
            <View style={styles.badgesRow}>
              {isCanceled && <Tag label="Cancelada" color="#991B1B" bg="#FEE2E2" />}
              <StatusBadge status={weighing.approval_status} large />
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
            <StatusBadge status={weighing.approval_status} />
          </Info>
          <Info icon="person-circle-outline" label="Aprovado/avaliado por" value={weighing.approver?.full_name ?? '-'} />
          <Info icon="calendar-outline" label="Data da avaliação" value={weighing.approved_at ? formatDateTime(weighing.approved_at) : '-'} />
          {weighing.approval_status === 'rejected' && (
            <View style={styles.rejection}>
              <Text style={styles.rejectionTitle}>Motivo da rejeição</Text>
              <Text style={styles.rejectionText}>{weighing.rejection_reason ?? '-'}</Text>
            </View>
          )}
        </Card>

        {/* Fotos */}
        <Card>
          <Text style={styles.sectionTitle}>Fotos da Pesagem ({photos.length})</Text>
          {photos.length === 0 ? (
            <Text style={styles.noPhotos}>Nenhuma foto anexada.</Text>
          ) : (
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
          )}
        </Card>

        {/* Ações */}
        {showActionsCard && (
          <Card>
            <Text style={styles.sectionTitle}>Ações</Text>
            {canEdit && !isCanceled && (
              <Button
                title="Editar pesagem"
                icon="create-outline"
                variant="outline"
                onPress={() => navigation.navigate('WeighingForm', { id: weighing.id })}
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
  container: { flex: 1, backgroundColor: colors.greenBg },
  scroll: { padding: spacing.lg },
  notFound: { textAlign: 'center', marginTop: spacing.xxl, color: colors.grayText },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md, gap: spacing.sm },
  badgesRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 1 },
  waste: { fontSize: 22, fontWeight: '800', color: colors.text, flex: 1 },
  info: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.gray },
  infoLabel: { fontSize: 12, color: colors.grayText },
  infoValue: { fontSize: 15, color: colors.text, fontWeight: '600', marginTop: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  locHint: { color: colors.grayText, fontSize: 12, fontStyle: 'italic', marginTop: spacing.sm },
  weightBox: { backgroundColor: colors.greenBg, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md },
  weightLabel: { color: colors.greenDark, fontSize: 13, fontWeight: '600' },
  weightValue: { color: colors.greenDark, fontSize: 32, fontWeight: '800', marginTop: 4 },
  measureRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.gray },
  measureLabel: { color: colors.grayText },
  measureValue: { color: colors.text, fontWeight: '600' },
  rejection: { backgroundColor: '#FEE2E2', borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  rejectionTitle: { color: '#991B1B', fontWeight: '700', marginBottom: 4 },
  rejectionText: { color: '#991B1B' },
  cancelBox: { borderRadius: radius.md, overflow: 'hidden' },
  cancelReasonBox: { backgroundColor: '#FEE2E2', borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  cancelReasonTitle: { color: '#991B1B', fontWeight: '700', marginBottom: 4, fontSize: 13 },
  cancelReasonText: { color: '#991B1B' },
  noPhotos: { color: colors.grayText, fontStyle: 'italic' },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumb: { width: 96, height: 96, borderRadius: radius.md, backgroundColor: colors.gray },
  thumbBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, padding: 3 },
  zoomBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  zoomImage: { width: '100%', height: '80%' },
  zoomClose: { position: 'absolute', top: 50, right: 24 },
});
