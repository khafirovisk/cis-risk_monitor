# Contas locais multiusuário + Configurações de Segurança + MFA TOTP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the single-row `LocalAdminAccount` emergency account into a real multi-user local-accounts table, add an admin-configurable password policy + mandatory-MFA flag ("Segurança"), and implement TOTP MFA (enrollment + login verification) for local accounts.

**Architecture:** Rename `LocalAdminAccount` → `LocalAccount` (data preserved via hand-written migration), add a `SecuritySettings` singleton mirroring the existing `SamlConfig` cache pattern, extend the local-login flow to branch on MFA state exactly the way it already branches on `mustChangePassword` today (same guard, same `ProtectedRoute` redirect pattern). Backend first (schema → security settings → account CRUD → TOTP), then frontend.

**Tech Stack:** NestJS 10 + Prisma 5 + Postgres (backend), React 18 + Vite + TypeScript (frontend), `otplib` + `qrcode` (new deps, TOTP generation/verification + QR rendering), `bcryptjs` (already used).

## Global Constraints

- Password hashing: `bcrypt`, cost `12` (matches existing `HASH_ROUNDS` in the current service).
- Local-account lockout: 5 failed attempts → 15 minute lock (matches existing `MAX_ATTEMPTS`/`LOCK_MINUTES`). The **same** counter/lock fields cover both password and TOTP failures — no separate MFA-attempt counter.
- New local accounts always start with `mustChangePassword: true`, `mfaEnabled: false`, default `role: AUDITOR` (admin can pick a different role at creation time).
- Precedence when both are pending: `mustChangePassword` blocks **before** `mfaEnrollRequired` — a brand-new account with global MFA-required must finish changing its password first, then gets sent to MFA enrollment. Both `AuthenticatedGuard` and `ProtectedRoute` must check in that order.
- MFA is local-accounts only — SAML/SSO users are entirely out of scope for this plan.
- Backup codes: 10 per account, generated only at successful MFA enrollment confirmation, returned in plaintext exactly once in the API response, stored as bcrypt hashes (never plaintext) from then on.
- No password expiration/history, no self-service MFA disable, no edit/delete of local accounts — all explicitly out of scope per the spec (`docs/superpowers/specs/2026-07-22-local-accounts-security-mfa-design.md`).
- Backend tests follow the codebase's existing plain-instantiation pattern: `new SomeService(mockPrisma)` / `new SomeController(mockService)` with `jest.fn()` — no NestJS `TestingModule` bootstrap anywhere in this codebase, don't introduce one.
- Frontend has no test framework — verification is `cd frontend && npx tsc` (only the pre-existing `client.ts(1,26)` `ImportMeta.env` error is expected) plus a Playwright/manual visual check.
- After any backend change: `docker compose build api && docker compose up -d api` (the container does not hot-reload). After any frontend change: `docker compose build web && docker compose up -d web`. Always `cd` to the absolute worktree path first — running `docker compose` from the sibling `main` checkout creates a stray, broken Compose project.

---

### Task 1: Schema — `LocalAccount` + `SecuritySettings`

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260722120000_local_accounts_security/migration.sql`
- Modify: `backend/prisma/seed.ts`
- Modify: `CLAUDE.md` (admin password-reset procedure references `LocalAdminAccount`/`id=1`)

**Interfaces:**
- Produces: Prisma models `LocalAccount` (replaces `LocalAdminAccount`) and `SecuritySettings`, and the regenerated `@prisma/client` types `Prisma.LocalAccount`/`Prisma.SecuritySettings` that later tasks depend on via `this.prisma.localAccount.*` / `this.prisma.securitySettings.*`.

- [ ] **Step 1: Update `schema.prisma`**

Replace the `LocalAdminAccount` model and add `SecuritySettings`:

```prisma
model LocalAccount {
  id                 String    @id @default(cuid())
  username           String    @unique
  name               String?
  role               Role      @default(AUDITOR)
  passwordHash       String
  mustChangePassword Boolean   @default(true)
  failedAttempts     Int       @default(0)
  lockedUntil        DateTime?
  mfaEnabled         Boolean   @default(false)
  mfaSecret          String?
  mfaBackupCodes     String[]  @default([])
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
}

model SecuritySettings {
  id                       Int      @id @default(1)
  passwordMinLength        Int      @default(8)
  passwordRequireUppercase Boolean  @default(false)
  passwordRequireNumber    Boolean  @default(false)
  passwordRequireSymbol    Boolean  @default(false)
  mfaRequired              Boolean  @default(false)
  updatedBy                String?
  updatedAt                DateTime @updatedAt
}
```

Remove the old:

```prisma
model LocalAdminAccount {
  id                 Int       @id @default(1)
  username           String    @unique @default("admin")
  passwordHash       String
  mustChangePassword Boolean   @default(true)
  failedAttempts     Int       @default(0)
  lockedUntil        DateTime?
  updatedAt          DateTime  @updatedAt
}
```

- [ ] **Step 2: Write the hand-authored migration**

Create `backend/prisma/migrations/20260722120000_local_accounts_security/migration.sql` (directory name must sort after the existing `20260721180209_saml_config_local_admin` one):

```sql
-- Rename LocalAdminAccount -> LocalAccount, migrate id to TEXT, add MFA/role columns
ALTER TABLE "LocalAdminAccount" RENAME TO "LocalAccount";
ALTER TABLE "LocalAccount" RENAME CONSTRAINT "LocalAdminAccount_pkey" TO "LocalAccount_pkey";
ALTER INDEX "LocalAdminAccount_username_key" RENAME TO "LocalAccount_username_key";

ALTER TABLE "LocalAccount" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "LocalAccount" ALTER COLUMN "id" TYPE TEXT USING "id"::TEXT;
ALTER TABLE "LocalAccount" ALTER COLUMN "username" DROP DEFAULT;

ALTER TABLE "LocalAccount" ADD COLUMN "name" TEXT;
ALTER TABLE "LocalAccount" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'AUDITOR';
ALTER TABLE "LocalAccount" ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LocalAccount" ADD COLUMN "mfaSecret" TEXT;
ALTER TABLE "LocalAccount" ADD COLUMN "mfaBackupCodes" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "LocalAccount" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "LocalAccount" SET "role" = 'ADMIN' WHERE "username" = 'admin';

