import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import {
  Button,
  Card,
  FormScreenContainer,
  Header,
  Input,
  Loading,
  PhotoPicker,
  Select,
  SelectedPhoto,
  SuccessModal,
} from '@/components';
import { colors, radius, spacing } from '@/theme';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import {
  listClients,
  listRecipients,
  listTreatmentTypes,
  listUnits,
  listWasteTypes,
} from '@/services/masters';
import { createWeighing, getWeighing, updateWeighing, WeighingInput } from '@/services/weighings';
import { insertPhotoRecord, uploadWeighingPhoto } from '@/services/photos';
import { formatAddress, locationToColumns, shortLocationSummary } from '@/services/locationService';
import { Client, LocationDetails, Recipient, TreatmentType, Unit, WasteType } from '@/types';
import { WeighingsStackParamList } from '@/navigation/types';

dayjs.extend(customParseFormat);

type Nav = NativeStackNavigationProp<WeighingsStackParamList, 'WeighingForm'>;
type Rt = RouteProp<WeighingsStackParamList, 'WeighingForm'>;

export function WeighingFormScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const editId = route.params?.id;
  const isEdit = !!editId;

  const { profile } = useAuth();
  const { canEditWeighing } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Cadastros mestres
  const [clients, setClients] = useState<Client[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [wasteTypes, setWasteTypes] = useState<WasteType[]>([]);
  const [treatmentTypes, setTreatmentTypes] = useState<TreatmentType[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);

  // Campos do formulário
  const [clientId, setClientId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [wasteTypeId, setWasteTypeId] = useState('');
  const [treatmentTypeId, setTreatmentTypeId] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [dateStr, setDateStr] = useState(dayjs().format('DD/MM/YYYY'));
  const [timeStr, setTimeStr] = useState(dayjs().format('HH:mm'));
  const [photo, setPhoto] = useState<SelectedPhoto | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Campos de localização manual (usados quando a imagem é anexada)
  const [manualLocation, setManualLocation] = useState('');
  const [mStreet, setMStreet] = useState('');
  const [mNeighborhood, setMNeighborhood] = useState('');
  const [mPostal, setMPostal] = useState('');
  const [mCity, setMCity] = useState('');
  const [mState, setMState] = useState('');

  const load = useCallback(async () => {
    try {
      const [c, u, w, t, r] = await Promise.all([
        listClients(true),
        listUnits(true),
        listWasteTypes(true),
        listTreatmentTypes(true),
        listRecipients(true),
      ]);
      setClients(c);
      setUnits(u);
      setWasteTypes(w);
      setTreatmentTypes(t);
      setRecipients(r);

      if (isEdit && editId) {
        const existing = await getWeighing(editId);
        if (existing) {
          if (!canEditWeighing(existing)) {
            Alert.alert('Sem permissão', 'Você não pode editar esta pesagem.');
            navigation.goBack();
            return;
          }
          setClientId(existing.client_id);
          setUnitId(existing.unit_id);
          setWasteTypeId(existing.waste_type_id);
          setTreatmentTypeId(existing.treatment_type_id);
          setRecipientId(existing.recipient_id ?? '');
          setWeight(String(existing.weight_kg));
          setNotes(existing.notes ?? '');
          setDateStr(dayjs(existing.weighing_date).format('DD/MM/YYYY'));
          setTimeStr(dayjs(existing.weighing_date).format('HH:mm'));
          setManualLocation(existing.manual_location ?? '');
          setMStreet(existing.location_street ?? '');
          setMNeighborhood(existing.location_neighborhood ?? '');
          setMPostal(existing.location_postal_code ?? '');
          setMCity(existing.location_city ?? '');
          setMState(existing.location_state ?? '');
        }
      }
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Falha ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, [isEdit, editId, canEditWeighing, navigation]);

  useEffect(() => {
    load();
  }, [load]);

  // Unidades filtradas pelo cliente selecionado
  const unitOptions = useMemo(
    () =>
      units
        .filter((u) => !clientId || u.client_id === clientId)
        .map((u) => ({ label: u.name, value: u.id })),
    [units, clientId]
  );

  // Ao tirar foto na câmera, preenche data/hora e localização automaticamente.
  const onPhotoChange = (p: SelectedPhoto | null) => {
    setPhoto(p);
    if (p?.imageSource === 'camera' && p.capturedAt) {
      setDateStr(dayjs(p.capturedAt).format('DD/MM/YYYY'));
      setTimeStr(dayjs(p.capturedAt).format('HH:mm'));
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!clientId) e.clientId = 'Selecione o cliente.';
    if (!unitId) e.unitId = 'Selecione a unidade.';
    if (!wasteTypeId) e.wasteTypeId = 'Selecione o tipo de resíduo.';
    if (!treatmentTypeId) e.treatmentTypeId = 'Selecione o tratamento.';
    const w = parseFloat(weight.replace(',', '.'));
    if (!weight || isNaN(w) || w <= 0) e.weight = 'Informe um peso válido (kg).';
    const dt = dayjs(`${dateStr} ${timeStr}`, 'DD/MM/YYYY HH:mm', true);
    if (!dt.isValid()) e.date = 'Data/hora inválida (DD/MM/AAAA HH:mm).';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSave = async () => {
    if (!validate() || !profile) return;
    setSaving(true);
    try {
      const weighingDate = dayjs(`${dateStr} ${timeStr}`, 'DD/MM/YYYY HH:mm').toISOString();

      // Localização manual (preenchida no anexo de imagem)
      const manualDetails: LocationDetails = {
        street: mStreet || null,
        neighborhood: mNeighborhood || null,
        postalCode: mPostal || null,
        city: mCity || null,
        state: mState || null,
      };
      manualDetails.formattedAddress = formatAddress(manualDetails);

      // Câmera → usa o reverse geocode; anexo → usa o preenchimento manual.
      const isCamera = photo?.imageSource === 'camera';
      const locationColumns = isCamera
        ? locationToColumns(photo?.location)
        : locationToColumns(manualDetails);

      const input: WeighingInput = {
        client_id: clientId,
        unit_id: unitId,
        waste_type_id: wasteTypeId,
        treatment_type_id: treatmentTypeId,
        recipient_id: recipientId || null,
        weighing_date: weighingDate,
        weight_kg: parseFloat(weight.replace(',', '.')),
        notes: notes || null,
        gps_lat: isCamera ? photo?.location?.latitude ?? null : null,
        gps_lng: isCamera ? photo?.location?.longitude ?? null : null,
        manual_location: isCamera ? null : manualLocation || manualDetails.formattedAddress || null,
        image_source: photo?.imageSource ?? null,
        captured_at: photo?.capturedAt ?? (photo?.imageSource === 'upload' ? weighingDate : null),
        ...locationColumns,
      };

      let weighingId = editId;
      if (isEdit && editId) {
        await updateWeighing(editId, input);
      } else {
        const created = await createWeighing(input, profile.id);
        weighingId = created.id;
      }

      // Upload da foto (apenas se uma nova foi escolhida)
      if (photo && weighingId) {
        const path = await uploadWeighingPhoto(weighingId, photo.uri);
        await insertPhotoRecord(weighingId, path, {
          imageSource: photo.imageSource,
          gpsLat: isCamera ? photo.location?.latitude ?? null : null,
          gpsLng: isCamera ? photo.location?.longitude ?? null : null,
          manualLocation: isCamera ? null : manualLocation || manualDetails.formattedAddress || null,
          capturedAt: photo.capturedAt ?? weighingDate,
          ...locationColumns,
        });
      }

      setShowSuccess(true);
    } catch (e: any) {
      Alert.alert('Erro ao salvar', e?.message ?? 'Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading message="Carregando formulário..." />;

  return (
    <View style={styles.container}>
      <Header
        title={isEdit ? 'Editar Pesagem' : 'Nova Pesagem'}
        subtitle="Preencha os dados da pesagem"
        onBack={() => navigation.goBack()}
      />
      <FormScreenContainer>
          <Card>
            <Select
              label="Cliente"
              options={clients.map((c) => ({ label: c.name, value: c.id }))}
              value={clientId}
              onChange={(v) => {
                setClientId(v);
                setUnitId(''); // reseta unidade ao trocar cliente
              }}
              error={errors.clientId}
            />
            <Select label="Unidade / Local" options={unitOptions} value={unitId} onChange={setUnitId} error={errors.unitId} />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Input label="Data da pesagem" placeholder="DD/MM/AAAA" value={dateStr} onChangeText={setDateStr} error={errors.date} />
              </View>
              <View style={{ flex: 1 }}>
                <Input label="Hora" placeholder="HH:mm" value={timeStr} onChangeText={setTimeStr} />
              </View>
            </View>

            <Select label="Tipo de resíduo" options={wasteTypes.map((w) => ({ label: w.name, value: w.id }))} value={wasteTypeId} onChange={setWasteTypeId} error={errors.wasteTypeId} />
            <Input
              label="Peso (kg)"
              placeholder="0,00"
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              error={errors.weight}
            />
            <Select label="Tipo de tratamento" options={treatmentTypes.map((t) => ({ label: t.name, value: t.id }))} value={treatmentTypeId} onChange={setTreatmentTypeId} error={errors.treatmentTypeId} />
            <Select
              label="Destinatário"
              placeholder="Opcional"
              options={[{ label: 'Não informado', value: '' }, ...recipients.map((r) => ({ label: r.name, value: r.id }))]}
              value={recipientId}
              onChange={setRecipientId}
            />
            <Input
              label="Observações"
              placeholder="Observações sobre a pesagem (opcional)"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Foto da pesagem</Text>
            <PhotoPicker value={photo} onChange={onPhotoChange} />

            {/* Campos opcionais aparecem apenas quando a imagem é anexada (upload) */}
            {photo?.imageSource === 'upload' && (
              <View style={styles.uploadFields}>
                <Text style={styles.uploadHint}>
                  Como a imagem foi anexada, informe os dados manualmente (opcional).
                </Text>
                <Input
                  label="Localização manual / ponto de referência"
                  placeholder="Ex.: Galpão 2, Doca de resíduos"
                  value={manualLocation}
                  onChangeText={setManualLocation}
                />
                <Input label="Rua / logradouro" placeholder="Ex.: Rua das Flores" value={mStreet} onChangeText={setMStreet} />
                <Input label="Bairro" placeholder="Ex.: Centro" value={mNeighborhood} onChangeText={setMNeighborhood} />
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Input label="Cidade" placeholder="Cidade" value={mCity} onChangeText={setMCity} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input label="Estado" placeholder="UF" value={mState} onChangeText={setMState} autoCapitalize="characters" />
                  </View>
                </View>
                <Input label="CEP" placeholder="00000-000" value={mPostal} onChangeText={setMPostal} keyboardType="numbers-and-punctuation" />
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Input label="Data da pesagem" placeholder="DD/MM/AAAA" value={dateStr} onChangeText={setDateStr} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input label="Hora" placeholder="HH:mm" value={timeStr} onChangeText={setTimeStr} />
                  </View>
                </View>
              </View>
            )}

            {photo?.imageSource === 'camera' && (
              <View style={styles.gpsInfo}>
                {photo.location?.latitude != null ? (
                  <>
                    <Text style={styles.gpsText}>
                      {shortLocationSummary(photo.location)
                        ? `📍 Local capturado: ${shortLocationSummary(photo.location)}`
                        : 'Coordenadas capturadas, mas não foi possível identificar o endereço.'}
                    </Text>
                    <Text style={styles.gpsCoords}>
                      {photo.location.latitude.toFixed(5)}, {photo.location.longitude?.toFixed(5)}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.gpsText}>
                    ⚠️ Localização indisponível — a pesagem será salva sem coordenadas.
                  </Text>
                )}
              </View>
            )}
          </Card>

          <Button title={isEdit ? 'Salvar alterações' : 'Salvar pesagem'} icon="checkmark-circle" onPress={onSave} loading={saving} />
      </FormScreenContainer>

      <SuccessModal
        visible={showSuccess}
        title={isEdit ? 'Pesagem atualizada!' : 'Pesagem registrada!'}
        message={
          isEdit
            ? 'As alterações foram salvas com sucesso.'
            : 'Pesagem registrada com sucesso e enviada para aprovação.'
        }
        onClose={() => {
          setShowSuccess(false);
          navigation.goBack();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.greenBg },
  scroll: { padding: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  uploadFields: { marginTop: spacing.md, backgroundColor: colors.greenBg, borderRadius: radius.md, padding: spacing.md },
  uploadHint: { color: colors.greenDark, fontSize: 13, marginBottom: spacing.md },
  gpsInfo: { marginTop: spacing.md, backgroundColor: colors.greenBg, borderRadius: radius.md, padding: spacing.md },
  gpsText: { color: colors.greenDark, fontSize: 13 },
  gpsCoords: { color: colors.grayText, fontSize: 12, marginTop: 4 },
});
