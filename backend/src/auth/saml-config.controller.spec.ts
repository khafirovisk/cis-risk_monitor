import { SamlConfigController } from './saml-config.controller';

describe('SamlConfigController', () => {
  it('GET retorna a config do serviço', async () => {
    const svc = { getConfig: jest.fn().mockResolvedValue({ enabled: false }) } as any;
    const controller = new SamlConfigController(svc);
    const result = await controller.get();
    expect(result).toEqual({ enabled: false });
  });

  it('PUT repassa o body e o e-mail do usuário logado', async () => {
    const svc = { updateConfig: jest.fn().mockResolvedValue({ enabled: true }) } as any;
    const controller = new SamlConfigController(svc);
    const body = { enabled: true, entryPoint: null, issuer: 'x', callbackUrl: null, idpCert: null, wantAssertionsSigned: true };
    const req = { user: { email: 'admin@empresa.com' } } as any;

    const result = await controller.update(body, req);

    expect(svc.updateConfig).toHaveBeenCalledWith(body, 'admin@empresa.com');
    expect(result).toEqual({ enabled: true });
  });
});