-- CreateTable
CREATE TABLE "SecuritySettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "passwordMinLength" INTEGER NOT NULL DEFAULT 8,
    "passwordRequireUppercase" BOOLEAN NOT NULL DEFAULT false,
    "passwordRequireNumber" BOOLEAN NOT NULL DEFAULT false,
    "passwordRequireSymbol" BOOLEAN NOT NULL DEFAULT false,
    "mfaRequired" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecuritySettings_pkey" PRIMARY KEY ("id")
);
```

- [ ] **Step 3: Regenerate the Prisma client and verify the migration applies**

Run (from `backend/`, container must be up — `cd .. && docker compose up -d postgres` first if it isn't):

```bash
cd backend
npx prisma generate
npx prisma migrate deploy
```

Expected: `SecuritySettings` created, `LocalAdminAccount` gone, `LocalAccount` present with the existing `admin` row intact (verify with `docker exec -it saml-local-auth-postgres-1 psql -U postgres -d sentinela -c 'SELECT id, username, role FROM "LocalAccount";'` — should show the `admin` row with `role = ADMIN` and a non-numeric `id`. If the DB/container names differ, check `docker compose ps`.)

If `prisma migrate deploy` reports drift (because a local dev DB already has the old shape applied via `migrate dev` some other way), reconcile with `npx prisma migrate resolve --applied 20260722120000_local_accounts_security` per the existing pattern noted in `CLAUDE.md`'s SAML migration entry — do not `migrate reset`, it would wipe assessment/risk data already in the dev DB.

- [ ] **Step 4: Update `backend/prisma/seed.ts`**

Replace the `localAdminAccount` block:

```ts
  const existingAdmin = await prisma.localAdminAccount.findUnique({ where: { id: 1 } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('admin', 12);
    await prisma.localAdminAccount.create({
      data: { id: 1, username: 'admin', passwordHash, mustChangePassword: true },
    });
    console.log('Conta local de emergência criada: admin / admin (troca de senha obrigatória no 1º login).');
  }
```

with:

```ts
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
```

- [ ] **Step 5: Update `CLAUDE.md`'s admin password-reset procedure**

Find the bullet describing the manual SQL reset procedure (mentions `LocalAdminAccount` and `id=1`). Update the `UPDATE` statement text to:

```sql
UPDATE "LocalAccount" SET "passwordHash"='<hash>', "mustChangePassword"=true, "failedAttempts"=0, "lockedUntil"=NULL WHERE username='admin';
```

Keep the rest of the surrounding warning text (never interpolate the bcrypt hash into a shell string) unchanged.

- [ ] **Step 6: Run the seed against the dev DB and commit**

```bash
cd backend && npm run seed
```

Expected: no errors; either the "Conta local de emergência criada" line is skipped (already exists) or printed once.

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260722120000_local_accounts_security backend/prisma/seed.ts CLAUDE.md
git commit -m "feat(db): rename LocalAdminAccount to LocalAccount, add SecuritySettings"
```

---

### Task 2: `SecuritySettingsService` + `SecurityController`

**Files:**
- Create: `backend/src/auth/security-settings.service.ts`
- Create: `backend/src/auth/security-settings.service.spec.ts`
- Create: `backend/src/auth/security-settings.controller.ts`
- Create: `backend/src/auth/security-settings.controller.spec.ts`
- Modify: `backend/src/auth/auth.module.ts`

**Interfaces:**
- Consumes: `PrismaService` (from `../prisma/prisma.service`), `AuthenticatedGuard`/`RolesGuard`/`Roles` (from `./authenticated.guard`, `./roles.guard`, `./roles.decorator` — unchanged, existing).
- Produces: `SecuritySettingsDto`/`SecuritySettingsInput` types and `SecuritySettingsService.getConfig(): Promise<SecuritySettingsDto>` / `.updateConfig(input: SecuritySettingsInput, updatedBy: string): Promise<SecuritySettingsDto>` — Task 3's password-policy validator and Task 3/6's `LocalAccountsService` both depend on `getConfig()`'s return shape.

- [ ] **Step 1: Create `security-settings.service.ts`**

Mirrors `saml-config.service.ts`'s cache pattern exactly:

```ts
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
```

- [ ] **Step 2: Write `security-settings.service.spec.ts`**

```ts
import { SecuritySettingsService } from './security-settings.service';

function makeRow(overrides: Partial<any> = {}) {
  return {
    id: 1,
    passwordMinLength: 8,
    passwordRequireUppercase: false,
    passwordRequireNumber: false,
    passwordRequireSymbol: false,
    mfaRequired: false,
    updatedBy: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('SecuritySettingsService', () => {
  let prisma: any;
  let service: SecuritySettingsService;

  beforeEach(() => {
    prisma = { securitySettings: { upsert: jest.fn().mockResolvedValue(makeRow()) } };
    service = new SecuritySettingsService(prisma);
  });

  it('cria a config default na primeira leitura e cacheia', async () => {
    const first = await service.getConfig();
    const second = await service.getConfig();
    expect(first.passwordMinLength).toBe(8);
    expect(prisma.securitySettings.upsert).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('updateConfig persiste e invalida o cache anterior', async () => {
    await service.getConfig();
    prisma.securitySettings.upsert.mockResolvedValue(makeRow({ mfaRequired: true, updatedBy: 'admin' }));

    const updated = await service.updateConfig(
      {
        passwordMinLength: 10,
        passwordRequireUppercase: true,
        passwordRequireNumber: true,
        passwordRequireSymbol: false,
        mfaRequired: true,
      },
      'admin',
    );

    expect(updated.mfaRequired).toBe(true);
    expect(prisma.securitySettings.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: expect.objectContaining({ mfaRequired: true, updatedBy: 'admin' }),
      create: expect.objectContaining({ id: 1, mfaRequired: true, updatedBy: 'admin' }),
    });
  });

  it('invalidateCache força nova leitura do banco', async () => {
    await service.getConfig();
    service.invalidateCache();
    await service.getConfig();
    expect(prisma.securitySettings.upsert).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 3: Create `security-settings.controller.ts`**

Mirrors `saml-config.controller.ts`:

```ts
import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedGuard } from './authenticated.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { SecuritySettingsService, SecuritySettingsInput } from './security-settings.service';

@Controller('security-settings')
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles('ADMIN')
export class SecurityController {
  constructor(private svc: SecuritySettingsService) {}

  @Get()
  get() {
    return this.svc.getConfig();
  }

  @Put()
  update(@Body() body: SecuritySettingsInput, @Req() req: Request) {
    return this.svc.updateConfig(body, (req.user as any)?.email || (req.user as any)?.username);
  }
}
```

- [ ] **Step 4: Write `security-settings.controller.spec.ts`**

```ts
import { SecurityController } from './security-settings.controller';

describe('SecurityController', () => {
  it('get delega ao service', () => {
    const svc: any = { getConfig: jest.fn().mockResolvedValue({ passwordMinLength: 8 }) };
    const controller = new SecurityController(svc);
    expect(controller.get()).resolves.toEqual({ passwordMinLength: 8 });
    expect(svc.getConfig).toHaveBeenCalled();
  });

  it('update usa o email da sessão como updatedBy quando presente', async () => {
    const svc: any = { updateConfig: jest.fn().mockResolvedValue({}) };
    const controller = new SecurityController(svc);
    const body: any = { passwordMinLength: 10, passwordRequireUppercase: true, passwordRequireNumber: false, passwordRequireSymbol: false, mfaRequired: true };
    const req: any = { user: { email: 'ana@empresa.com' } };

    await controller.update(body, req);

    expect(svc.updateConfig).toHaveBeenCalledWith(body, 'ana@empresa.com');
  });

  it('update usa o username quando não há email (conta local)', async () => {
    const svc: any = { updateConfig: jest.fn().mockResolvedValue({}) };
    const controller = new SecurityController(svc);
    const body: any = { passwordMinLength: 8, passwordRequireUppercase: false, passwordRequireNumber: false, passwordRequireSymbol: false, mfaRequired: false };
    const req: any = { user: { username: 'admin' } };

    await controller.update(body, req);

    expect(svc.updateConfig).toHaveBeenCalledWith(body, 'admin');
  });
});
```

- [ ] **Step 5: Wire into `auth.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { SamlConfigController } from './saml-config.controller';
import { SecurityController } from './security-settings.controller';
import { SessionSerializer } from './session.serializer';
import { AuthenticatedGuard } from './authenticated.guard';
import { RolesGuard } from './roles.guard';
import { SamlConfigService } from './saml-config.service';
import { SecuritySettingsService } from './security-settings.service';
import { LocalAdminAccountService } from './local-admin-account.service';

@Module({
  imports: [PassportModule.register({ session: true })],
  controllers: [AuthController, SamlConfigController, SecurityController],
  providers: [SessionSerializer, AuthenticatedGuard, RolesGuard, SamlConfigService, SecuritySettingsService, LocalAdminAccountService],
  exports: [AuthenticatedGuard, RolesGuard],
})
export class AuthModule {}
```

(`LocalAdminAccountService` stays untouched here — Task 3 renames it. Keeping the rename isolated to Task 3 keeps this task's diff focused on the new security-settings pieces only.)

- [ ] **Step 6: Run tests, rebuild, verify, commit**

```bash
cd backend && npm test
```
Expected: all tests pass, including the new `security-settings.service.spec.ts` and `security-settings.controller.spec.ts`.

```bash
cd .. && docker compose build api && docker compose up -d api
curl -s -X GET http://localhost:8080/api/security-settings
```
Expected (dev bypass active, fake ADMIN user): a JSON body with `passwordMinLength: 8, mfaRequired: false, ...`.

```bash
git add backend/src/auth/security-settings.service.ts backend/src/auth/security-settings.service.spec.ts backend/src/auth/security-settings.controller.ts backend/src/auth/security-settings.controller.spec.ts backend/src/auth/auth.module.ts
git commit -m "feat(security): add SecuritySettings service + admin-only endpoint"
```

---

### Task 3: `LocalAccountsService` (multi-account) + `LocalAccountsController` + `AuthController` wiring

**Files:**
- Create: `backend/src/auth/password-policy.ts`
- Create: `backend/src/auth/password-policy.spec.ts`
- Create: `backend/src/auth/local-accounts.service.ts` (replaces `local-admin-account.service.ts`)
- Create: `backend/src/auth/local-accounts.service.spec.ts` (replaces `local-admin-account.service.spec.ts`)
- Delete: `backend/src/auth/local-admin-account.service.ts`, `backend/src/auth/local-admin-account.service.spec.ts`
- Create: `backend/src/auth/local-accounts.controller.ts`
- Create: `backend/src/auth/local-accounts.controller.spec.ts`
- Modify: `backend/src/auth/auth.controller.ts`
- Modify: `backend/src/auth/auth.controller.spec.ts`
- Modify: `backend/src/auth/auth.module.ts`

**Interfaces:**
- Consumes: `SecuritySettingsService.getConfig()` (Task 2, returns `SecuritySettingsDto` with `passwordMinLength`/`passwordRequireUppercase`/`passwordRequireNumber`/`passwordRequireSymbol`).
- Produces: `LocalAccountsService.login(username, password): Promise<LocalLoginResult>`, `.changePassword(accountId, currentPassword, newPassword): Promise<void>`, `.list(): Promise<LocalAccountSummary[]>`, `.create(input): Promise<LocalAccountSummary>` — Task 6 (TOTP) extends this same class and this same `LocalLoginResult` shape (adding `mfaRequired`/`mfaEnrollRequired` fields on top of what's defined here). `validatePassword(password, policy): string | null` from `password-policy.ts` — Task 6 reuses this for MFA-unrelated password checks (it doesn't need to touch it).

- [ ] **Step 1: Create `password-policy.ts`**

```ts
import { SecuritySettingsDto } from './security-settings.service';

export function validatePassword(password: string, policy: SecuritySettingsDto): string | null {
  if (password.length < policy.passwordMinLength) {
    return `A senha precisa ter ao menos ${policy.passwordMinLength} caracteres.`;
  }
  if (policy.passwordRequireUppercase && !/[A-Z]/.test(password)) {
    return 'A senha precisa ter ao menos uma letra maiúscula.';
  }
  if (policy.passwordRequireNumber && !/[0-9]/.test(password)) {
    return 'A senha precisa ter ao menos um número.';
  }
  if (policy.passwordRequireSymbol && !/[^A-Za-z0-9]/.test(password)) {
    return 'A senha precisa ter ao menos um símbolo.';
  }
  return null;
}
```

- [ ] **Step 2: Write `password-policy.spec.ts`**

```ts
import { validatePassword } from './password-policy';

