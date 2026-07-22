import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { EvidencesService } from './evidences.service';

function makeFile(name: string, content: string): Express.Multer.File {
  return {
    originalname: name,
    mimetype: 'text/plain',
    size: Buffer.byteLength(content),
    buffer: Buffer.from(content),
  } as Express.Multer.File;
}

describe('EvidencesService', () => {
  let prisma: any;
  let service: EvidencesService;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'evidences-test-'));
    process.env.UPLOADS_DIR = tmpDir;
    prisma = { evidence: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() } };
    service = new EvidencesService(prisma);
  });

  afterEach(async () => {
    delete process.env.UPLOADS_DIR;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('grava o arquivo no disco e cria o registro Evidence', async () => {
    prisma.evidence.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'ev1', ...data }));

    const [created] = await service.saveMany('item1', [makeFile('relatorio.txt', 'conteudo')], 'auditor@empresa.com');

    expect(created.filename).toBe('relatorio.txt');
    expect(created.itemId).toBe('item1');
    expect(created.uploadedBy).toBe('auditor@empresa.com');
    const written = await fs.readFile(path.join(tmpDir, created.storageKey), 'utf-8');
    expect(written).toBe('conteudo');
  });

  it('sanitiza nomes de arquivo com separadores de caminho', async () => {
    prisma.evidence.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'ev2', ...data }));

    const [created] = await service.saveMany('item1', [makeFile('../../etc/passwd', 'x')]);

    expect(created.filename).toBe('.._.._etc_passwd');
    expect(created.storageKey).not.toMatch(/[/\\]/);
  });

  it('remove apaga o arquivo do disco e a linha no banco', async () => {
    prisma.evidence.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'ev3', ...data }));
    const [created] = await service.saveMany('item1', [makeFile('a.txt', 'y')]);
    prisma.evidence.delete.mockResolvedValue(created);

    await service.remove(created);

    expect(prisma.evidence.delete).toHaveBeenCalledWith({ where: { id: created.id } });
    await expect(fs.readFile(path.join(tmpDir, created.storageKey))).rejects.toThrow();
  });
});
