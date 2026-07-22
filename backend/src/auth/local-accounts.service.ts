import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SecuritySettingsService } from './security-settings.service';
import { validatePassword } from './password-policy';

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const HASH_ROUNDS = 12;
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

function generateBackupCode(): string {
  const part = () => Array.from({ length: 4 }, () => BACKUP_CODE_ALPHABET[randomInt(BACKUP_CODE_ALPHABET.length)]).join('');
  return `${part()}-${part()}`;
}

export interface LocalLoginResult {
  ok: boolean;
  reason?: 'invalid' | 'locked';
  lockedUntilMs?: number;
  mustChangePassword?: boolean;
  mfaRequired?: boolean;
  mfaEnrollRequired?: boolean;
  id?: string;
  username?: string;
  role?: string;
}

export interface MfaEnrollment {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
}

export interface LocalAccountSummary {
  id: string;
  username: string;
  name: string | null;
  role: string;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  lockedUntil: Date | null;
  createdAt: Date;
}

export interface CreateLocalAccountInput {
  username: string;
  name?: string;
  role: string;
  password: string;
}

@Injectable()
export class LocalAccountsService {
  constructor(
    private prisma: PrismaService,
    private security: SecuritySettingsService,
  ) {}

  async login(username: string, password: string): Promise<LocalLoginResult> {
    const account = await this.prisma.localAccount.findUnique({ where: { username } });
    if (!account) return { ok: false, reason: 'invalid' };

    if (account.lockedUntil && account.lockedUntil.getTime() > Date.now()) {
      return { ok: false, reason: 'locked', lockedUntilMs: account.lockedUntil.getTime() };
    }

    const valid = await bcrypt.compare(password, account.passwordHash);
    if (!valid) return this.registerFailedAttempt(account);

    await this.prisma.localAccount.update({
      where: { id: account.id },
      data: { failedAttempts: 0, lockedUntil: null },
    });

    if (account.mfaEnabled) {
      return { ok: true, mfaRequired: true, id: account.id };
    }

    const settings = await this.security.getConfig();
    return {
      ok: true,
      mustChangePassword: account.mustChangePassword,
      mfaEnrollRequired: settings.mfaRequired,
      id: account.id,
      username: account.username,
      role: account.role,
    };
  }

  private async registerFailedAttempt(account: { id: string; failedAttempts: number }): Promise<LocalLoginResult> {
    const attempts = account.failedAttempts + 1;
    const locked = attempts >= MAX_ATTEMPTS;
    const lockedUntil = locked ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null;
    await this.prisma.localAccount.update({
      where: { id: account.id },
      data: { failedAttempts: locked ? 0 : attempts, lockedUntil },
    });
    return locked
      ? { ok: false, reason: 'locked', lockedUntilMs: lockedUntil!.getTime() }
      : { ok: false, reason: 'invalid' };
  }

  async changePassword(accountId: string, currentPassword: string, newPassword: string): Promise<void> {
    const account = await this.prisma.localAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new Error('Conta local não encontrada');

    const valid = await bcrypt.compare(currentPassword, account.passwordHash);
    if (!valid) throw new Error('Senha atual incorreta');

    const policy = await this.security.getConfig();
    const policyError = validatePassword(newPassword, policy);
    if (policyError) throw new Error(policyError);

    const passwordHash = await bcrypt.hash(newPassword, HASH_ROUNDS);
    await this.prisma.localAccount.update({
      where: { id: accountId },
      data: { passwordHash, mustChangePassword: false },
    });
  }