const BASE_POLICY = {
  passwordMinLength: 8,
  passwordRequireUppercase: false,
  passwordRequireNumber: false,
  passwordRequireSymbol: false,
  mfaRequired: false,
  updatedBy: null,
  updatedAt: new Date(),
};

describe('validatePassword', () => {
  it('aceita senha que cumpre a política default', () => {
    expect(validatePassword('12345678', BASE_POLICY)).toBeNull();
  });

  it('rejeita senha menor que o tamanho mínimo', () => {
    expect(validatePassword('123', BASE_POLICY)).toMatch(/ao menos 8 caracteres/);
  });

  it('rejeita sem maiúscula quando exigido', () => {
    expect(validatePassword('abcdefgh', { ...BASE_POLICY, passwordRequireUppercase: true })).toMatch(/maiúscula/);
  });

  it('rejeita sem número quando exigido', () => {
    expect(validatePassword('Abcdefgh', { ...BASE_POLICY, passwordRequireNumber: true })).toMatch(/número/);
  });

  it('rejeita sem símbolo quando exigido', () => {
    expect(validatePassword('Abcdefg1', { ...BASE_POLICY, passwordRequireSymbol: true })).toMatch(/símbolo/);
  });

  it('aceita senha que cumpre todas as regras simultaneamente', () => {
    expect(validatePassword('Abcdefg1!', { ...BASE_POLICY, passwordRequireUppercase: true, passwordRequireNumber: true, passwordRequireSymbol: true })).toBeNull();
  });
});
```

- [ ] **Step 3: Delete the old service + its spec**

```bash
git rm backend/src/auth/local-admin-account.service.ts backend/src/auth/local-admin-account.service.spec.ts
```

- [ ] **Step 4: Create `local-accounts.service.ts`**

```ts
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
```

- [ ] **Step 5: Write `local-accounts.service.spec.ts`**

```ts
import * as bcrypt from 'bcryptjs';
import { LocalAccountsService } from './local-accounts.service';

function makeAccount(overrides: Partial<any> = {}) {
  return {
    id: 'acc-1',
    username: 'admin',
    name: null,
    role: 'ADMIN',
    passwordHash: bcrypt.hashSync('admin', 4),
    mustChangePassword: true,
    failedAttempts: 0,
    lockedUntil: null,
    mfaEnabled: false,
    mfaSecret: null,
    mfaBackupCodes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const DEFAULT_POLICY = {
  passwordMinLength: 8,
  passwordRequireUppercase: false,
  passwordRequireNumber: false,
  passwordRequireSymbol: false,
  mfaRequired: false,
  updatedBy: null,
  updatedAt: new Date(),
};

describe('LocalAccountsService', () => {
  let prisma: any;
  let security: any;
  let service: LocalAccountsService;

  beforeEach(() => {
    prisma = {
      localAccount: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };
    security = { getConfig: jest.fn().mockResolvedValue(DEFAULT_POLICY) };
    service = new LocalAccountsService(prisma, security);
  });

  it('rejeita usuário inexistente', async () => {
    prisma.localAccount.findUnique.mockResolvedValue(null);
    const result = await service.login('ninguem', 'x');
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('aceita login correto e retorna id/username/role/mustChangePassword', async () => {
    prisma.localAccount.findUnique.mockResolvedValue(makeAccount());
    const result = await service.login('admin', 'admin');
    expect(result).toEqual({ ok: true, mustChangePassword: true, id: 'acc-1', username: 'admin', role: 'ADMIN' });
    expect(prisma.localAccount.update).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { failedAttempts: 0, lockedUntil: null },
    });
  });

  it('bloqueia após a 5ª tentativa errada', async () => {
    prisma.localAccount.findUnique.mockResolvedValue(makeAccount({ failedAttempts: 4 }));
    const result = await service.login('admin', 'senha-errada');
    expect(result.reason).toBe('locked');
    expect(prisma.localAccount.update).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: expect.objectContaining({ failedAttempts: 0, lockedUntil: expect.any(Date) }),
    });
  });

  it('recusa login enquanto a conta estiver bloqueada', async () => {
    prisma.localAccount.findUnique.mockResolvedValue(makeAccount({ lockedUntil: new Date(Date.now() + 60_000) }));
    const result = await service.login('admin', 'admin');
    expect(result.reason).toBe('locked');
    expect(prisma.localAccount.update).not.toHaveBeenCalled();
  });

  it('troca de senha exige a senha atual correta', async () => {
    prisma.localAccount.findUnique.mockResolvedValue(makeAccount());
    await expect(service.changePassword('acc-1', 'errada', 'nova12345')).rejects.toThrow('Senha atual incorreta');
  });

  it('troca de senha valida a política antes de gravar', async () => {
    prisma.localAccount.findUnique.mockResolvedValue(makeAccount());
    security.getConfig.mockResolvedValue({ ...DEFAULT_POLICY, passwordMinLength: 20 });
    await expect(service.changePassword('acc-1', 'admin', 'curta')).rejects.toThrow(/ao menos 20 caracteres/);
    expect(prisma.localAccount.update).not.toHaveBeenCalled();
  });

  it('troca de senha zera mustChangePassword quando válida', async () => {
    prisma.localAccount.findUnique.mockResolvedValue(makeAccount());
    await service.changePassword('acc-1', 'admin', 'nova12345');
    expect(prisma.localAccount.update).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { passwordHash: expect.any(String), mustChangePassword: false },
    });
  });

  it('list retorna só os campos públicos ordenados por criação', async () => {
    prisma.localAccount.findMany.mockResolvedValue([]);
    await service.list();
    expect(prisma.localAccount.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, username: true, name: true, role: true,
        mustChangePassword: true, mfaEnabled: true, lockedUntil: true, createdAt: true,
      },
    });
  });

  it('create valida a política de senha antes de criar', async () => {
    security.getConfig.mockResolvedValue({ ...DEFAULT_POLICY, passwordMinLength: 20 });
    await expect(
      service.create({ username: 'novo', role: 'AUDITOR', password: 'curta' }),
    ).rejects.toThrow(/ao menos 20 caracteres/);
    expect(prisma.localAccount.create).not.toHaveBeenCalled();
  });

  it('create grava com mustChangePassword true e retorna o resumo', async () => {
    prisma.localAccount.create.mockResolvedValue(makeAccount({ id: 'acc-2', username: 'novo', role: 'AUDITOR', mustChangePassword: true }));
    const result = await service.create({ username: 'novo', role: 'AUDITOR', password: 'senha1234' });
    expect(prisma.localAccount.create).toHaveBeenCalledWith({
      data: { username: 'novo', name: null, role: 'AUDITOR', passwordHash: expect.any(String), mustChangePassword: true },
    });
    expect(result).toEqual(expect.objectContaining({ id: 'acc-2', username: 'novo', role: 'AUDITOR' }));
  });
});
```

- [ ] **Step 6: Run new tests before wiring the controller**

```bash
cd backend && npm test -- password-policy local-accounts.service
```
Expected: all new tests pass.

- [ ] **Step 7: Create `local-accounts.controller.ts`**

```ts
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedGuard } from './authenticated.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { LocalAccountsService, CreateLocalAccountInput } from './local-accounts.service';

