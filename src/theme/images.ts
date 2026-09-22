/**
 * Imagens da mascote Eva (pasta /img na raiz do projeto).
 * Centralizadas aqui para facilitar manutenção e garantir que o
 * bundler (Metro) resolva os caminhos de forma estática.
 */
export const evaImages = {
  /** Eva acenando (corpo inteiro, fundo transparente) — boas-vindas / estados vazios */
  hero: require('../../img/eva-hero.png'),
  /** Eva apontando/explicando (corpo inteiro, transparente) — sucesso / ajuda */
  pointing: require('../../img/eva.png'),
  /** Retrato da Eva (fundo verde opaco, JPEG otimizado) — avatar de marca / sobre */
  portrait: require('../../img/eva-perfil.jpg'),
} as const;

export type EvaImageKey = keyof typeof evaImages;

/**
 * Cenário de fundo das telas públicas (acesso).
 * Fora do conjunto da mascote porque não é personagem: é ambientação.
 */
export const sceneImages = {
  /** Mata atlântica vista do alto, com o rio ao centro — fundo da tela de acesso. */
  login: require('../../img/login-bg.png'),
} as const;

export type SceneImageKey = keyof typeof sceneImages;