  list(): Promise<LocalAccountSummary[]> {
    return this.prisma.localAccount.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, username: true, name: true, role: true,
        mustChangePassword: true, mfaEnabled: true, lockedUntil: true, createdAt: true,
      },
    });
  }

  async create(input: CreateLocalAccountInput): Promise<LocalAccountSummary> {
    const policy = await this.security.getConfig();
    const policyError = validatePassword(input.password, policy);
    if (policyError) throw new Error(policyError);

    const passwordHash = await bcrypt.hash(input.password, HASH_ROUNDS);
    const account = await this.prisma.localAccount.create({
      data: {
        username: input.username,
        name: input.name || null,
        role: input.role as any,
        passwordHash,
        mustChangePassword: true,
      },
    });
    return {
      id: account.id,
      username: account.username,
      name: account.name,
      role: account.role,
      mustChangePassword: account.mustChangePassword,
      mfaEnabled: account.mfaEnabled,
      lockedUntil: account.lockedUntil,
      createdAt: account.createdAt,
    };
  }

  async verifyMfaLogin(accountId: string, token: string): Promise<LocalLoginResult> {
    const account = await this.prisma.localAccount.findUnique({ where: { id: accountId } });
    if (!account) return { ok: false, reason: 'invalid' };

    if (account.lockedUntil && account.lockedUntil.getTime() > Date.now()) {
      return { ok: false, reason: 'locked', lockedUntilMs: account.lockedUntil.getTime() };
    }

    if (typeof token !== 'string' || !token) {
      return this.registerFailedAttempt(account);
    }

    const validTotp = account.mfaSecret ? authenticator.check(token, account.mfaSecret) : false;
    const matchedHash = validTotp ? null : await this.matchBackupCode(account.mfaBackupCodes, token);
    if (!validTotp && !matchedHash) return this.registerFailedAttempt(account);

    if (matchedHash) {
      // Optimistic-concurrency guard: only succeed if the code is still present
      // in the DB row at write time, so two concurrent requests presenting the
      // same backup code can't both redeem it.
      const result = await this.prisma.localAccount.updateMany({
        where: { id: account.id, mfaBackupCodes: { has: matchedHash } },
        data: {
          failedAttempts: 0,
          lockedUntil: null,
          mfaBackupCodes: account.mfaBackupCodes.filter((c: string) => c !== matchedHash),
        },
      });
      if (result.count === 0) {
        // Lost the race — someone else already consumed this code between our
        // read and write. Don't penalize failedAttempts for this.
        return { ok: false, reason: 'invalid' };
      }
    } else {
      await this.prisma.localAccount.update({
        where: { id: account.id },
        data: { failedAttempts: 0, lockedUntil: null },
      });
    }

    return {
      ok: true,
      mustChangePassword: account.mustChangePassword,
      id: account.id,
      username: account.username,
      role: account.role,
    };
  }

  private async matchBackupCode(hashedCodes: string[], candidate: string): Promise<string | null> {
    for (const hash of hashedCodes) {
      if (await bcrypt.compare(candidate, hash)) return hash;
    }
    return null;
  }

  async startMfaEnrollment(accountId: string): Promise<MfaEnrollment> {
    const account = await this.prisma.localAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new Error('Conta local não encontrada');

    if (account.mfaEnabled) {
      throw new Error('MFA já habilitado nesta conta. Peça a um administrador para resetar antes de reconfigurar.');
    }

    const secret = authenticator.generateSecret();
    await this.prisma.localAccount.update({ where: { id: accountId }, data: { mfaSecret: secret } });

    const otpauthUrl = authenticator.keyuri(account.username, 'Sentinela CIS', secret);
    const qrDataUrl = await qrcode.toDataURL(otpauthUrl);
    return { secret, otpauthUrl, qrDataUrl };
  }

  async confirmMfaEnrollment(accountId: string, token: string): Promise<string[]> {
    const account = await this.prisma.localAccount.findUnique({ where: { id: accountId } });
    if (!account || !account.mfaSecret) throw new Error('Nenhum cadastro de MFA pendente para esta conta');

    if (typeof token !== 'string' || !token) throw new Error('Código inválido');
    if (!authenticator.check(token, account.mfaSecret)) throw new Error('Código inválido');

    const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, generateBackupCode);
    const hashedCodes = await Promise.all(backupCodes.map((c) => bcrypt.hash(c, HASH_ROUNDS)));

    await this.prisma.localAccount.update({
      where: { id: accountId },
      data: { mfaEnabled: true, mfaBackupCodes: hashedCodes },
    });

    return backupCodes;
  }

  async resetMfa(accountId: string): Promise<void> {
    await this.prisma.localAccount.update({
      where: { id: accountId },
      data: { mfaEnabled: false, mfaSecret: null, mfaBackupCodes: [] },
    });
  }
}