@Controller('local-accounts')
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles('ADMIN')
export class LocalAccountsController {
  constructor(private svc: LocalAccountsService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Post()
  create(@Body() body: CreateLocalAccountInput) {
    return this.svc.create(body);
  }
}
```

- [ ] **Step 8: Write `local-accounts.controller.spec.ts`**

```ts
import { LocalAccountsController } from './local-accounts.controller';

describe('LocalAccountsController', () => {
  it('list delega ao service', async () => {
    const svc: any = { list: jest.fn().mockResolvedValue([]) };
    const controller = new LocalAccountsController(svc);
    await controller.list();
    expect(svc.list).toHaveBeenCalled();
  });

  it('create delega ao service com o body recebido', async () => {
    const svc: any = { create: jest.fn().mockResolvedValue({ id: 'acc-2' }) };
    const controller = new LocalAccountsController(svc);
    const body = { username: 'novo', role: 'AUDITOR', password: 'senha1234' };

    await controller.create(body);

    expect(svc.create).toHaveBeenCalledWith(body);
  });
});
```

- [ ] **Step 9: Update `auth.controller.ts`**

Replace the import and constructor:

```ts
import { LocalAdminAccountService } from './local-admin-account.service';
```
→
```ts
import { LocalAccountsService } from './local-accounts.service';
```

```ts
  constructor(
    private prisma: PrismaService,
    private samlConfig: SamlConfigService,
    private localAdmin: LocalAdminAccountService,
  ) {}
```
→
```ts
  constructor(
    private prisma: PrismaService,
    private samlConfig: SamlConfigService,
    private localAccounts: LocalAccountsService,
  ) {}
```

Replace the `localLogin` method body (`this.localAdmin.login` → `this.localAccounts.login`, and the hardcoded `id: 'local-admin'` → the real account id):

```ts
  @Post('local/login')
  @HttpCode(HttpStatus.OK)
  async localLogin(
    @Body() body: { username: string; password: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.localAccounts.login(body.username, body.password);
    if (!result.ok) {
      const status = result.reason === 'locked' ? 423 : HttpStatus.UNAUTHORIZED;
      return res.status(status).json(result);
    }

    const user = {
      id: result.id,
      username: result.username,
      role: result.role,
      mustChangePassword: result.mustChangePassword,
      local: true,
    };
    req.login(user, (err) => {
      if (err) return res.status(500).json({ ok: false });
      res.json({ ok: true, mustChangePassword: result.mustChangePassword });
    });
  }
```

Replace the `changePassword` method's call site (`this.localAdmin.changePassword(...)` → `this.localAccounts.changePassword((req.user as any).id, ...)`):

```ts
  @Post('local/change-password')
  async changePassword(
    @Body() body: { currentPassword: string; newPassword: string },
    @Req() req: Request,
  ) {
    if (!req.isAuthenticated?.() || !(req.user as any)?.local) {
      throw new UnauthorizedException();
    }
    await this.localAccounts.changePassword((req.user as any).id, body.currentPassword, body.newPassword);
    if (req.user) (req.user as any).mustChangePassword = false;
    return { ok: true };
  }
```

- [ ] **Step 10: Update `auth.controller.spec.ts`**

Rename the mock variable and update the two local-login assertions that hardcoded `id: 'local-admin'`:

```ts
    localAdmin = { login: jest.fn(), changePassword: jest.fn() };
    controller = new AuthController(prisma, samlConfig, localAdmin);
```
→
```ts
    localAccounts = { login: jest.fn(), changePassword: jest.fn() };
    controller = new AuthController(prisma, samlConfig, localAccounts);
```

(rename the `let localAdmin: any;` declaration to `let localAccounts: any;` too)

```ts
  it('localLogin abre sessão quando as credenciais estão corretas', async () => {
    localAdmin.login.mockResolvedValue({ ok: true, mustChangePassword: true, username: 'admin' });
    const res = makeRes();
    const req: any = { login: jest.fn((_user, cb) => cb(null)) };

    await controller.localLogin({ username: 'admin', password: 'admin' }, req, res as any);

    expect(req.login).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'local-admin', role: 'ADMIN', mustChangePassword: true }),
      expect.any(Function),
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true, mustChangePassword: true });
  });
```
→
```ts
  it('localLogin abre sessão quando as credenciais estão corretas', async () => {
    localAccounts.login.mockResolvedValue({ ok: true, mustChangePassword: true, id: 'acc-1', username: 'admin', role: 'ADMIN' });
    const res = makeRes();
    const req: any = { login: jest.fn((_user, cb) => cb(null)) };

    await controller.localLogin({ username: 'admin', password: 'admin' }, req, res as any);

    expect(req.login).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'acc-1', role: 'ADMIN', mustChangePassword: true }),
      expect.any(Function),
    );
    expect(res.json).toHaveBeenCalledWith({ ok: true, mustChangePassword: true });
  });
```

Update the remaining `localAdmin.` references (the `423` test and the six `changePassword` tests) to `localAccounts.`, and update the `changePassword` delegation assertion to include the account id:

```ts
  it('changePassword delega ao LocalAdminAccountService quando há sessão local autenticada', async () => {
    const req: any = {
      isAuthenticated: () => true,
      user: { mustChangePassword: true, local: true },
    };
    await controller.changePassword({ currentPassword: 'admin', newPassword: 'nova12345' }, req);
    expect(localAdmin.changePassword).toHaveBeenCalledWith('admin', 'nova12345');
    expect(req.user.mustChangePassword).toBe(false);
  });
```
→
```ts
  it('changePassword delega ao LocalAccountsService quando há sessão local autenticada', async () => {
    const req: any = {
      isAuthenticated: () => true,
      user: { id: 'acc-1', mustChangePassword: true, local: true },
    };
    await controller.changePassword({ currentPassword: 'admin', newPassword: 'nova12345' }, req);
    expect(localAccounts.changePassword).toHaveBeenCalledWith('acc-1', 'admin', 'nova12345');
    expect(req.user.mustChangePassword).toBe(false);
  });
```

For the other three `expect(localAdmin.changePassword).not.toHaveBeenCalled();` assertions (the `UnauthorizedException` tests), simply rename `localAdmin` → `localAccounts`. For the `'localLogin retorna 423...'` test, rename `localAdmin.login` → `localAccounts.login`.

- [ ] **Step 11: Update `auth.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { SamlConfigController } from './saml-config.controller';
import { SecurityController } from './security-settings.controller';
import { LocalAccountsController } from './local-accounts.controller';
import { SessionSerializer } from './session.serializer';
import { AuthenticatedGuard } from './authenticated.guard';
import { RolesGuard } from './roles.guard';
import { SamlConfigService } from './saml-config.service';
import { SecuritySettingsService } from './security-settings.service';
import { LocalAccountsService } from './local-accounts.service';

@Module({
  imports: [PassportModule.register({ session: true })],
  controllers: [AuthController, SamlConfigController, SecurityController, LocalAccountsController],
  providers: [SessionSerializer, AuthenticatedGuard, RolesGuard, SamlConfigService, SecuritySettingsService, LocalAccountsService],
  exports: [AuthenticatedGuard, RolesGuard],
})
export class AuthModule {}
```

- [ ] **Step 12: Run full backend test suite, rebuild, verify, commit**

```bash
cd backend && npm test
```
Expected: all tests pass (no leftover references to `local-admin-account.service`).

```bash
cd .. && docker compose build api && docker compose up -d api
curl -s -X POST http://localhost:8080/api/auth/local/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin"}' -c /tmp/cookies.txt
```
Expected: `{"ok":true,"mustChangePassword":...}` reflecting the current known state of the `admin` account (per `CLAUDE.md`, currently `mustChangePassword: true` with password `admin` — if that's stale, check first with `docker exec ... psql -c 'SELECT username, "mustChangePassword" FROM "LocalAccount";'`).

```bash
git add backend/src/auth/password-policy.ts backend/src/auth/password-policy.spec.ts backend/src/auth/local-accounts.service.ts backend/src/auth/local-accounts.service.spec.ts backend/src/auth/local-accounts.controller.ts backend/src/auth/local-accounts.controller.spec.ts backend/src/auth/auth.controller.ts backend/src/auth/auth.controller.spec.ts backend/src/auth/auth.module.ts
git commit -m "feat(auth): evolve local admin singleton into multi-account LocalAccountsService"
```

---

### Task 4: Frontend — Usuários screen (drop column, list + create local accounts)

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/pages/Usuarios.tsx`

**Interfaces:**
- Consumes: `GET /local-accounts` (Task 3, returns `LocalAccountSummary[]`), `POST /local-accounts` (Task 3, body `{username, name?, role, password}`).
- Produces: `api.localAccounts(): Promise<any[]>`, `api.createLocalAccount(b: any): Promise<any>` — Task 7 (MFA UI) adds `api.resetMfa(id)` calongside these in the same file, doesn't need to change these two.

- [ ] **Step 1: Add API client methods**

In `frontend/src/api/client.ts`, add after the existing `users: () => req<any[]>('/users'),` line:

```ts
  localAccounts: () => req<any[]>('/local-accounts'),
  createLocalAccount: (b: any) => req<any>('/local-accounts', { method: 'POST', body: JSON.stringify(b) }),
```

- [ ] **Step 2: Rewrite `Usuarios.tsx`**

