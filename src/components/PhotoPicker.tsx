import React, { useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { Button } from './Button';
import { ImageSource } from '@/types';

export interface SelectedPhoto {
  uri: string;
  imageSource: ImageSource;
  gpsLat?: number | null;
  gpsLng?: number | null;
  capturedAt?: string | null;
  /** true quando a foto foi tirada mas a permissão de localização foi negada */
  locationDenied?: boolean;
}

interface Props {
  value: SelectedPhoto | null;
  onChange: (photo: SelectedPhoto | null) => void;
}

export function PhotoPicker({ value, onChange }: Props) {
  const [busy, setBusy] = useState(false);

  /** Tira foto agora: abre câmera, captura data/hora e geolocalização automaticamente. */
  const takePhoto = async () => {
    try {
      setBusy(true);
      const camPerm = await ImagePicker.requestCameraPermissionsAsync();
      if (!camPerm.granted) {
        Alert.alert('Permissão necessária', 'Autorize o uso da câmera para registrar a foto.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.6,
        mediaTypes: ['images'],
      });
      if (result.canceled || !result.assets?.[0]) return;

      const capturedAt = new Date().toISOString();
      let gpsLat: number | null = null;
      let gpsLng: number | null = null;
      let locationDenied = false;

      // Captura geolocalização atual (mediante permissão).
      const locPerm = await Location.requestForegroundPermissionsAsync();
      if (locPerm.granted) {
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          gpsLat = pos.coords.latitude;
          gpsLng = pos.coords.longitude;
        } catch {
          locationDenied = true;
        }
      } else {
        locationDenied = true;
      }

      if (locationDenied) {
        Alert.alert(
          'Localização indisponível',
          'A foto será salva sem coordenadas. Você pode informar a localização manualmente, se desejar.'
        );
      }

      onChange({ uri: result.assets[0].uri, imageSource: 'camera', gpsLat, gpsLng, capturedAt, locationDenied });
    } finally {
      setBusy(false);
    }
  };

  /** Anexa imagem da galeria/arquivos (sem geolocalização confiável). */
  const pickImage = async () => {
    try {
      setBusy(true);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permissão necessária', 'Autorize o acesso às imagens para anexar a foto.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        quality: 0.6,
        mediaTypes: ['images'],
      });
      if (result.canceled || !result.assets?.[0]) return;

      onChange({ uri: result.assets[0].uri, imageSource: 'upload' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      {value ? (
        <View style={styles.preview}>
          <Image source={{ uri: value.uri }} style={styles.image} resizeMode="cover" />
          <View style={styles.previewInfo}>
            <View style={styles.sourceRow}>
              <Ionicons
                name={value.imageSource === 'camera' ? 'camera' : 'image'}
                size={16}
                color={colors.greenDark}
              />
              <Text style={styles.sourceText}>
                {value.imageSource === 'camera' ? 'Foto da câmera' : 'Imagem anexada'}
              </Text>
            </View>
            {value.gpsLat != null && (
              <Text style={styles.gps}>
                📍 {value.gpsLat.toFixed(5)}, {value.gpsLng?.toFixed(5)}
              </Text>
            )}
            <Button title="Remover foto" variant="ghost" icon="trash-outline" onPress={() => onChange(null)} />
          </View>
        </View>
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name="camera-outline" size={40} color={colors.green} />
          <Text style={styles.placeholderText}>Adicione uma evidência da pesagem</Text>
        </View>
      )}

      <View style={styles.buttons}>
        <View style={{ flex: 1 }}>
          <Button title="Tirar foto agora" icon="camera" onPress={takePhoto} loading={busy} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Anexar imagem" icon="image" variant="outline" onPress={pickImage} loading={busy} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: colors.greenBg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.greenLight,
    borderStyle: 'dashed',
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  placeholderText: { color: colors.greenDark, marginTop: spacing.sm, fontWeight: '600' },
  preview: { backgroundColor: colors.white, borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.md, borderWidth: 1, borderColor: colors.grayMedium },
  image: { width: '100%', height: 200 },
  previewInfo: { padding: spacing.md },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sourceText: { color: colors.greenDark, fontWeight: '600' },
  gps: { color: colors.grayText, fontSize: 13, marginTop: 4 },
  buttons: { flexDirection: 'row', gap: spacing.md },
});
