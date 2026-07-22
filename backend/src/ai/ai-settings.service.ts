import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const CONFIG_ID = 1;

export interface AiSettingsDto {
  enabled: boolean;
  baseUrl: string | null;
  model: string | null;
  hasApiKey: boolean;
  updatedBy: string | null;
  updatedAt: Date;
}

export interface AiSettingsInput {
  enabled: boolean;
  baseUrl: string | null;
  model: string | null;
  apiKey?: string;
}

@Injectable()
export class AiSettingsService {
  private cache: AiSettingsDto | null = null;

  constructor(private prisma: PrismaService) {}

  async getConfig(): Promise<AiSettingsDto> {
    if (this.cache) return this.cache;

    const row = await this.prisma.aiSettings.upsert({
      where: { id: CONFIG_ID },
      update: {},
      create: { id: CONFIG_ID },
    });
    this.cache = this.toDto(row);
    return this.cache;
  }

  async updateConfig(input: AiSettingsInput, updatedBy: string): Promise<AiSettingsDto> {
    const data: any = { enabled: input.enabled, baseUrl: input.baseUrl, model: input.model, updatedBy };
    // só sobrescreve a chave se veio um valor novo — em branco/omitido mantém a atual,
    // já que ela nunca é reexibida pro frontend (getConfig() nem retorna o valor)
    if (input.apiKey) data.apiKey = input.apiKey;

    const row = await this.prisma.aiSettings.upsert({
      where: { id: CONFIG_ID },
      update: data,
      create: { id: CONFIG_ID, ...data },
    });
    this.cache = this.toDto(row);
    return this.cache;
  }

  async getApiKey(): Promise<string | null> {
    const row = await this.prisma.aiSettings.findUnique({ where: { id: CONFIG_ID } });
    return row?.apiKey ?? null;
  }

  invalidateCache(): void {
    this.cache = null;
  }

  private toDto(row: any): AiSettingsDto {
    return {
      enabled: row.enabled,
      baseUrl: row.baseUrl,
      model: row.model,
      hasApiKey: !!row.apiKey,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    };
  }
}