```tsx
import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { showToast } from '../lib/toast';

const ROLE_LABEL: Record<string, string> = { ADMIN: 'Admin', AUDITOR: 'Auditor', LEITOR: 'Leitor' };
const ROLE_OPTIONS = ['ADMIN', 'AUDITOR', 'LEITOR'];

function mfaStatusLabel(account: any): string {
  if (account.mfaEnabled) return 'Habilitado';
  return 'Desabilitado';
}

export function Usuarios() {
  const [users, setUsers] = useState<any[] | null>(null);
  const [localAccounts, setLocalAccounts] = useState<any[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('AUDITOR');
  const [password, setPassword] = useState('');

  function reload() {
    api.users().then(setUsers).catch(console.error);
    api.localAccounts().then(setLocalAccounts).catch(console.error);
  }

  useEffect(reload, []);

  async function createAccount(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      showToast('Informe usuário e senha inicial');
      return;
    }
    try {
      await api.createLocalAccount({ username: username.trim(), name: name.trim() || undefined, role, password });
      showToast('Usuário local criado');
      setShowForm(false);
      setUsername('');
      setName('');
      setRole('AUDITOR');
      setPassword('');
      reload();
    } catch (err: any) {
      showToast(err?.body?.message || 'Não foi possível criar o usuário');
    }
  }

  if (!users || !localAccounts) return <p className="page-sub">Carregando…</p>;

  return (
    <>
      <Link to="/configuracoes" className="back-btn">← Voltar a Configurações</Link>
      <h1 className="page-title">Usuários</h1>
      <p className="page-sub">
        Pessoas que já autenticaram via SSO (SAML) na aplicação. O papel exibido é o que veio do IdP no
        primeiro login — trocas de papel feitas depois no IdP não são re-sincronizadas automaticamente.
      </p>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>E-mail</th><th>Nome</th><th>Papel</th></tr></thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={3} style={{ color: 'var(--ink-3)' }}>Ninguém autenticou via SSO ainda.</td></tr>
            )}
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td style={{ color: 'var(--ink-3)' }}>{u.name || '—'}</td>
                <td><span className="tag ig">{ROLE_LABEL[u.role] || u.role}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="page-title" style={{ fontSize: 18, marginTop: 28 }}>Usuários locais</h2>
      <p className="page-sub">Contas com login e senha próprios, independentes do SSO.</p>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Usuário</th><th>Nome</th><th>Papel</th><th>MFA</th><th>Status</th></tr></thead>
          <tbody>
            {localAccounts.length === 0 && (
              <tr><td colSpan={5} style={{ color: 'var(--ink-3)' }}>Nenhum usuário local criado ainda.</td></tr>
            )}
            {localAccounts.map((a) => (
              <tr key={a.id}>
                <td>{a.username}</td>
                <td style={{ color: 'var(--ink-3)' }}>{a.name || '—'}</td>
                <td><span className="tag ig">{ROLE_LABEL[a.role] || a.role}</span></td>
                <td>{mfaStatusLabel(a)}</td>
                <td className="td-muted">
                  {a.lockedUntil && new Date(a.lockedUntil).getTime() > Date.now() ? 'Bloqueada' : a.mustChangePassword ? 'Aguardando 1º login' : 'Ativa'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn" style={{ marginTop: 12 }} onClick={() => setShowForm((s) => !s)}>
        {showForm ? 'Cancelar' : '+ Novo usuário local'}
      </button>

      {showForm && (
        <form onSubmit={createAccount} className="card" style={{ maxWidth: 480, marginTop: 12 }}>
          <div className="form-full" style={{ marginTop: 0 }}>
            <label htmlFor="la-username">Usuário</label>
            <input className="fld" id="la-username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </div>
          <div className="form-full">
            <label htmlFor="la-name">Nome (opcional)</label>
            <input className="fld" id="la-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-full">
            <label htmlFor="la-role">Papel</label>
            <select className="fld" id="la-role" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </div>
          <div className="form-full">
            <label htmlFor="la-password">Senha inicial</label>
            <input className="fld" id="la-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <p className="td-muted" style={{ margin: '8px 0 0' }}>
            A troca de senha será exigida no primeiro login dessa conta.
          </p>
          <div className="modal-actions" style={{ justifyContent: 'flex-start', marginTop: 18 }}>
            <button className="btn" type="submit">Criar usuário</button>
          </div>
        </form>
      )}
    </>
  );
}
```

- [ ] **Step 3: Type-check, rebuild, verify, commit**

```bash
cd frontend && npx tsc
```
Expected: only the known pre-existing `client.ts(1,26)` `ImportMeta.env` error.

```bash
cd .. && docker compose build web && docker compose up -d web
```

