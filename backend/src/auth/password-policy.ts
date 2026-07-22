import { SecuritySettingsDto } from './security-settings.service';

export function validatePassword(password: string, policy: SecuritySettingsDto): string | null {
  if (password.length < policy.passwordMinLength) {
    return `A senha precisa ter ao menos ${policy.passwordMinLength} caracteres.`;
  }
  if (policy.passwordRequireUppercase && !/[A-Z]/.test(password)) {
    return 'A senha precisa ter ao menos uma letra maiúscula.';
  }
  if (policy.passwordRequireNumber && !/[0-9]/.test(password)) {
    return 'A senha precisa ter ao menos um número.';
  }
  if (policy.passwordRequireSymbol && !/[^A-Za-z0-9]/.test(password)) {
    return 'A senha precisa ter ao menos um símbolo.';
  }
  return null;
}
