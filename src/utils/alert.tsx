/**
 * Diálogo de aviso independente de plataforma.
 *
 * No React Native o `Alert.alert` nativo resolve tudo. No navegador ele não
 * existe (o react-native-web não implementa o módulo), por isso há uma versão
 * `alert.web.tsx` que desenha um modal próprio. As telas chamam sempre
 * `showAlert(...)` e o bundler escolhe a implementação certa.
 */
import { Alert } from 'react-native';

export function showAlert(title: string, message?: string): void {
  Alert.alert(title, message);
}

/** No nativo o Alert já é renderizado pelo sistema — nada a montar. */
export function AlertHost() {
  return null;
}
