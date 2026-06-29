import { NavigatorScreenParams } from '@react-navigation/native';

export type WeighingsStackParamList = {
  WeighingsList: undefined;
  WeighingForm: { id?: string } | undefined;
  WeighingDetails: { id: string };
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  AdminHub: undefined;
  AdminUsers: undefined;
  AdminClients: undefined;
  AdminUnits: undefined;
  AdminWasteTypes: undefined;
  AdminTreatmentTypes: undefined;
  AdminRecipients: undefined;
  AdminImport: undefined;
};

export type MainTabsParamList = {
  Painel: undefined;
  Pesagens: NavigatorScreenParams<WeighingsStackParamList>;
  Perfil: NavigatorScreenParams<ProfileStackParamList>;
};
