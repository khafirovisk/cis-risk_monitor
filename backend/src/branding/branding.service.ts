import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const CONFIG_ID = 1;

export interface BrandingDto {
  accentColor: string | null;
  hasLogo: boolean;
  updatedBy: string | null;
  updatedAt: Date;
}

export interface BrandingInput {
  accentColor: string | null;
}

export interface LogoFile {
  path: string;
  mime: string;
}

function uploadsDir(): string {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
}

@Injectable()
export class BrandingService {
  private cache: BrandingDto | null = null;

  constructor(private prisma: PrismaService) {}

  async getConfig(): Promise<BrandingDto> {
    if (this.cache) return this.cache;

    const row = await this.prisma.brandingSettings.upsert({
      where: { id: CONFIG_ID },
      update: {},
      create: { id: CONFIG_ID },
    });
    this.cache = this.toDto(row);
    return this.cache;
  }

  async updateConfig(input: BrandingInput, updatedBy: string): Promise<BrandingDto> {
    const row = await this.prisma.brandingSettings.upsert({
      where: { id: CONFIG_ID },
      update: { accentColor: input.accentColor, updatedBy },
      create: { id: CONFIG_ID, accentColor: input.accentColor, updatedBy },
    });
    this.cache = this.toDto(row);
    return this.cache;
  }

  async setLogo(file: { originalname: string; mimetype: string; buffer: Buffer }, updatedBy: string): Promise<BrandingDto> {
    const dir = uploadsDir();
    await fs.mkdir(dir, { recursive: true });

    const current = await this.prisma.brandingSettings.findUnique({ where: { id: CONFIG_ID } });
    const safeName = file.originalname.replace(/[/\\]/g, '_');
    const storageKey = `branding-logo-${randomUUID()}-${safeName}`;
    await fs.writeFile(path.join(dir, storageKey), file.buffer);

    const row = await this.prisma.brandingSettings.upsert({
      where: { id: CONFIG_ID },
      update: { logoStorageKey: storageKey, logoFilename: safeName, logoMime: file.mimetype, updatedBy },
      create: { id: CONFIG_ID, logoStorageKey: storageKey, logoFilename: safeName, logoMime: file.mimetype, updatedBy },
    });

    if (current?.logoStorageKey) {
      await fs.unlink(path.join(dir, current.logoStorageKey)).catch(() => {});
    }

    this.cache = this.toDto(row);
    return this.cache;
  }

  async removeLogo(updatedBy: string): Promise<BrandingDto> {
    const current = await this.prisma.brandingSettings.findUnique({ where: { id: CONFIG_ID } });
    if (current?.logoStorageKey) {
      await fs.unlink(path.join(uploadsDir(), current.logoStorageKey)).catch(() => {});
    }

    const row = await this.prisma.brandingSettings.upsert({
      where: { id: CONFIG_ID },
      update: { logoStorageKey: null, logoFilename: null, logoMime: null, updatedBy },
      create: { id: CONFIG_ID, updatedBy },
    });
    this.cache = this.toDto(row);
    return this.cache;
  }

  async getLogoFile(): Promise<LogoFile | null> {
    const row = await this.prisma.brandingSettings.findUnique({ where: { id: CONFIG_ID } });
    if (!row?.logoStorageKey) return null;
    return { path: path.join(uploadsDir(), row.logoStorageKey), mime: row.logoMime || 'application/octet-stream' };
  }

  invalidateCache(): void {
    this.cache = null;
  }

  private toDto(row: any): BrandingDto {
    return {
      accentColor: row.accentColor,
      hasLogo: !!row.logoStorageKey,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    };
  }
}
