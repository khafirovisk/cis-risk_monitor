import { validatePassword } from './password-policy';

const BASE_POLICY = {
  passwordMinLength: 8,
  passwordRequireUppercase: false,
  passwordRequireNumber: false,
  passwordRequireSymbol: false,
  mfaRequired: false,
  updatedBy: null,
  updatedAt: new Date(),
};

describe('validatePassword', () => {
  it('aceita senha que cumpre a política default', () => {
    expect(validatePassword('12345678', BASE_POLICY)).toBeNull();
  });

  it('rejeita senha menor que o tamanho mínimo', () => {
    expect(validatePassword('123', BASE_POLICY)).toMatch(/ao menos 8 caracteres/);
  });

  it('rejeita sem maiúscula quando exigido', () => {
    expect(validatePassword('abcdefgh', { ...BASE_POLICY, passwordRequireUppercase: true })).toMatch(/maiúscula/);
  });

  it('rejeita sem número quando exigido', () => {
    expect(validatePassword('Abcdefgh', { ...BASE_POLICY, passwordRequireNumber: true })).toMatch(/número/);
  });

  it('rejeita sem símbolo quando exigido', () => {
    expect(validatePassword('Abcdefg1', { ...BASE_POLICY, passwordRequireSymbol: true })).toMatch(/símbolo/);
  });

  it('aceita senha que cumpre todas as regras simultaneamente', () => {
    expect(validatePassword('Abcdefg1!', { ...BASE_POLICY, passwordRequireUppercase: true, passwordRequireNumber: true, passwordRequireSymbol: true })).toBeNull();
  });
});
