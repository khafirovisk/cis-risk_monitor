import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const CONFIG_ID = 1;

export interface SecuritySettingsDto {
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSymbol: boolean;
  mfaRequired: boolean;
  updatedBy: string | null;
  updatedAt: Date;
}

export interface SecuritySettingsInput {
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSymbol: boolean;
  mfaRequired: boolean;
}

@Injectable()
export class SecuritySettingsService {
  private cache: SecuritySettingsDto | null = null;

  constructor(private prisma: PrismaService) {}

  async getConfig(): Promise<SecuritySettingsDto> {
    if (this.cache) return this.cache;

    const row = await this.prisma.securitySettings.upsert({
      where: { id: CONFIG_ID },
      update: {},
      create: { id: CONFIG_ID },
    });
    this.cache = this.toDto(row);
    return this.cache;
  }

  async updateConfig(input: SecuritySettingsInput, updatedBy: string): Promise<SecuritySettingsDto> {
    const row = await this.prisma.securitySettings.upsert({
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

  private toDto(row: any): SecuritySettingsDto {
    return {
      passwordMinLength: row.passwordMinLength,
      passwordRequireUppercase: row.passwordRequireUppercase,
      passwordRequireNumber: row.passwordRequireNumber,
      passwordRequireSymbol: row.passwordRequireSymbol,
      mfaRequired: row.mfaRequired,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    };
  }
}
