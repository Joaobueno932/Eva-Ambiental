import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { showAlert } from '@/utils/alert';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import {
  Button,
  FormScreenContainer,
  Header,
  Input,
  Loading,
  PhotoPicker,
  Select,
  SelectedPhoto,
  SuccessModal,
  Topbar,
} from '@/components';
import {
  FormCard,
  FormStepper,
  LeafSeal,
  Notice,
  PageHeader,
  SectionHead,
  SummaryCard,
  SummaryRow,
} from '@/components/FormKit';
import { BuildingIcon, ScaleIcon, TreatmentIcon, WasteIcon } from '@/components/MenuIcons';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import Calendar from 'lucide-react-native/icons/calendar';
import Camera from 'lucide-react-native/icons/camera';
import Check from 'lucide-react-native/icons/check';
import ClipboardCheck from 'lucide-react-native/icons/clipboard-check';
import Clock from 'lucide-react-native/icons/clock';
import MapPin from 'lucide-react-native/icons/map-pin';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import Settings from 'lucide-react-native/icons/settings';
import Users from 'lucide-react-native/icons/users';
import { colors, gradient, radius, spacing } from '@/theme';
import { useIsDesktop, useIsWide } from '@/hooks/useLayout';
import { formatLongDate, roleLabel } from '@/utils/format';
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

  const { profile, signOut } = useAuth();
  const isDesktop = useIsDesktop();
  const isWide = useIsWide();
  const { canEditWeighing } = usePermissions();

  // Ref para a função de permissão — evita que o useCallback recrie load() a cada render.
  // Sem isso, qualquer digitação no formulário recriava load() e disparava o useEffect,
  // resetando todos os campos enquanto o usuário editava.
  const canEditRef = useRef(canEditWeighing);
  canEditRef.current = canEditWeighing;

  const [step, setStep] = useState(0);
  const steps = [
    { title: 'Origem', description: 'Cliente e local', weight: 180 },
    { title: 'Resíduo', description: 'Tipo e classificação', weight: 194 },
    { title: 'Pesagem e tratamento', description: 'Peso e destinação', weight: 189 },
    { title: 'Evidência', description: 'Fotos e documentos', weight: 171 },
    { title: 'Revisão', description: 'Confirme os dados', weight: 141 },
  ];
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
  const [peopleCount, setPeopleCount] = useState('');
  const [couldDivert, setCouldDivert] = useState(false);
  const [notes, setNotes] = useState('');
  const [dateStr, setDateStr] = useState(dayjs().format('DD/MM/YYYY'));
  const [timeStr, setTimeStr] = useState(dayjs().format('HH:mm'));
  const [photo, setPhoto] = useState<SelectedPhoto | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Campos de localização manual
  const [manualLocation, setManualLocation] = useState('');
  const [mStreet, setMStreet] = useState('');
  const [mNeighborhood, setMNeighborhood] = useState('');
  const [mPostal, setMPostal] = useState('');
  const [mCity, setMCity] = useState('');
  const [mState, setMState] = useState('');

  // Checkbox "Usar endereço da unidade?" — aparece após anexar imagem
  const [useUnitAddress, setUseUnitAddress] = useState(false);

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
          // Usa o ref para não adicionar canEditWeighing como dep e recriar load() a cada render
          if (!canEditRef.current(existing)) {
            showAlert('Sem permissão', 'Você não pode editar esta pesagem.');
            navigation.goBack();
            return;
          }
          setClientId(existing.client_id);
          setUnitId(existing.unit_id);
          setWasteTypeId(existing.waste_type_id);
          setTreatmentTypeId(existing.treatment_type_id);
          setRecipientId(existing.recipient_id ?? '');
          setWeight(String(existing.weight_kg));
          setPeopleCount(existing.people_count ? String(existing.people_count) : '');
          setCouldDivert(existing.could_divert_from_landfill ?? false);
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
      showAlert('Erro', e?.message ?? 'Falha ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, [isEdit, editId, navigation]); // canEditWeighing removido dos deps — usa ref acima

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

  const selectedRecipient = useMemo(
    () => recipients.find((r) => r.id === recipientId) ?? null,
    [recipients, recipientId]
  );

  const selectedUnit = useMemo(
    () => units.find((u) => u.id === unitId) ?? null,
    [units, unitId]
  );

  const handleUseUnitAddress = (val: boolean) => {
    setUseUnitAddress(val);
    if (val && selectedUnit) {
      const hasAddr =
        selectedUnit.street || selectedUnit.neighborhood || selectedUnit.city ||
        selectedUnit.state || selectedUnit.postal_code || selectedUnit.address;
      if (!hasAddr) {
        showAlert('Sem endereço', 'Esta unidade não possui endereço cadastrado.');
        setUseUnitAddress(false);
        return;
      }
      setMStreet(selectedUnit.street ?? selectedUnit.address ?? '');
      setMNeighborhood(selectedUnit.neighborhood ?? '');
      setMCity(selectedUnit.city ?? '');
      setMState(selectedUnit.state ?? '');
      setMPostal(selectedUnit.postal_code ?? '');
    }
  };

  const onPhotoChange = (p: SelectedPhoto | null) => {
    setPhoto(p);
    setUseUnitAddress(false); // reseta checkbox ao trocar foto
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
    if (peopleCount) {
      const pc = parseInt(peopleCount, 10);
      if (isNaN(pc) || pc <= 0 || !Number.isInteger(pc)) e.peopleCount = 'Informe um número inteiro maior que zero.';
    }
    const dt = dayjs(`${dateStr} ${timeStr}`, 'DD/MM/YYYY HH:mm', true);
    if (!dt.isValid()) e.date = 'Data/hora inválida (DD/MM/AAAA HH:mm).';
    setErrors(e);
    if (e.clientId || e.unitId || e.date) setStep(0);
    else if (e.wasteTypeId) setStep(1);
    else if (e.weight || e.treatmentTypeId || e.peopleCount) setStep(2);
    return Object.keys(e).length === 0;
  };

  const onSave = async () => {
    if (!validate() || !profile) return;
    setSaving(true);
    try {
      const weighingDate = dayjs(`${dateStr} ${timeStr}`, 'DD/MM/YYYY HH:mm').toISOString();

      const manualDetails: LocationDetails = {
        street: mStreet || null,
        neighborhood: mNeighborhood || null,
        postalCode: mPostal || null,
        city: mCity || null,
        state: mState || null,
      };
      manualDetails.formattedAddress = formatAddress(manualDetails);

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
        people_count: peopleCount ? parseInt(peopleCount, 10) : null,
        could_divert_from_landfill: selectedRecipient?.is_landfill ? couldDivert : null,
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
      showAlert('Erro ao salvar', e?.message ?? 'Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const clientName = clients.find((c) => c.id === clientId)?.name;
  const wasteName = wasteTypes.find((w) => w.id === wasteTypeId)?.name;
  const treatmentName = treatmentTypes.find((t) => t.id === treatmentTypeId)?.name;
  const evidence = photo
    ? photo.imageSource === 'camera' ? 'Foto capturada' : 'Imagem anexada'
    : isEdit ? 'Nenhuma nova foto (anexos existentes preservados)' : null;
  const locationText =
    shortLocationSummary(photo?.location) ??
    ([mStreet, mNeighborhood, mCity, mState, mPostal].filter(Boolean).join(', ') || manualLocation || null);

  /**
   * Linhas do resumo.
   *
   * No painel lateral ficam as seis do desenho mais a data; evidência,
   * localização, pessoas e observações só entram quando preenchidas — são
   * opcionais, e seis "Não informado" a mais transformariam o resumo em lista
   * de pendências. Na revisão (`full`) tudo aparece, porque é ali que se
   * confere o registro inteiro antes de enviar.
   */
  const summaryRows = (full: boolean) => {
    const optional = [
      { icon: Camera, label: 'Evidência', value: evidence },
      { icon: MapPin, label: 'Localização', value: locationText },
      { icon: Users, label: 'Pessoas na unidade', value: peopleCount || null },
      ...(selectedRecipient?.is_landfill
        ? [{ icon: RefreshCw, label: 'Poderia desviar do aterro?', value: couldDivert ? 'Sim' : 'Não' }]
        : []),
      { icon: ClipboardCheck, label: 'Observações', value: notes || null },
    ].filter((row) => full || row.value);
    return (
      <>
        <SummaryRow icon={Users} label="Cliente" value={clientName} />
        <SummaryRow icon={BuildingIcon} label="Unidade / Local" value={selectedUnit?.name} />
        <SummaryRow icon={WasteIcon} label="Resíduo" value={wasteName} />
        <SummaryRow icon={ScaleIcon} label="Peso" value={weight ? `${weight} kg` : null} />
        <SummaryRow icon={TreatmentIcon} label="Tratamento" value={treatmentName} />
        <SummaryRow icon={Settings} label="Destinatário" value={selectedRecipient?.name} />
        {optional.map((row) => (
          <SummaryRow key={row.label} icon={row.icon} label={row.label} value={row.value} />
        ))}
        <SummaryRow icon={Calendar} label="Data e hora" value={`${dateStr}  •  ${timeStr}`} emphasis last />
      </>
    );
  };

  if (loading) return <Loading message="Carregando formulário..." />;

  const pageTitle = isEdit ? 'Editar pesagem' : 'Nova pesagem';
  const goNext = () => setStep((st) => Math.min(4, st + 1));
  const goBack = () => setStep((st) => Math.max(0, st - 1));

  return (
    <View style={[styles.container, isDesktop && gradient(PAGE_TOP, colors.pageBg)]}>
      {isDesktop ? (
        <Topbar
          plain
          crumbs={[
            { label: 'Painel', icon: 'home-outline', onPress: () => navigation.getParent()?.navigate('Painel' as never) },
            { label: 'Pesagens', onPress: () => navigation.navigate('WeighingsList') },
            { label: pageTitle },
          ]}
          userName={profile?.full_name}
          userRole={roleLabel[profile?.role ?? 'viewer']}
          onNotifications={() => navigation.navigate('WeighingsList')}
          onUser={() => navigation.getParent()?.navigate('Perfil' as never)}
          onSignOut={signOut}
        />
      ) : (
        <Header
          title={pageTitle}
          subtitle={`Etapa ${step + 1} de 5 • ${steps[step].title}`}
          onBack={() => navigation.goBack()}
        />
      )}

      <FormScreenContainer
        contentContainerStyle={isDesktop ? styles.deskContent : undefined}
        columnStyle={isDesktop ? styles.deskColumn : undefined}
      >
        {isDesktop ? (
          <PageHeader
            seal={<LeafSeal size={34} />}
            title={pageTitle}
            subtitle={
              isEdit
                ? 'Revise e atualize os dados da pesagem.'
                : 'Registre os dados da pesagem em um fluxo simples e seguro.'
            }
            right={<Text style={styles.today}>{formatLongDate()}</Text>}
          />
        ) : null}

        <View style={isWide ? styles.split : undefined}>
          <View style={styles.main}>
            <FormStepper steps={steps} current={step} onChange={setStep} />

            <FormCard>
              <View style={{ display: step === 0 ? 'flex' : 'none' }}>
                <SectionHead
                  icon={BuildingIcon}
                  title="Origem do registro"
                  description="Identifique o cliente, a unidade e o momento da pesagem."
                />
                <Select
                  size="form"
                  required
                  label="Cliente"
                  placeholder="Selecione um cliente..."
                  options={clients.map((c) => ({ label: c.name, value: c.id }))}
                  value={clientId}
                  onChange={(v) => {
                    setClientId(v);
                    setUnitId('');
                  }}
                  error={errors.clientId}
                />
                <Select
                  size="form"
                  required
                  label="Unidade / Local"
                  placeholder="Selecione uma unidade ou local..."
                  options={unitOptions}
                  value={unitId}
                  onChange={setUnitId}
                  error={errors.unitId}
                />
                <View style={isDesktop ? styles.row : undefined}>
                  <View style={styles.cell}>
                    <Input
                      size="form"
                      required
                      label="Data da pesagem"
                      placeholder="DD/MM/AAAA"
                      leftIconComponent={Calendar}
                      value={dateStr}
                      onChangeText={setDateStr}
                      error={errors.date}
                    />
                  </View>
                  <View style={styles.cell}>
                    <Input
                      size="form"
                      required
                      label="Hora"
                      placeholder="HH:mm"
                      leftIconComponent={Clock}
                      value={timeStr}
                      onChangeText={setTimeStr}
                    />
                  </View>
                </View>
                <Notice style={styles.notice}>
                  Essas informações serão utilizadas para identificar a origem da pesagem e associar os demais dados do registro.
                </Notice>
              </View>

              <View style={{ display: step === 1 ? 'flex' : 'none' }}>
                <SectionHead
                  icon={WasteIcon}
                  title="Classificação do resíduo"
                  description="Selecione a categoria correspondente ao material pesado."
                />
                <Select
                  size="form"
                  required
                  label="Tipo de resíduo"
                  placeholder="Selecione o tipo de resíduo..."
                  options={wasteTypes.map((w) => ({ label: w.name, value: w.id }))}
                  value={wasteTypeId}
                  onChange={setWasteTypeId}
                  error={errors.wasteTypeId}
                />
              </View>

              <View style={{ display: step === 2 ? 'flex' : 'none' }}>
                <SectionHead
                  icon={ScaleIcon}
                  title="Pesagem e destinação"
                  description="Informe a massa, o tratamento e o destinatário."
                />
                <Input
                  size="form"
                  required
                  label="Peso (kg)"
                  placeholder="0,00"
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                  error={errors.weight}
                />
                <Select
                  size="form"
                  required
                  label="Tipo de tratamento"
                  placeholder="Selecione o tratamento..."
                  options={treatmentTypes.map((t) => ({ label: t.name, value: t.id }))}
                  value={treatmentTypeId}
                  onChange={setTreatmentTypeId}
                  error={errors.treatmentTypeId}
                />
                <Select
                  size="form"
                  label="Destinatário"
                  placeholder="Opcional"
                  options={[{ label: 'Não informado', value: '' }, ...recipients.map((r) => ({ label: r.name + (r.is_landfill ? ' (Aterro)' : ''), value: r.id }))]}
                  value={recipientId}
                  onChange={setRecipientId}
                />
                {selectedRecipient?.is_landfill && (
                  <View style={styles.switchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.switchLabel}>Poderia desviar do aterro?</Text>
                      <Text style={styles.switchHint}>
                        Este resíduo poderia ter sido destinado de outra forma em vez de ir para aterro.
                      </Text>
                    </View>
                    <Switch
                      value={couldDivert}
                      onValueChange={setCouldDivert}
                      trackColor={{ true: colors.greenLight, false: colors.grayMedium }}
                      thumbColor={couldDivert ? colors.green : colors.gray}
                    />
                  </View>
                )}
                <Input
                  size="form"
                  label="Quantidade de pessoas na unidade"
                  placeholder="Opcional — base para cálculo per capita"
                  value={peopleCount}
                  onChangeText={setPeopleCount}
                  keyboardType="number-pad"
                  error={errors.peopleCount}
                />
                <Input
                  size="form"
                  label="Observações"
                  placeholder="Observações sobre a pesagem (opcional)"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                  style={styles.multiline}
                />
              </View>

              <View style={{ display: step === 3 ? 'flex' : 'none' }}>
                <SectionHead
                  icon={Camera}
                  title="Evidência e localização"
                  description="Capture uma foto em campo ou anexe uma imagem da galeria."
                />
                <PhotoPicker value={photo} onChange={onPhotoChange} />

                {/* Campos manuais para upload */}
                {photo?.imageSource === 'upload' && (
                  <View style={styles.uploadFields}>
                    <Text style={styles.uploadHint}>
                      Como a imagem foi anexada, informe os dados manualmente (opcional).
                    </Text>

                    {/* Checkbox para usar endereço da unidade — aparece dentro do bloco de upload, logo antes dos campos de endereço */}
                    {unitId ? (
                      <View style={styles.unitAddressRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.switchLabel}>Usar endereço cadastrado da unidade?</Text>
                          {selectedUnit &&
                            !selectedUnit.street && !selectedUnit.neighborhood &&
                            !selectedUnit.city && !selectedUnit.address && (
                            <Text style={[styles.switchHint, { color: colors.warning }]}>
                              Esta unidade não possui endereço cadastrado.
                            </Text>
                          )}
                        </View>
                        <Switch
                          value={useUnitAddress}
                          onValueChange={handleUseUnitAddress}
                          trackColor={{ true: colors.greenLight, false: colors.grayMedium }}
                          thumbColor={useUnitAddress ? colors.green : colors.gray}
                        />
                      </View>
                    ) : null}

                    <Input
                      size="form"
                      label="Localização manual / ponto de referência"
                      placeholder="Ex.: Galpão 2, Doca de resíduos"
                      value={manualLocation}
                      onChangeText={setManualLocation}
                    />
                    <Input size="form" label="Rua / logradouro" placeholder="Ex.: Rua das Flores, 100" value={mStreet} onChangeText={setMStreet} />
                    <Input size="form" label="Bairro" placeholder="Ex.: Centro" value={mNeighborhood} onChangeText={setMNeighborhood} />
                    <View style={isDesktop ? styles.row : undefined}>
                      <View style={styles.cell}>
                        <Input size="form" label="Cidade" placeholder="Cidade" value={mCity} onChangeText={setMCity} />
                      </View>
                      <View style={styles.cell}>
                        <Input size="form" label="Estado" placeholder="UF" value={mState} onChangeText={setMState} autoCapitalize="characters" />
                      </View>
                    </View>
                    <Input size="form" label="CEP" placeholder="00000-000" value={mPostal} onChangeText={setMPostal} keyboardType="numbers-and-punctuation" />
                    <View style={isDesktop ? styles.row : undefined}>
                      <View style={styles.cell}>
                        <Input size="form" label="Data da pesagem" placeholder="DD/MM/AAAA" leftIconComponent={Calendar} value={dateStr} onChangeText={setDateStr} />
                      </View>
                      <View style={styles.cell}>
                        <Input size="form" label="Hora" placeholder="HH:mm" leftIconComponent={Clock} value={timeStr} onChangeText={setTimeStr} />
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
              </View>

              {step === 4 && (
                <View>
                  <SectionHead
                    icon={ClipboardCheck}
                    title="Revisão antes do envio"
                    description={isEdit ? 'Confira as alterações do registro.' : 'O registro será enviado para validação.'}
                  />
                  {summaryRows(true)}
                </View>
              )}

              {/* Ações dentro do cartão, cada uma com metade da largura: o
                  "Continuar" fica sempre à direita, onde o olho termina a
                  leitura do formulário, e o "Voltar" ocupa o lugar vazio. */}
              <View style={styles.actions}>
                {/* No site a célula vazia segura o "Continuar" na metade
                    direita; no celular ele ocupa a largura toda. */}
                {isDesktop || step > 0 ? (
                  <View style={styles.cell}>
                    {step > 0 ? (
                      <Button
                        title="Voltar"
                        variant="outline"
                        size="lg"
                        iconComponent={ArrowLeft}
                        disabled={saving}
                        onPress={goBack}
                      />
                    ) : null}
                  </View>
                ) : null}
                <View style={styles.cell}>
                  {step < 4 ? (
                    <Button
                      title={step === 3 ? 'Revisar registro' : 'Continuar'}
                      variant="deep"
                      size="lg"
                      iconComponent={ArrowRight}
                      onPress={goNext}
                    />
                  ) : (
                    <Button
                      title={isEdit ? 'Salvar alterações' : 'Salvar pesagem'}
                      variant="deep"
                      size="lg"
                      iconComponent={Check}
                      onPress={onSave}
                      loading={saving}
                    />
                  )}
                </View>
              </View>
            </FormCard>
          </View>

          {isWide && (
            <SummaryCard title="Resumo do registro" description="Acompanhe os dados informados." style={styles.aside}>
              {summaryRows(false)}
              <Notice tone="safe" style={styles.asideNotice}>
                Todos os dados são salvos apenas após a conclusão do registro.
              </Notice>
            </SummaryCard>
          )}
        </View>
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

/**
 * Topo da página um tom mais claro que o fundo, sem faixa nem linha: é o que
 * o desenho usa para a barra e o título se lerem como um bloco só.
 */
const PAGE_TOP = `linear-gradient(180deg, #FAFBFC 0px, #FAFBFC 150px, ${colors.pageBg} 260px)`;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  row: { flexDirection: 'row', gap: 21 },
  cell: { flex: 1, minWidth: 0 },

  deskContent: { paddingHorizontal: 26, paddingTop: 8, paddingBottom: spacing.xxl },
  deskColumn: { maxWidth: '100%' },
  today: { fontSize: 14.5, color: colors.form.muted },

  /** Formulário à esquerda, resumo fixo em 366px à direita — medidas do desenho. */
  split: { flexDirection: 'row', alignItems: 'flex-start', gap: 21 },
  main: { flex: 1, minWidth: 0 },
  aside: { width: 366 },
  asideNotice: { marginTop: 22 },

  notice: { marginTop: 3 },
  multiline: { height: 110, paddingTop: 14, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 20, marginTop: 26 },
  uploadFields: {
    marginTop: spacing.md, backgroundColor: colors.brand[50],
    borderWidth: 1, borderColor: colors.greenLine,
    borderRadius: radius.md, padding: spacing.md,
  },
  uploadHint: { color: colors.brand[600], fontSize: 12.5, marginBottom: spacing.md, lineHeight: 18 },
  gpsInfo: {
    marginTop: spacing.md, backgroundColor: colors.brand[50],
    borderWidth: 1, borderColor: colors.greenLine,
    borderRadius: radius.md, padding: spacing.md,
  },
  gpsText: { color: colors.brand[700], fontSize: 13, fontWeight: '500' },
  gpsCoords: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    padding: spacing.md + 2,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  unitAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.brand[50],
    borderRadius: radius.md,
    padding: spacing.md + 2,
    marginTop: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.greenLine,
  },
  switchLabel: { fontSize: 14.5, fontWeight: '600', color: colors.text },
  switchHint: { color: colors.textMuted, fontSize: 12, marginTop: 3, lineHeight: 17 },
});
