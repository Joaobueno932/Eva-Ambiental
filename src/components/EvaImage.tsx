import React, { useState } from 'react';
import { Image, ImageStyle, StyleProp, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { evaImages, EvaImageKey } from '@/theme/images';

interface Props {
  /** Qual imagem da Eva exibir */
  name: EvaImageKey;
  size?: number;
  width?: number;
  height?: number;
  style?: StyleProp<ImageStyle>;
  /** Cor do ícone de fallback caso a imagem não carregue */
  fallbackColor?: string;
}

/**
 * Exibe uma imagem da Eva de forma resiliente: se a imagem falhar ao
 * carregar, mostra um ícone de folha no lugar — o app nunca quebra.
 */
export function EvaImage({ name, size, width, height, style, fallbackColor = colors.green }: Props) {
  const [failed, setFailed] = useState(false);
  const w = width ?? size ?? 120;
  const h = height ?? size ?? 120;

  if (failed) {
    return (
      <View style={[{ width: w, height: h, alignItems: 'center', justifyContent: 'center' }]}>
        <Ionicons name="leaf" size={Math.min(w, h) * 0.5} color={fallbackColor} />
      </View>
    );
  }

  return (
    <Image
      source={evaImages[name]}
      onError={() => setFailed(true)}
      resizeMode="contain"
      style={[{ width: w, height: h }, style]}
      accessibilityLabel="Eva, mascote do Eva Ambiental"
    />
  );
}
