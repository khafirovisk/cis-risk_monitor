import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiSettingsService } from './ai-settings.service';

export interface ClassificationResult {
  controlNumbers: number[];
  error: string | null;
}

const NOT_CONFIGURED_MSG = 'a IA não está configurada em Configurações → IA — o risco foi criado sem controles vinculados.';
const CALL_FAILED_MSG = 'a IA não conseguiu classificar os controles automaticamente (falha na chamada) — o risco foi criado sem controles vinculados.';
const BAD_RESPONSE_MSG = 'a IA retornou uma resposta que não pôde ser interpretada — o risco foi criado sem controles vinculados.';

@Injectable()
export class AiClassifierService {
  private readonly logger = new Logger(AiClassifierService.name);

  constructor(
    private prisma: PrismaService,
    private settings: AiSettingsService,
  ) {}

  async classifyControls(title: string, description?: string): Promise<ClassificationResult> {
    const config = await this.settings.getConfig();
    if (!config.enabled || !config.baseUrl || !config.model || !config.hasApiKey) {
      return { controlNumbers: [], error: NOT_CONFIGURED_MSG };
    }

    const apiKey = await this.settings.getApiKey();
    const controls = await this.prisma.control.findMany({
      orderBy: { number: 'asc' },
      select: { number: true, titlePt: true },
    });
    const validNumbers = new Set(controls.map((c) => c.number));
    const controlsList = controls.map((c) => `${c.number}. ${c.titlePt}`).join('\n');

    const messages = [
      {
        role: 'system',
        content:
          'Você é um especialista em CIS Controls v8.1.2. Dada a lista de controles abaixo e a descrição de um ' +
          'risco de segurança da informação, responda SOMENTE com um JSON no formato {"controls": [n1, n2]} contendo ' +
          'os números dos controles CIS mais diretamente relacionados à mitigação desse risco (normalmente entre 1 e ' +
          '5 controles). Não escreva nenhum texto além do JSON.\n\nControles CIS v8.1.2:\n' +
          controlsList,
      },
      {
        role: 'user',
        content: `Título do risco: ${title}\nDescrição: ${description || '(sem descrição)'}`,
      },
    ];

    try {
      const url = `${config.baseUrl!.replace(/\/$/, '')}/chat/completions`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: config.model, messages, temperature: 0 }),
      });

      if (!res.ok) {
        this.logger.error(`Chamada de classificação de IA falhou: HTTP ${res.status}`);
        return { controlNumbers: [], error: CALL_FAILED_MSG };
      }

      const json: any = await res.json();
      const content = json?.choices?.[0]?.message?.content;
      const controlNumbers = this.parseControlNumbers(content, validNumbers);
      if (!controlNumbers.length) {
        return { controlNumbers: [], error: BAD_RESPONSE_MSG };
      }
      return { controlNumbers, error: null };
    } catch (err) {
      this.logger.error(`Falha ao chamar o serviço de IA: ${(err as Error).message}`, (err as Error).stack);
      return { controlNumbers: [], error: CALL_FAILED_MSG };
    }
  }

  private parseControlNumbers(content: unknown, validNumbers: Set<number>): number[] {
    if (typeof content !== 'string' || !content.trim()) return [];

    const match = content.match(/\{[\s\S]*\}/);
    const jsonText = match ? match[0] : content;

    try {
      const parsed = JSON.parse(jsonText);
      const raw = Array.isArray(parsed?.controls) ? parsed.controls : [];
      const nums = raw
        .map((n: unknown) => Number(n))
        .filter((n: number) => Number.isInteger(n) && validNumbers.has(n));
      return Array.from(new Set(nums));
    } catch {
      return [];
    }
  }
}
