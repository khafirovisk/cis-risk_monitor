import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const CONFIG_ID = 1;

export interface SamlConfigDto {
  enabled: boolean;
  entryPoint: string | null;
  issuer: string;
  callbackUrl: string | null;
  idpCert: string | null;
  wantAssertionsSigned: boolean;
  updatedBy: string | null;
  updatedAt: Date;
}

export interface SamlConfigInput {
  enabled: boolean;
  entryPoint: string | null;
  issuer: string;
  callbackUrl: string | null;
  idpCert: string | null;
  wantAssertionsSigned: boolean;
}

@Injectable()
export class SamlConfigService {
  private cache: SamlConfigDto | null = null;

  constructor(private prisma: PrismaService) {}

  async getConfig(): Promise<SamlConfigDto> {
    if (this.cache) return this.cache;

    const row = await this.prisma.samlConfig.upsert({
      where: { id: CONFIG_ID },
      update: {},
      create: { id: CONFIG_ID },
    });
    this.cache = this.toDto(row);
    return this.cache;
  }

  async updateConfig(input: SamlConfigInput, updatedBy: string): Promise<SamlConfigDto> {
    const row = await this.prisma.samlConfig.upsert({
      where: { id: CONFIG_ID },
      update: { ...input, updatedBy },
      create: { id: CONFIG_ID, ...input, updatedBy },
    });
    this.cache = this.toDto(row);
    return this.cache;
  }

  invalidateCache(): void {
    this.cache = null;
  }

  private toDto(row: any): SamlConfigDto {
    return {
      enabled: row.enabled,
      entryPoint: row.entryPoint,
      issuer: row.issuer,
      callbackUrl: row.callbackUrl,
      idpCert: row.idpCert,
      wantAssertionsSigned: row.wantAssertionsSigned,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    };
  }
}