Manual check (Playwright or browser): open `http://localhost:8080/configuracoes/usuarios` as an ADMIN session — the SSO table no longer shows a "Primeiro login" column, a new "Usuários locais" table appears below it with at least the `admin` row, and "+ Novo usuário local" opens a form that successfully creates a test account (verify with `curl http://localhost:8080/api/local-accounts`, then delete the test row via a SQL file the same way prior test accounts were cleaned up in this session — there's no delete endpoint yet, this is DB-only cleanup).

```bash
git add frontend/src/api/client.ts frontend/src/pages/Usuarios.tsx
git commit -m "feat(frontend): listar e criar usuarios locais na tela de Usuarios"
```

---

### Task 5: Frontend — "Segurança" config card + page

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/pages/Configuracoes.tsx`
- Create: `frontend/src/pages/Seguranca.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `GET /security-settings`, `PUT /security-settings` (Task 2, body/response shape `SecuritySettingsDto`/`SecuritySettingsInput`).
- Produces: route `/configuracoes/seguranca`, rendered by `<Seguranca />`.

- [ ] **Step 1: Add API client methods**

In `frontend/src/api/client.ts`, add:

```ts
  getSecuritySettings: () => req<any>('/security-settings'),
  updateSecuritySettings: (b: any) => req<any>('/security-settings', { method: 'PUT', body: JSON.stringify(b) }),
```

- [ ] **Step 2: Add a card to `Configuracoes.tsx`**

```tsx
        <Link to="/configuracoes/seguranca" className="card ctrl-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="ctrl-num">SEG</span>
          <span className="ctrl-name">Segurança</span>
          <span className="td-muted">Política de senha e exigência de MFA para contas locais.</span>
        </Link>
```

(inserted after the existing "Usuários" `<Link>` card, before the closing `</div>` of `.ctrl-grid`)

- [ ] **Step 3: Create `Seguranca.tsx`**

```tsx
import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export function Seguranca() {
  const [config, setConfig] = useState<any>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getSecuritySettings().then(setConfig);
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    const updated = await api.updateSecuritySettings(config);
    setConfig(updated);
    setSaved(true);
  }

  if (!config) return null;

  return (
    <>
      <Link to="/configuracoes" className="back-btn">← Voltar a Configurações</Link>
      <h1 className="page-title">Segurança</h1>
      <p className="page-sub">Política de senha e MFA aplicadas às contas locais (não afeta o login via SSO).</p>
      <form onSubmit={save} className="card" style={{ maxWidth: 560 }}>
        <div className="form-full" style={{ marginTop: 0 }}>
          <label htmlFor="sec-min-length">Tamanho mínimo da senha</label>
          <input
            className="fld"
            id="sec-min-length"
            type="number"
            min={6}
            max={64}
            value={config.passwordMinLength}
            onChange={(e) => setConfig({ ...config, passwordMinLength: Number(e.target.value) })}
          />
        </div>
        <label className="checkbox-row" style={{ marginTop: 12 }}>
          <input
            type="checkbox"
            checked={config.passwordRequireUppercase}
            onChange={(e) => setConfig({ ...config, passwordRequireUppercase: e.target.checked })}
          />
          Exigir letra maiúscula
        </label>
        <label className="checkbox-row" style={{ marginTop: 8 }}>
          <input
            type="checkbox"
            checked={config.passwordRequireNumber}
            onChange={(e) => setConfig({ ...config, passwordRequireNumber: e.target.checked })}
          />
          Exigir número
        </label>
        <label className="checkbox-row" style={{ marginTop: 8 }}>
          <input
            type="checkbox"
            checked={config.passwordRequireSymbol}
            onChange={(e) => setConfig({ ...config, passwordRequireSymbol: e.target.checked })}
          />
          Exigir símbolo
        </label>
        <label className="checkbox-row" style={{ marginTop: 18 }}>
          <input
            type="checkbox"
            checked={config.mfaRequired}
            onChange={(e) => setConfig({ ...config, mfaRequired: e.target.checked })}
          />
          MFA obrigatório para contas locais
        </label>
        <p className="td-muted" style={{ margin: '8px 0 0' }}>
          Ao ligar, contas locais sem MFA configurado serão levadas a configurá-lo no próximo login.
        </p>
        <div className="modal-actions" style={{ justifyContent: 'flex-start', marginTop: 18 }}>
          <button className="btn" type="submit">Salvar</button>
          {saved && <span className="saved-note">Configuração salva.</span>}
        </div>
      </form>
    </>
  );
}
```

- [ ] **Step 4: Wire the route in `App.tsx`**

Add the import:

```tsx
import { Seguranca } from './pages/Seguranca';
```

Add the route next to the existing `/configuracoes/usuarios` one:

```tsx
          <Route path="/configuracoes/seguranca" element={<ProtectedRoute><Seguranca /></ProtectedRoute>} />
```

- [ ] **Step 5: Type-check, rebuild, verify, commit**

```bash
cd frontend && npx tsc
```
Expected: only the known `client.ts(1,26)` error.

```bash
cd .. && docker compose build web && docker compose up -d web
```

Manual check: `/configuracoes` shows a "Segurança" card; `/configuracoes/seguranca` loads current defaults (`8`, all checkboxes off), saving updates and shows "Configuração salva.". Confirm with `curl http://localhost:8080/api/security-settings` that the change persisted, then set it back to defaults to avoid leaving test state (per this session's established caution around leaking test data into the shared dev DB).

```bash
git add frontend/src/api/client.ts frontend/src/pages/Configuracoes.tsx frontend/src/pages/Seguranca.tsx frontend/src/App.tsx
git commit -m "feat(frontend): tela de Configuracoes > Seguranca (politica de senha + MFA obrigatorio)"
```

---

### Task 6: Backend — TOTP MFA (enrollment, login verification, admin reset)

**Files:**
- Modify: `backend/package.json` (add `otplib`, `qrcode`, `@types/qrcode`)
- Modify: `backend/src/auth/local-accounts.service.ts`
- Modify: `backend/src/auth/local-accounts.service.spec.ts`
- Modify: `backend/src/auth/local-accounts.controller.ts`
- Modify: `backend/src/auth/local-accounts.controller.spec.ts`
- Modify: `backend/src/auth/auth.controller.ts`
- Modify: `backend/src/auth/auth.controller.spec.ts`
- Modify: `backend/src/auth/authenticated.guard.ts`

**Interfaces:**
- Consumes: `LocalAccountsService` and `LocalLoginResult` from Task 3 (extended in place, not replaced).
- Produces: `LocalAccountsService.startMfaEnrollment(accountId)`, `.confirmMfaEnrollment(accountId, token)`, `.verifyMfaLogin(accountId, token)`, `.resetMfa(accountId)` — Task 7 (frontend MFA UI) calls these indirectly through the new `AuthController`/`LocalAccountsController` endpoints below, not directly.

- [ ] **Step 1: Add dependencies**

In `backend/package.json`, add to `dependencies`:

```json
    "otplib": "^12.0.1",
    "qrcode": "^1.5.4",
```

and to `devDependencies`:

```json
    "@types/qrcode": "^1.5.5",
```

```bash
cd backend && npm install
```

- [ ] **Step 2: Extend `LocalAccountsService` with TOTP methods**

Add the import at the top of `local-accounts.service.ts`:

```ts
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
```

Update `LocalLoginResult` to add the two new optional fields:

```ts
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
```

Add a new exported interface right below it:

```ts
export interface MfaEnrollment {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
}
```

Add the constant `BACKUP_CODE_COUNT = 10` next to the existing `MAX_ATTEMPTS`/`LOCK_MINUTES`/`HASH_ROUNDS` constants.

Replace the `login` method's success branch (the part after `await this.prisma.localAccount.update(...)` that currently returns directly) so it branches on `mfaEnabled`, and inject `SecuritySettingsService`'s config for `mfaEnrollRequired`:

```ts
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
```

Add the new TOTP methods after `create(...)`:

```ts
  async verifyMfaLogin(accountId: string, token: string): Promise<LocalLoginResult> {
    const account = await this.prisma.localAccount.findUnique({ where: { id: accountId } });
    if (!account) return { ok: false, reason: 'invalid' };

    if (account.lockedUntil && account.lockedUntil.getTime() > Date.now()) {
      return { ok: false, reason: 'locked', lockedUntilMs: account.lockedUntil.getTime() };
    }

    const validTotp = account.mfaSecret ? authenticator.check(token, account.mfaSecret) : false;
    const backupIndex = validTotp ? -1 : await this.matchBackupCode(account.mfaBackupCodes, token);
    if (!validTotp && backupIndex === -1) return this.registerFailedAttempt(account);

    const remainingBackupCodes = backupIndex >= 0
      ? account.mfaBackupCodes.filter((_: string, i: number) => i !== backupIndex)
      : account.mfaBackupCodes;

    await this.prisma.localAccount.update({
      where: { id: account.id },
      data: { failedAttempts: 0, lockedUntil: null, mfaBackupCodes: remainingBackupCodes },
    });

    return {
      ok: true,
      mustChangePassword: account.mustChangePassword,
      id: account.id,
      username: account.username,
      role: account.role,
    };
  }

  private async matchBackupCode(hashedCodes: string[], candidate: string): Promise<number> {
    for (let i = 0; i < hashedCodes.length; i++) {
      if (await bcrypt.compare(candidate, hashedCodes[i])) return i;
    }
    return -1;
  }

  async startMfaEnrollment(accountId: string): Promise<MfaEnrollment> {
    const account = await this.prisma.localAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new Error('Conta local não encontrada');

    const secret = authenticator.generateSecret();
    await this.prisma.localAccount.update({ where: { id: accountId }, data: { mfaSecret: secret } });

    const otpauthUrl = authenticator.keyuri(account.username, 'Sentinela CIS', secret);
    const qrDataUrl = await qrcode.toDataURL(otpauthUrl);
    return { secret, otpauthUrl, qrDataUrl };
  }

  async confirmMfaEnrollment(accountId: string, token: string): Promise<string[]> {
    const account = await this.prisma.localAccount.findUnique({ where: { id: accountId } });
    if (!account || !account.mfaSecret) throw new Error('Nenhum cadastro de MFA pendente para esta conta');

    if (!authenticator.check(token, account.mfaSecret)) throw new Error('Código inválido');

    const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
      Math.random().toString(36).slice(2, 6) + '-' + Math.random().toString(36).slice(2, 6),
    );
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
```

- [ ] **Step 3: Extend `local-accounts.service.spec.ts`**

Update the shared `DEFAULT_POLICY`/`makeAccount` fixtures are already present from Task 3. Update the two existing `login` "success" tests to account for the new `mfaEnrollRequired` field (since `security.getConfig()` now runs on every successful non-MFA login) — the mock already returns `DEFAULT_POLICY` with `mfaRequired: false`, so the existing assertions using `toEqual({ ok: true, mustChangePassword: true, id: 'acc-1', username: 'admin', role: 'ADMIN' })` must become:

```ts
    expect(result).toEqual({ ok: true, mustChangePassword: true, mfaEnrollRequired: false, id: 'acc-1', username: 'admin', role: 'ADMIN' });
```

Add new test cases at the end of the `describe` block:

```ts
  it('login com mfaEnabled não abre sessão, pede verificação de TOTP', async () => {
    prisma.localAccount.findUnique.mockResolvedValue(makeAccount({ mfaEnabled: true, mfaSecret: 'SECRET' }));
    const result = await service.login('admin', 'admin');
    expect(result).toEqual({ ok: true, mfaRequired: true, id: 'acc-1' });
  });

  it('login reporta mfaEnrollRequired quando MFA é obrigatório globalmente e a conta não tem MFA', async () => {
    security.getConfig.mockResolvedValue({ ...DEFAULT_POLICY, mfaRequired: true });
    prisma.localAccount.findUnique.mockResolvedValue(makeAccount());
    const result = await service.login('admin', 'admin');
    expect(result.mfaEnrollRequired).toBe(true);
  });

  it('startMfaEnrollment gera um segredo e retorna QR', async () => {
    prisma.localAccount.findUnique.mockResolvedValue(makeAccount());
    const enrollment = await service.startMfaEnrollment('acc-1');
    expect(enrollment.secret).toEqual(expect.any(String));
    expect(enrollment.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(prisma.localAccount.update).toHaveBeenCalledWith({ where: { id: 'acc-1' }, data: { mfaSecret: enrollment.secret } });
  });

  it('confirmMfaEnrollment rejeita token inválido e não habilita MFA', async () => {
    prisma.localAccount.findUnique.mockResolvedValue(makeAccount({ mfaSecret: authenticatorSecret() }));
    await expect(service.confirmMfaEnrollment('acc-1', '000000')).rejects.toThrow('Código inválido');
    expect(prisma.localAccount.update).not.toHaveBeenCalled();
  });

  it('confirmMfaEnrollment habilita MFA e retorna 10 códigos de backup em claro', async () => {
    const secret = authenticatorSecret();
    prisma.localAccount.findUnique.mockResolvedValue(makeAccount({ mfaSecret: secret }));
    const { authenticator } = require('otplib');
    const token = authenticator.generate(secret);

    const codes = await service.confirmMfaEnrollment('acc-1', token);

    expect(codes).toHaveLength(10);
    expect(prisma.localAccount.update).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { mfaEnabled: true, mfaBackupCodes: expect.any(Array) },
    });
  });

  it('verifyMfaLogin aceita um TOTP válido', async () => {
    const secret = authenticatorSecret();
    prisma.localAccount.findUnique.mockResolvedValue(makeAccount({ mfaEnabled: true, mfaSecret: secret }));
    const { authenticator } = require('otplib');
    const token = authenticator.generate(secret);

    const result = await service.verifyMfaLogin('acc-1', token);

    expect(result.ok).toBe(true);
  });

  it('verifyMfaLogin aceita e consome um código de backup válido', async () => {
    const backupCode = 'abcd-1234';
    const hashed = await bcrypt.hash(backupCode, 4);
    prisma.localAccount.findUnique.mockResolvedValue(makeAccount({ mfaEnabled: true, mfaSecret: 'SECRET', mfaBackupCodes: [hashed] }));

    const result = await service.verifyMfaLogin('acc-1', backupCode);

    expect(result.ok).toBe(true);
    expect(prisma.localAccount.update).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { failedAttempts: 0, lockedUntil: null, mfaBackupCodes: [] },
    });
  });

  it('verifyMfaLogin rejeita token/código inválidos e conta como tentativa falha', async () => {
    prisma.localAccount.findUnique.mockResolvedValue(makeAccount({ mfaEnabled: true, mfaSecret: 'SECRET', mfaBackupCodes: [] }));
    const result = await service.verifyMfaLogin('acc-1', '000000');
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('resetMfa limpa o segredo, flag e códigos de backup', async () => {
    await service.resetMfa('acc-1');
    expect(prisma.localAccount.update).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { mfaEnabled: false, mfaSecret: null, mfaBackupCodes: [] },
    });
  });
```

Add this helper near the top of the file (below the imports, above `makeAccount`):

```ts
function authenticatorSecret(): string {
  const { authenticator } = require('otplib');
  return authenticator.generateSecret();
}
```

- [ ] **Step 4: Run the service tests**

```bash
cd backend && npm test -- local-accounts.service
```
Expected: all pass, including the new TOTP tests.

- [ ] **Step 5: Add `reset-mfa` to `LocalAccountsController`**

```ts
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedGuard } from './authenticated.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { LocalAccountsService, CreateLocalAccountInput } from './local-accounts.service';

@Controller('local-accounts')
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles('ADMIN')
export class LocalAccountsController {
  constructor(private svc: LocalAccountsService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Post()
  create(@Body() body: CreateLocalAccountInput) {
    return this.svc.create(body);
  }

  @Post(':id/reset-mfa')
  async resetMfa(@Param('id') id: string) {
    await this.svc.resetMfa(id);
    return { ok: true };
  }
}
```

`resetMfa` returns `Promise<void>` from the service — returning that promise directly from the
controller would make Nest try to serialize an empty body, and the frontend's `res.json()` call
would throw on it (unlike `RisksController.remove`, which returns the deleted row and serializes
fine). Wrapping it in `{ ok: true }` keeps the response body non-empty, matching the pattern
`AuthController.changePassword` already uses for the same reason.

- [ ] **Step 6: Extend `local-accounts.controller.spec.ts`**

Add:

```ts
  it('resetMfa delega ao service com o id da rota e retorna ok', async () => {
    const svc: any = { resetMfa: jest.fn().mockResolvedValue(undefined) };
    const controller = new LocalAccountsController(svc);

    const result = await controller.resetMfa('acc-1');

    expect(svc.resetMfa).toHaveBeenCalledWith('acc-1');
    expect(result).toEqual({ ok: true });
  });
```

- [ ] **Step 7: Extend `AuthController`**

Update `localLogin` to carry `mfaEnrollRequired` into the session user, and to stash `pendingMfaAccountId` in the session instead of logging in when `mfaRequired` comes back:

```ts
  @Post('local/login')
  @HttpCode(HttpStatus.OK)
  async localLogin(
    @Body() body: { username: string; password: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.localAccounts.login(body.username, body.password);
    if (!result.ok) {
      const status = result.reason === 'locked' ? 423 : HttpStatus.UNAUTHORIZED;
      return res.status(status).json(result);
    }

    if (result.mfaRequired) {
      (req.session as any).pendingMfaAccountId = result.id;
      return res.json({ ok: true, mfaRequired: true });
    }

    const user = {
      id: result.id,
      username: result.username,
      role: result.role,
      mustChangePassword: result.mustChangePassword,
      mfaEnrollRequired: result.mfaEnrollRequired,
      local: true,
    };
    req.login(user, (err) => {
      if (err) return res.status(500).json({ ok: false });
      res.json({ ok: true, mustChangePassword: result.mustChangePassword, mfaEnrollRequired: result.mfaEnrollRequired });
    });
  }

  @Post('local/mfa/login-verify')
  @HttpCode(HttpStatus.OK)
  async mfaLoginVerify(
    @Body() body: { token: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const pendingId = (req.session as any)?.pendingMfaAccountId;
    if (!pendingId) throw new UnauthorizedException();

    const result = await this.localAccounts.verifyMfaLogin(pendingId, body.token);
    if (!result.ok) {
      const status = result.reason === 'locked' ? 423 : HttpStatus.UNAUTHORIZED;
      return res.status(status).json(result);
    }

    delete (req.session as any).pendingMfaAccountId;
    const user = {
      id: result.id,
      username: result.username,
      role: result.role,
      mustChangePassword: result.mustChangePassword,
      local: true,
    };
    req.login(user, (err) => {
      if (err) return res.status(500).json({ ok: false });
      res.json({ ok: true, mustChangePassword: result.mustChangePassword });
    });
  }

  @Post('local/mfa/enroll')
  async mfaEnroll(@Req() req: Request) {
    if (!req.isAuthenticated?.() || !(req.user as any)?.local) throw new UnauthorizedException();
    return this.localAccounts.startMfaEnrollment((req.user as any).id);
  }

  @Post('local/mfa/enroll/verify')
  async mfaEnrollVerify(@Body() body: { token: string }, @Req() req: Request) {
    if (!req.isAuthenticated?.() || !(req.user as any)?.local) throw new UnauthorizedException();
    const backupCodes = await this.localAccounts.confirmMfaEnrollment((req.user as any).id, body.token);
    if (req.user) (req.user as any).mfaEnrollRequired = false;
    return { backupCodes };
  }
```

- [ ] **Step 8: Update `AuthenticatedGuard`**

```ts
@Injectable()
export class AuthenticatedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    if (req.isAuthenticated?.()) {
      return !req.user?.mustChangePassword && !req.user?.mfaEnrollRequired;
    }

    if (process.env.NODE_ENV !== 'production') {
      req.user = { id: 'dev', email: 'dev@local', name: 'Dev', role: 'ADMIN' };
      return true;
    }

    return false;
  }
}
```

- [ ] **Step 9: Extend `auth.controller.spec.ts`**

Update the existing `localLogin abre sessão...` test's mock to include `mfaEnrollRequired: false` (since `LocalAccountsService.login` now always returns it on success) and add these new tests at the end of the `describe` block:

```ts
  it('localLogin não abre sessão quando a conta exige verificação de MFA, guarda o accountId pendente', async () => {
    localAccounts.login.mockResolvedValue({ ok: true, mfaRequired: true, id: 'acc-1' });
    const res = makeRes();
    const req: any = { session: {}, login: jest.fn() };

    await controller.localLogin({ username: 'admin', password: 'admin' }, req, res as any);

    expect(req.session.pendingMfaAccountId).toBe('acc-1');
    expect(req.login).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, mfaRequired: true });
  });

  it('mfaLoginVerify rejeita sem accountId pendente na sessão', async () => {
    const req: any = { session: {} };
    await expect(controller.mfaLoginVerify({ token: '000000' }, req, makeRes() as any)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('mfaLoginVerify abre sessão e limpa o pendingMfaAccountId quando o token é válido', async () => {
    localAccounts.verifyMfaLogin = jest.fn().mockResolvedValue({ ok: true, mustChangePassword: false, id: 'acc-1', username: 'admin', role: 'ADMIN' });
    const res = makeRes();
    const req: any = { session: { pendingMfaAccountId: 'acc-1' }, login: jest.fn((_user, cb) => cb(null)) };

    await controller.mfaLoginVerify({ token: '123456' }, req, res as any);

    expect(req.session.pendingMfaAccountId).toBeUndefined();
    expect(req.login).toHaveBeenCalledWith(expect.objectContaining({ id: 'acc-1' }), expect.any(Function));
  });

  it('mfaEnroll rejeita sem sessão local autenticada', async () => {
    const req: any = { isAuthenticated: () => false };
    await expect(controller.mfaEnroll(req)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('mfaEnroll delega ao service com o id da sessão', async () => {
    localAccounts.startMfaEnrollment = jest.fn().mockResolvedValue({ secret: 'S', otpauthUrl: 'otpauth://x', qrDataUrl: 'data:image/png;base64,x' });
    const req: any = { isAuthenticated: () => true, user: { id: 'acc-1', local: true } };

    const result = await controller.mfaEnroll(req);

    expect(localAccounts.startMfaEnrollment).toHaveBeenCalledWith('acc-1');
    expect(result.secret).toBe('S');
  });

  it('mfaEnrollVerify zera mfaEnrollRequired na sessão e retorna os códigos de backup', async () => {
    localAccounts.confirmMfaEnrollment = jest.fn().mockResolvedValue(['code-1', 'code-2']);
    const req: any = { isAuthenticated: () => true, user: { id: 'acc-1', local: true, mfaEnrollRequired: true } };

    const result = await controller.mfaEnrollVerify({ token: '123456' }, req);

    expect(req.user.mfaEnrollRequired).toBe(false);
    expect(result).toEqual({ backupCodes: ['code-1', 'code-2'] });
  });
```

- [ ] **Step 10: Run full backend test suite, rebuild, verify, commit**

```bash
cd backend && npm test
```
Expected: all tests pass.

```bash
cd .. && docker compose build api && docker compose up -d api
```

Manual verification of the full MFA round-trip (careful with the shared dev DB — clean up the test account afterward):

```bash
curl -s -X POST http://localhost:8080/api/local-accounts -H 'Content-Type: application/json' -d '{"username":"mfa-test","role":"AUDITOR","password":"Teste1234!"}'
curl -s -c /tmp/mfa-cookies.txt -X POST http://localhost:8080/api/auth/local/login -H 'Content-Type: application/json' -d '{"username":"mfa-test","password":"Teste1234!"}'
curl -s -b /tmp/mfa-cookies.txt -X POST http://localhost:8080/api/auth/local/change-password -H 'Content-Type: application/json' -d '{"currentPassword":"Teste1234!","newPassword":"Teste12345!"}'
curl -s -b /tmp/mfa-cookies.txt -X POST http://localhost:8080/api/auth/local/mfa/enroll
```
Expected: the last call returns `{secret, otpauthUrl, qrDataUrl}`. Compute a token from `secret` (e.g. `node -e "console.log(require('otplib').authenticator.generate(process.argv[1]))" <secret>` inside the api container) and confirm:
```bash
docker exec saml-local-auth-api-1 node -e "console.log(require('otplib').authenticator.generate(process.argv[1]))" "<secret>"
curl -s -b /tmp/mfa-cookies.txt -X POST http://localhost:8080/api/auth/local/mfa/enroll/verify -H 'Content-Type: application/json' -d '{"token":"<generated token>"}'
```
Expected: `{"backupCodes":[...10 codes...]}`. Then delete the `mfa-test` `LocalAccount` row via a SQL file (same safe pattern documented in `CLAUDE.md` — never interpolate secrets into shell strings).

```bash
git add backend/package.json backend/package-lock.json backend/src/auth/local-accounts.service.ts backend/src/auth/local-accounts.service.spec.ts backend/src/auth/local-accounts.controller.ts backend/src/auth/local-accounts.controller.spec.ts backend/src/auth/auth.controller.ts backend/src/auth/auth.controller.spec.ts backend/src/auth/authenticated.guard.ts
git commit -m "feat(auth): implementar MFA TOTP (enrollment, verificacao de login, reset admin)"
```

---

### Task 7: Frontend — MFA enrollment page, forced-redirect wiring, login 2nd factor, admin actions

**Files:**
- Modify: `frontend/src/api/client.ts`
- Create: `frontend/src/pages/MfaEnroll.tsx`
- Modify: `frontend/src/components/ProtectedRoute.tsx`
- Modify: `frontend/src/pages/Login.tsx`
- Modify: `frontend/src/pages/Usuarios.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `POST /auth/local/mfa/login-verify`, `POST /auth/local/mfa/enroll`, `POST /auth/local/mfa/enroll/verify`, `POST /local-accounts/:id/reset-mfa` (all Task 6).

- [ ] **Step 1: Add API client methods**

In `frontend/src/api/client.ts`, add:

```ts
  mfaLoginVerify: (token: string) => req<any>('/auth/local/mfa/login-verify', { method: 'POST', body: JSON.stringify({ token }) }),
  mfaEnroll: () => req<any>('/auth/local/mfa/enroll', { method: 'POST' }),
  mfaEnrollVerify: (token: string) => req<any>('/auth/local/mfa/enroll/verify', { method: 'POST', body: JSON.stringify({ token }) }),
  resetMfa: (id: string) => req<any>(`/local-accounts/${id}/reset-mfa`, { method: 'POST' }),
```

- [ ] **Step 2: Create `MfaEnroll.tsx`**

```tsx
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export function MfaEnroll() {
  const [enrollment, setEnrollment] = useState<any>(null);
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.mfaEnroll().then(setEnrollment).catch(() => setError('Não foi possível iniciar o cadastro de MFA.'));
  }, []);

  async function confirm(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await api.mfaEnrollVerify(token);
      setBackupCodes(result.backupCodes);
    } catch {
      setError('Código inválido. Confira o horário do dispositivo e tente novamente.');
    }
  }

  if (backupCodes) {
    return (
      <div className="login-page">
        <div className="card login-card">
          <h1 className="page-title">MFA configurado</h1>
          <p className="page-sub">
            Guarde estes 10 códigos de backup em local seguro — cada um só pode ser usado uma vez, caso você perca
            acesso ao aplicativo autenticador. Eles não serão mostrados novamente.
          </p>
          <pre style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 8, fontSize: 13 }}>
            {backupCodes.join('\n')}
          </pre>
          <button className="btn" onClick={() => navigate('/dashboard')}>Concluir</button>
        </div>
      </div>
    );
  }

  if (!enrollment) return <p className="page-sub">Carregando…</p>;

  return (
    <div className="login-page">
      <form onSubmit={confirm} className="card login-card local-login-form">
        <h1 className="page-title">Configurar MFA</h1>
        <p className="page-sub">Escaneie o QR com um aplicativo autenticador (Google Authenticator, Authy, etc.).</p>
        <img src={enrollment.qrDataUrl} alt="QR code do MFA" width={200} height={200} />
        <p className="td-muted">Ou insira manualmente: <code>{enrollment.secret}</code></p>
        <label>
          Código de 6 dígitos
          <input value={token} onChange={(e) => setToken(e.target.value)} autoFocus maxLength={6} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn" type="submit">Confirmar</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Extend `ProtectedRoute.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api/client';

type Status = 'loading' | 'authenticated' | 'change-password' | 'mfa-enroll' | 'unauthenticated';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    api
      .me()
      .then((user) => {
        if (!user || user.authenticated === false) return setStatus('unauthenticated');
        if (user.mustChangePassword) return setStatus('change-password');
        if (user.mfaEnrollRequired) return setStatus('mfa-enroll');
        setStatus('authenticated');
      })
      .catch(() => setStatus('unauthenticated'));
  }, []);

  if (status === 'loading') return null;
  if (status === 'unauthenticated') return <Navigate to="/login" replace />;
  if (status === 'change-password') return <Navigate to="/trocar-senha" replace />;
  if (status === 'mfa-enroll') return <Navigate to="/mfa/configurar" replace />;
  return <>{children}</>;
}
```

- [ ] **Step 4: Extend `Login.tsx` with the TOTP second step**

```tsx
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, SAML_LOGIN_URL } from '../api/client';

