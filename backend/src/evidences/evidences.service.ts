import { Injectable } from '@nestjs/common';
import { Evidence } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

function uploadsDir() {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
}

@Injectable()
export class EvidencesService {
  constructor(private prisma: PrismaService) {}

  async saveMany(itemId: string, files: Express.Multer.File[], uploadedBy?: string) {
    const dir = uploadsDir();
    await fs.mkdir(dir, { recursive: true });
    const created: Evidence[] = [];
    for (const file of files) {
      const safeName = file.originalname.replace(/[/\\]/g, '_');
      const storageKey = `${randomUUID()}-${safeName}`;
      await fs.writeFile(path.join(dir, storageKey), file.buffer);
      created.push(
        await this.prisma.evidence.create({
          data: {
            itemId,
            filename: safeName,
            storageKey,
            mime: file.mimetype,
            size: file.size,
            uploadedBy,
          },
        }),
      );
    }
    return created;
  }

  findOne(id: string) {
    return this.prisma.evidence.findUnique({ where: { id } });
  }

  filePath(evidence: { storageKey: string }) {
    return path.join(uploadsDir(), evidence.storageKey);
  }

  async remove(evidence: { id: string; storageKey: string }) {
    await fs.unlink(this.filePath(evidence)).catch(() => {});
    await this.prisma.evidence.delete({ where: { id: evidence.id } });
  }
}
