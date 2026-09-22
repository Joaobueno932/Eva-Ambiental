import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * Ícones do menu que o Lucide não tem no desenho de referência.
 *
 * Seguem a gramática do Lucide — grade de 24, traço 2, pontas e junções
 * arredondadas — para que, ao lado dos ícones do pacote, ninguém perceba
 * quais são desenhados aqui. A assinatura de props é a mesma do Lucide, e por
 * isso eles entram no mesmo mapa de ícones do menu.
 */
export interface MenuIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

function Frame({ size = 24, color = 'currentColor', strokeWidth = 2, children }: MenuIconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

/**
 * Relatórios: três barras vazadas, crescentes, sem eixo.
 *
 * O `chart-column-big` do Lucide tem as mesmas barras mas desenha os eixos,
 * e o `chart-no-axes-column-increasing` não tem eixos mas reduz as barras a
 * traços — a referência pede as barras com volume e sem moldura.
 */
export function ReportsIcon(props: MenuIconProps) {
  return (
    <Frame {...props}>
      <Rect x="3" y="13" width="4" height="8" rx="2" />
      <Rect x="10" y="5" width="4" height="16" rx="2" />
      <Rect x="17" y="3" width="4" height="18" rx="2" />
    </Frame>
  );
}

/**
 * Pesagens: van vista de lado, teto arredondado e duas janelas.
 *
 * O veículo que chega à balança. O `bus` do Lucide é quadrado e tem três
 * janelas; o `van` tem a cabine inclinada de utilitário. A referência mostra
 * a carroceria arredondada com um único montante entre as janelas.
 */
export function WeighingsIcon(props: MenuIconProps) {
  return (
    <Frame {...props}>
      <Path d="M5 17H4a2 2 0 0 1-2-2V9a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v6a2 2 0 0 1-2 2h-1" />
      <Path d="M2 11h20" />
      <Path d="M12 5v6" />
      <Path d="M9 17h6" />
      <Circle cx="7" cy="17" r="2" />
      <Circle cx="17" cy="17" r="2" />
    </Frame>
  );
}

/**
 * Unidade / local: prédio alto com um anexo baixo à direita.
 *
 * É o antigo `building-2` do Lucide, que saiu na versão 1 — o `building` que
 * ficou é um bloco só, e a referência mostra os dois volumes.
 */
export function BuildingIcon(props: MenuIconProps) {
  return (
    <Frame {...props}>
      <Path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" />
      <Path d="M15 10h3a2 2 0 0 1 2 2v9" />
      <Path d="M2 21h20" />
      <Path d="M8 7h.01M11 7h.01M8 11h.01M11 11h.01M8 15h.01M11 15h.01M18 14h.01M18 17h.01" />
      <Path d="M8 21v-2a1.5 1.5 0 0 1 3 0v2" />
    </Frame>
  );
}

/**
 * Resíduo: gota contornada por uma seta de reciclagem, com uma gota menor
 * dentro — o material que entra no ciclo. Ocupa a grade inteira, como os
 * vizinhos do Lucide; desenhada menor, sumia ao lado deles.
 */
export function WasteIcon(props: MenuIconProps) {
  return (
    <Frame {...props}>
      <Path d="M16.8 19.2A7 7 0 0 1 5 14c0-3.6 3.4-7.6 7-11 2.3 2.2 4.5 4.6 5.8 7" />
      <Path d="M20 13.5 18.6 10l-3.5 1.2" />
      <Path d="M12 10.5c-1.1 1.3-1.8 2.3-1.8 3.2a1.8 1.8 0 0 0 3.6 0c0-.9-.7-1.9-1.8-3.2Z" />
      <Path d="M16 17.5h4.5v3H16z" />
    </Frame>
  );
}

/**
 * Tratamento: setas em círculo com uma folha no centro — o resíduo sendo
 * transformado. O `refresh-cw` do Lucide tem as setas, mas não o que se
 * transforma.
 */
export function TreatmentIcon(props: MenuIconProps) {
  return (
    <Frame {...props}>
      <Path d="M20 12a8 8 0 0 1-13.6 5.7" />
      <Path d="M4 12a8 8 0 0 1 13.6-5.7" />
      <Path d="M17.6 2.5v3.8h-3.8" />
      <Path d="M6.4 21.5v-3.8h3.8" />
      <Path d="M14.6 9.4c-3 0-4.9 1.6-4.9 3.8 0 .6.1 1.1.3 1.6.9-1.9 2.2-3 3.9-3.7-1.4 1-2.4 2.2-2.9 3.9.4.2.9.3 1.4.3 1.9 0 2.4-2.9 2.2-5.9Z" />
    </Frame>
  );
}

/** Peso: balança de plataforma vista de frente, com o ponteiro no mostrador. */
export function ScaleIcon(props: MenuIconProps) {
  return (
    <Frame {...props}>
      <Rect x="3" y="3" width="18" height="18" rx="4" />
      <Path d="M9 8.5c.9.7 1.9 1 3 1s2.1-.3 3-1" />
      <Path d="M12 9.5 13.2 7" />
    </Frame>
  );
}
