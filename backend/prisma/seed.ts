import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

type SG = {
  id: string; asset: string; func: string; title: string; title_pt: string;
  desc: string; igs: string[]; q: string; ex: string[]; evd: string;
};
type Ctrl = { num: number; title: string; title_pt: string; desc: string; desc_pt: string; safeguards: SG[] };

async function main() {
  const data: Ctrl[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'cis_full.json'), 'utf-8'),
  );

  const fw = await prisma.framework.upsert({
    where: { code: 'CIS' },
    update: { name: 'CIS Controls', version: '8.1.2' },
    create: { code: 'CIS', name: 'CIS Controls', version: '8.1.2' },
  });

  for (const c of data) {
    const control = await prisma.control.upsert({
      where: { frameworkId_number: { frameworkId: fw.id, number: c.num } },
      update: { titleEn: c.title, titlePt: c.title_pt, descPt: c.desc_pt },
      create: {
        frameworkId: fw.id,
        number: c.num,
        titleEn: c.title,
        titlePt: c.title_pt,
        descPt: c.desc_pt,
      },
    });

    for (const s of c.safeguards) {
      await prisma.safeguard.upsert({
        where: { code: s.id },
        update: {
          titleEn: s.title, titlePt: s.title_pt, descriptionEn: s.desc,
          questionPt: s.q, examplesPt: s.ex, evidenceHintPt: s.evd,
          assetClass: s.asset, securityFunction: s.func,
          ig1: s.igs.includes('IG1'), ig2: s.igs.includes('IG2'), ig3: s.igs.includes('IG3'),
        },
        create: {
          controlId: control.id,
          code: s.id,
          titleEn: s.title, titlePt: s.title_pt, descriptionEn: s.desc,
          questionPt: s.q, examplesPt: s.ex, evidenceHintPt: s.evd,
          assetClass: s.asset, securityFunction: s.func,
          ig1: s.igs.includes('IG1'), ig2: s.igs.includes('IG2'), ig3: s.igs.includes('IG3'),
        },
      });
    }
  }

  const samlEntryPoint = process.env.SAML_ENTRY_POINT;
  await prisma.samlConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      enabled: Boolean(samlEntryPoint),
      entryPoint: samlEntryPoint || null,
      issuer: process.env.SAML_ISSUER || 'sentinela-cis',
      callbackUrl: process.env.SAML_CALLBACK_URL || null,
      idpCert: process.env.SAML_IDP_CERT || null,
      wantAssertionsSigned: true,
    },
  });

  const existingAdmin = await prisma.localAccount.findUnique({ where: { username: 'admin' } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('admin', 12);
    await prisma.localAccount.create({
      data: { username: 'admin', role: 'ADMIN', passwordHash, mustChangePassword: true },
    });
    console.log('Conta local de emergência criada: admin / admin (troca de senha obrigatória no 1º login).');
  }

  await prisma.securitySettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  const total = await prisma.safeguard.count();
  console.log(`Seed concluído: ${data.length} controles, ${total} salvaguardas.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
