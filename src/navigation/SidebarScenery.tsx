import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors } from '@/theme';

const WIDTH = 264;
/** Altura da paisagem, medida a partir do rodapé do menu. */
const HEIGHT = 250;

/**
 * Paisagem ao pé do menu lateral: dois morros e uma folha.
 *
 * Reproduz o desenho de referência camada por camada, com as cores medidas
 * nele. Os morros são preenchidos e clareiam na crista — `#204236` no da
 * frente — dissolvendo-se no fundo do menu para baixo. É a luz vindo de cima:
 * a crista acende e o pé do morro some no escuro, onde a mascote se apoia.
 *
 * O degradê usa coordenadas absolutas (`userSpaceOnUse`) e não a caixa de
 * cada forma: assim a crista clareia pela altura em que está, e o lado direito
 * do morro da frente, que desce, já nasce mais apagado — como no desenho.
 *
 * A folha fica sobre o morro do fundo, à direita, inclinada para o alto. As
 * nervuras são só um tom acima do limbo: é textura, não ilustração.
 *
 * Fica atrás de tudo e não recebe toque — é ambientação.
 */
export function SidebarScenery() {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMax slice">
        <Defs>
          <LinearGradient id="hillFar" x1="0" y1="24" x2="0" y2="140" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={colors.sidebarHillFar} stopOpacity="0.7" />
            <Stop offset="1" stopColor={colors.sidebarHillFar} stopOpacity="0" />
          </LinearGradient>
          {/* O brilho fica um pouco abaixo da crista (`#17382F` medido),
              não na borda: a borda é mais escura (`#143028`) e o morro só
              se dissolve depois do corpo iluminado. */}
          <LinearGradient id="hillNear" x1="0" y1="50" x2="0" y2="200" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={colors.sidebarHillNear} stopOpacity="0.35" />
            <Stop offset="0.35" stopColor={colors.sidebarHillNear} stopOpacity="0.6" />
            <Stop offset="1" stopColor={colors.sidebarHillNear} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Morro do fundo: sobe da esquerda para o canto superior direito.
            Começa escondido atrás do morro da frente. */}
        <Path d={`M0 150 C 90 110, 170 62, ${WIDTH} 40 L ${WIDTH} ${HEIGHT} L 0 ${HEIGHT} Z`} fill="url(#hillFar)" />

        {/* Folha sobre o morro do fundo, ponta para o alto e à direita. */}
        <G transform="translate(218 58) rotate(40) scale(1.2)">
          <Path d="M0 -36 C 24 -20, 24 20, 0 36 C -24 20, -24 -20, 0 -36 Z" fill={colors.sidebarLeaf} />
          <Path
            d="M0 -32 L0 34 M0 -14 L13 -24 M0 -14 L-13 -24 M0 2 L15 -9 M0 2 L-15 -9 M0 18 L13 8 M0 18 L-13 8"
            stroke={colors.sidebarLeafVein}
            strokeWidth={1.6}
            strokeLinecap="round"
            fill="none"
          />
        </G>

        {/* Morro da frente: arco achatado que atravessa a largura, levemente
            mais alto à esquerda. É o chão da mascote. */}
        <Path
          d={`M0 66 C 50 54, 130 50, 190 62 C 225 70, 250 78, ${WIDTH} 84 L ${WIDTH} ${HEIGHT} L 0 ${HEIGHT} Z`}
          fill="url(#hillNear)"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, height: HEIGHT },
});
