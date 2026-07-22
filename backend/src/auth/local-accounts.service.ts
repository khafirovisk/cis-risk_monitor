import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { SecuritySettingsService } from './security-settings.service';
import { validatePassword } from './password-policy';

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const HASH_ROUNDS = 12;

export interface LocalLoginResult {
  ok: boolean;
  reason?: 'invalid' | 'locked';
  lockedUntilMs?: number;
  mustChangePassword?: boolean;
  id?: string;
  username?: string;
  role?: string;
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

    return {
      ok: true,
      mustChangePassword: account.mustChangePassword,
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
}
