import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const HASH_ROUNDS = 12;
const ACCOUNT_ID = 1;

export interface LocalLoginResult {
  ok: boolean;
  reason?: 'invalid' | 'locked';
  lockedUntilMs?: number;
  mustChangePassword?: boolean;
  username?: string;
}

@Injectable()
export class LocalAdminAccountService {
  constructor(private prisma: PrismaService) {}

  async login(username: string, password: string): Promise<LocalLoginResult> {
    const account = await this.prisma.localAdminAccount.findUnique({ where: { id: ACCOUNT_ID } });
    if (!account || account.username !== username) return { ok: false, reason: 'invalid' };

    if (account.lockedUntil && account.lockedUntil.getTime() > Date.now()) {
      return { ok: false, reason: 'locked', lockedUntilMs: account.lockedUntil.getTime() };
    }

    const valid = await bcrypt.compare(password, account.passwordHash);
    if (!valid) {
      const attempts = account.failedAttempts + 1;
      const locked = attempts >= MAX_ATTEMPTS;
      const lockedUntil = locked ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null;
      await this.prisma.localAdminAccount.update({
        where: { id: ACCOUNT_ID },
        data: { failedAttempts: locked ? 0 : attempts, lockedUntil },
      });
      return locked
        ? { ok: false, reason: 'locked', lockedUntilMs: lockedUntil!.getTime() }
        : { ok: false, reason: 'invalid' };
    }

    await this.prisma.localAdminAccount.update({
      where: { id: ACCOUNT_ID },
      data: { failedAttempts: 0, lockedUntil: null },
    });

    return { ok: true, mustChangePassword: account.mustChangePassword, username: account.username };
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const account = await this.prisma.localAdminAccount.findUnique({ where: { id: ACCOUNT_ID } });
    if (!account) throw new Error('Conta local não encontrada');

    const valid = await bcrypt.compare(currentPassword, account.passwordHash);
    if (!valid) throw new Error('Senha atual incorreta');

    const passwordHash = await bcrypt.hash(newPassword, HASH_ROUNDS);
    await this.prisma.localAdminAccount.update({
      where: { id: ACCOUNT_ID },
      data: { passwordHash, mustChangePassword: false },
    });
  }
}
