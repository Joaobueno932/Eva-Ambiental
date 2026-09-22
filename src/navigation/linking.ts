/**
 * Mapeamento das telas para endereços de URL.
 *
 * É o que transforma o aplicativo em site de verdade: cada tela ganha um
 * endereço próprio, o botão voltar do navegador funciona e um link pode ser
 * copiado e compartilhado. Só é ligado na web — no aplicativo a navegação
 * continua como antes.
 *
 * O Netlify precisa devolver o index.html em qualquer rota para isso
 * funcionar; a regra está no netlify.toml.
 */
import { Platform } from 'react-native';
import type { LinkingOptions } from '@react-navigation/native';
import { MainTabsParamList } from './types';

export const linking: LinkingOptions<MainTabsParamList> = {
  enabled: Platform.OS === 'web',
  prefixes: [],
  config: {
    screens: {
      Painel: 'painel',
      Relatorios: 'relatorios',
      Pesagens: {
        path: 'pesagens',
        screens: {
          WeighingsList: '',
          // O id é opcional: sem ele a tela abre em branco, para cadastro.
          WeighingForm: 'formulario/:id?',
          WeighingDetails: 'detalhes/:id',
        },
      },
      Perfil: {
        path: 'perfil',
        screens: {
          ProfileHome: '',
          AdminHub: 'administracao',
          AdminUsers: 'administracao/usuarios',
          AdminClients: 'administracao/clientes',
          AdminUnits: 'administracao/unidades',
          AdminWasteTypes: 'administracao/tipos-de-residuo',
          AdminTreatmentTypes: 'administracao/tipos-de-tratamento',
          AdminRecipients: 'administracao/destinatarios',
          AdminImport: 'administracao/importacao',
        },
      },
    },
  },
};

/** Título da aba do navegador, acompanhando a tela aberta. */
export const documentTitle = {
  formatter: (_options: object | undefined, route: { name?: string } | undefined) => {
    const titles: Record<string, string> = {
      Painel: 'Visão geral',
      Relatorios: 'Central de relatórios',
      Pesagens: 'Pesagens',
      WeighingsList: 'Pesagens',
      WeighingForm: 'Pesagem',
      WeighingDetails: 'Detalhes da pesagem',
      Perfil: 'Perfil',
      ProfileHome: 'Perfil',
      AdminHub: 'Administração',
      AdminUsers: 'Usuários',
      AdminClients: 'Clientes',
      AdminUnits: 'Unidades',
      AdminWasteTypes: 'Tipos de resíduo',
      AdminTreatmentTypes: 'Tipos de tratamento',
      AdminRecipients: 'Destinatários',
      AdminImport: 'Importação',
    };
    const name = route?.name ? titles[route.name] : undefined;
    return name ? `${name} — Eva Ambiental` : 'Eva Ambiental';
  },
};
