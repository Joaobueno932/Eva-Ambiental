import React, { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { showAlert } from '@/utils/alert';
import { cameraIsDirect, pickFromCamera, pickFromLibrary } from '@/services/imagePicker';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { Button } from './Button';
import { ImageSource, LocationDetails } from '@/types';
import { captureLocationDetails, CapturePhase, shortLocationSummary } from '@/services/locationService';

export interface SelectedPhoto {
  uri: string;
  imageSource: ImageSource;
  capturedAt?: string | null;
  /** Detalhes de localização (apenas para foto da câmera) */
  location?: LocationDetails | null;
  /** true quando a foto foi tirada mas a localização não pôde ser obtida */
  locationDenied?: boolean;
}

interface Props {
  value: SelectedPhoto | null;
  onChange: (photo: SelectedPhoto | null) => void;
}

const phaseLabel: Record<CapturePhase, string> = {
  coords: 'Obtendo localização...',
  address: 'Identificando endereço...',
};

export function PhotoPicker({ value, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<CapturePhase | null>(null);

  /** Tira foto agora: câmera + data/hora + geolocalização + reverse geocoding. */
  const takePhoto = async () => {
    try {
      setBusy(true);
      const picked = await pickFromCamera();
      if (picked.status === 'denied') {
        showAlert('Permissão necessária', 'Autorize o uso da câmera para registrar a foto.');
        return;
      }
      if (picked.status !== 'ok' || !picked.uri) return;

      const capturedAt = new Date().toISOString();

      // Captura coordenadas + endereço (sem travar — cada etapa falha graciosamente).
      const cap = await captureLocationDetails((p) => setPhase(p));
      setPhase(null);

      let location: LocationDetails | null = null;
      let locationDenied = false;

      if (!cap.permissionGranted) {
        locationDenied = true;
        showAlert(
          'Localização indisponível',
          'A foto será salva sem coordenadas. Você pode informar a localização manualmente, se desejar.'
        );
      } else if (!cap.location) {
        locationDenied = true;
        showAlert('Localização indisponível', 'Não foi possível obter as coordenadas. A foto será salva sem localização.');
      } else {
        location = { ...cap.location, capturedAt };
        if (!cap.addressResolved) {
          showAlert('Endereço não identificado', 'Coordenadas capturadas, mas não foi possível identificar o endereço.');
        }
      }

      onChange({ uri: picked.uri, imageSource: 'camera', capturedAt, location, locationDenied });
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Não foi possível concluir a captura.');
    } finally {
      setPhase(null);
      setBusy(false);
    }
  };

  /** Anexa imagem da galeria/arquivos (sem geolocalização confiável). */
  const pickImage = async () => {
    try {
      setBusy(true);
      const picked = await pickFromLibrary();
      if (picked.status === 'denied') {
        showAlert('Permissão necessária', 'Autorize o acesso às imagens para anexar a foto.');
        return;
      }
      if (picked.status !== 'ok' || !picked.uri) return;

      onChange({ uri: picked.uri, imageSource: 'upload', location: null });
    } catch (e: any) {
      showAlert('Erro', e?.message ?? 'Não foi possível anexar a imagem.');
    } finally {
      setBusy(false);
    }
  };

  const summary = value?.location ? shortLocationSummary(value.location) : null;

  return (
    <View>
      {value ? (
        <View style={styles.preview}>
          <Image source={{ uri: value.uri }} style={styles.image} resizeMode="cover" />
          <View style={styles.previewInfo}>
            <View style={styles.sourceRow}>
              <Ionicons name={value.imageSource === 'camera' ? 'camera' : 'image'} size={16} color={colors.greenDark} />
              <Text style={styles.sourceText}>
                {value.imageSource === 'camera' ? 'Foto da câmera' : 'Imagem anexada'}
              </Text>
            </View>
            {value.location?.latitude != null && (
              <Text style={styles.gps}>
                📍 {value.location.latitude.toFixed(5)}, {value.location.longitude?.toFixed(5)}
              </Text>
            )}
            {summary && <Text style={styles.address}>{summary}</Text>}
            <Button title="Remover foto" variant="ghost" icon="trash-outline" onPress={() => onChange(null)} />
          </View>
        </View>
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name="camera-outline" size={40} color={colors.green} />
          <Text style={styles.placeholderText}>Adicione uma evidência da pesagem</Text>
        </View>
      )}

      {busy && phase && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.green} />
          <Text style={styles.loadingText}>{phaseLabel[phase]}</Text>
        </View>
      )}

      <View style={styles.buttons}>
        {cameraIsDirect && (
          <View style={{ flex: 1 }}>
            <Button title="Tirar foto agora" icon="camera" onPress={takePhoto} loading={busy} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Button
            title="Anexar imagem"
            icon="image"
            variant={cameraIsDirect ? 'outline' : 'primary'}
            onPress={pickImage}
            loading={busy}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  placeholderText: { color: colors.textMuted, marginTop: spacing.sm, fontWeight: '600', fontSize: 13.5 },
  preview: {
    backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden',
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  image: { width: '100%', height: 200 },
  previewInfo: { padding: spacing.md },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sourceText: { color: colors.brand[700], fontWeight: '700', fontSize: 13 },
  gps: { color: colors.textMuted, fontSize: 12.5, marginTop: 4 },
  address: { color: colors.text, fontSize: 12.5, marginTop: 4, fontWeight: '500' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  loadingText: { color: colors.textMuted, fontSize: 13 },
  buttons: { flexDirection: 'row', gap: spacing.md },
});
