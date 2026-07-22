import { AiSettingsController } from './ai-settings.controller';

describe('AiSettingsController', () => {
  it('get delega ao service', async () => {
    const svc: any = { getConfig: jest.fn().mockResolvedValue({ enabled: false }) };
    const controller = new AiSettingsController(svc);
    expect(await controller.get()).toEqual({ enabled: false });
  });

  it('update usa o email da sessão como updatedBy quando presente', async () => {
    const svc: any = { updateConfig: jest.fn().mockResolvedValue({}) };
    const controller = new AiSettingsController(svc);
    const body: any = { enabled: true, baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' };
    const req: any = { user: { email: 'ana@empresa.com' } };

    await controller.update(body, req);

    expect(svc.updateConfig).toHaveBeenCalledWith(body, 'ana@empresa.com');
  });

  it('update usa o username quando não há email (conta local)', async () => {
    const svc: any = { updateConfig: jest.fn().mockResolvedValue({}) };
    const controller = new AiSettingsController(svc);
    const body: any = { enabled: false, baseUrl: null, model: null };
    const req: any = { user: { username: 'admin' } };

    await controller.update(body, req);

    expect(svc.updateConfig).toHaveBeenCalledWith(body, 'admin');
  });
});