export function Login() {
  const [showLocal, setShowLocal] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function submitLocal(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await api.localLogin(username, password);
      if (result.mfaRequired) return setMfaStep(true);
      navigate(result.mustChangePassword ? '/trocar-senha' : result.mfaEnrollRequired ? '/mfa/configurar' : '/dashboard');
    } catch (err: any) {
      if (err.status === 423) setError('Conta bloqueada temporariamente por tentativas incorretas.');
      else setError('Usuário ou senha inválidos.');
    }
  }

  async function submitMfa(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await api.mfaLoginVerify(mfaToken);
      navigate(result.mustChangePassword ? '/trocar-senha' : '/dashboard');
    } catch (err: any) {
      if (err.status === 423) setError('Conta bloqueada temporariamente por tentativas incorretas.');
      else setError('Código inválido. Você também pode usar um código de backup.');
    }
  }

  return (
    <div className="login-page">
      <div className="card login-card">
        <h1 className="page-title">Sentinela CIS</h1>
        {!mfaStep && <a className="btn" href={SAML_LOGIN_URL}>Entrar com SSO corporativo</a>}

        {!showLocal && !mfaStep && (
          <button className="link-btn" onClick={() => setShowLocal(true)}>
            Problemas com o SSO? Entrar com conta local
          </button>
        )}

        {showLocal && !mfaStep && (
          <form onSubmit={submitLocal} className="local-login-form">
            <label>
              Usuário
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
            </label>
            <label>
              Senha
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="btn" type="submit">Entrar</button>
          </form>
        )}

        {mfaStep && (
          <form onSubmit={submitMfa} className="local-login-form">
            <label>
              Código do autenticador (ou código de backup)
              <input value={mfaToken} onChange={(e) => setMfaToken(e.target.value)} autoFocus />
            </label>
            {error && <p className="error">{error}</p>}
            <button className="btn" type="submit">Confirmar</button>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add admin actions to `Usuarios.tsx`'s local-accounts table**

Add an "Ações" column with a "Resetar MFA" button, only meaningful for accounts with `mfaEnabled`:

In the local-accounts `<thead>`, change:
```tsx
          <thead><tr><th>Usuário</th><th>Nome</th><th>Papel</th><th>MFA</th><th>Status</th></tr></thead>
```
to:
```tsx
          <thead><tr><th>Usuário</th><th>Nome</th><th>Papel</th><th>MFA</th><th>Status</th><th></th></tr></thead>
```

And change the empty-state `colSpan` from `5` to `6`. In the row-mapping `<tr>`, add a final cell before the closing `</tr>`:

```tsx
                <td>
                  {a.mfaEnabled && (
                    <button className="btn ghost sm" onClick={() => resetMfa(a.id)}>Resetar MFA</button>
                  )}
                </td>
```

Add the handler function (next to `createAccount`):

```tsx
  async function resetMfa(id: string) {
    if (!confirm('Resetar o MFA desta conta? O usuário precisará configurar novamente no próximo login.')) return;
    await api.resetMfa(id);
    showToast('MFA resetado');
    reload();
  }
```

- [ ] **Step 6: Wire the route in `App.tsx`**

Add the import:

```tsx
import { MfaEnroll } from './pages/MfaEnroll';
```

Add the route (outside `ProtectedRoute` since the user IS authenticated but blocked — same placement as `/trocar-senha`):

```tsx
          <Route path="/mfa/configurar" element={<MfaEnroll />} />
```

- [ ] **Step 7: Type-check, rebuild, verify, commit**

```bash
cd frontend && npx tsc
```
Expected: only the known `client.ts(1,26)` error.

```bash
cd .. && docker compose build web && docker compose up -d web
```

Manual end-to-end check (Playwright or browser), reusing the `mfa-test` flow from Task 6's verification but through the UI this time: create a local user via `/configuracoes/usuarios`, log in as it (forced password change), get redirected to `/mfa/configurar` only if "MFA obrigatório" is on in `/configuracoes/seguranca` — otherwise confirm the account can log in normally without MFA. Toggle "MFA obrigatório" on, log in again as that account, confirm the forced redirect to `/mfa/configurar`, scan/enter the QR secret with a real or scripted TOTP generator, confirm backup codes are shown once, log out, log back in and confirm the login page now asks for the TOTP code. Use "Resetar MFA" from `/configuracoes/usuarios` and confirm the account is asked to enroll again. Clean up the test account and revert "MFA obrigatório" afterward, per this session's dev-DB hygiene practice.

```bash
git add frontend/src/api/client.ts frontend/src/pages/MfaEnroll.tsx frontend/src/components/ProtectedRoute.tsx frontend/src/pages/Login.tsx frontend/src/pages/Usuarios.tsx frontend/src/App.tsx
git commit -m "feat(frontend): fluxo de MFA TOTP (enrollment, login, reset pelo admin)"
```
