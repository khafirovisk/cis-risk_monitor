# SAML configurável via web + autenticação local Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar a configuração do SSO SAML editável por uma tela web (com efeito imediato, sem restart) e adicionar uma conta local de emergência (`admin`/`admin`, com troca de senha obrigatória no primeiro uso) para nunca depender só do SAML.

**Architecture:** Duas tabelas Prisma novas e isoladas (`SamlConfig`, `LocalAdminAccount`, ambas singleton `id=1`). O backend NestJS para de ler `SAML_*` do `.env` na inicialização e passa a montar a instância do SAML (`@node-saml/node-saml`) a cada request, a partir de um `SamlConfigService` com cache invalidado no save — isso elimina a necessidade de restart. Login local vira dois endpoints novos no `AuthController` (`/auth/local/login`, `/auth/local/change-password`), com bloqueio por tentativas guardado na própria linha `LocalAdminAccount`. `Role`/`User` (ADMIN/AUDITOR/LEITOR) não mudam.

**Tech Stack:** NestJS 10 + Prisma 5 (backend), React 18 + Vite + react-router-dom 6 (frontend), `@node-saml/node-saml` para SAML, `bcryptjs` para hash de senha, Jest + ts-jest para testes de backend.

## Global Constraints

- Spec de referência: `docs/superpowers/specs/2026-07-21-saml-local-auth-design.md`.
- **Não** alterar o enum `Role` nem criar papéis "admin/read-only" — fora de escopo, confirmado com o usuário.
- **Não** criar gestão de múltiplas contas locais — só a conta única `admin`.
- Seguir o estilo já usado no backend: sem `class-validator`/DTOs decoradas, tipos inline em `@Body()` (ver `assessments.controller.ts`, `risks.controller.ts`).
- Hash de senha com `bcryptjs` (não `bcrypt` nativo) — evita dependência de build nativo no Windows/dev sem Docker.
- Bloqueio de força bruta: 5 tentativas erradas → 15 minutos de bloqueio, guardado em `LocalAdminAccount.failedAttempts`/`lockedUntil` (sem Redis).
- O frontend hoje não tem nenhuma infraestrutura de teste automatizado (nenhum `*.test.tsx`/`*.spec.tsx`, sem vitest configurado). Esta é uma decisão consciente de manter assim: as tarefas de frontend abaixo são verificadas manualmente com passos exatos, em vez de introduzir um framework de teste novo fora do escopo pedido.
- O backend hoje não tem nenhuma infraestrutura de teste (`backend/package.json` não tem Jest). A Task 2 abaixo introduz Jest, porque as tasks seguintes de backend (services com lógica de negócio real: hashing, bloqueio, cache) precisam de TDD de verdade.

---

## Task 1: Schema Prisma — `SamlConfig` e `LocalAdminAccount`

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: models Prisma `SamlConfig` (campos: `id Int @id @default(1)`, `enabled Boolean`, `entryPoint String?`, `issuer String`, `callbackUrl String?`, `idpCert String?`, `wantAssertionsSigned Boolean`, `updatedBy String?`, `updatedAt DateTime`) e `LocalAdminAccount` (`id Int @id @default(1)`, `username String @unique`, `passwordHash String`, `mustChangePassword Boolean`, `failedAttempts Int`, `lockedUntil DateTime?`, `updatedAt DateTime`). Tasks seguintes usam `prisma.samlConfig.*` e `prisma.localAdminAccount.*`.

- [ ] **Step 1: Garantir Postgres rodando localmente**

Se você não estiver usando Docker Compose para o backend, suba um Postgres avulso (ignore se já tiver um rodando):

```bash
docker run -d --name pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
```

Confirme que `backend/.env` tem `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"` (ajuste conforme seu `.env`).

- [ ] **Step 2: Adicionar os models ao schema**

Edite `backend/prisma/schema.prisma`, adicionando ao final do arquivo (depois do model `AuditLog`):

```prisma
// ---------- Autenticação: SAML dinâmico + conta local ----------
model SamlConfig {
  id                   Int      @id @default(1)
  enabled              Boolean  @default(false)
  entryPoint           String?
  issuer               String   @default("sentinela-cis")
  callbackUrl          String?
  idpCert              String?
  wantAssertionsSigned Boolean  @default(true)
  updatedBy            String?
  updatedAt            DateTime @updatedAt
}

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

- [ ] **Step 3: Rodar a migration**

```bash
cd backend
npx prisma migrate dev --name saml_config_local_admin
```

Expected: saída terminando em `Your database is now in sync with your schema.` e uma nova pasta em `backend/prisma/migrations/<timestamp>_saml_config_local_admin/` com `migration.sql` contendo `CREATE TABLE "SamlConfig"` e `CREATE TABLE "LocalAdminAccount"`.

- [ ] **Step 4: Gerar o client Prisma**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client`. Confirme que `node_modules/.prisma/client/index.d.ts` (ou a saída do generate) menciona `SamlConfig` e `LocalAdminAccount`.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(db): adiciona SamlConfig e LocalAdminAccount"
```

---

## Task 2: Infraestrutura de testes do backend (Jest)

**Files:**
- Modify: `backend/package.json`
- Create: `backend/jest.config.js`
- Create: `backend/src/sanity.spec.ts`

**Interfaces:**
- Produces: comando `npm test` rodando Jest com `ts-jest`, usado por todas as tasks de backend seguintes.

- [ ] **Step 1: Adicionar dependências de teste**

Edite `backend/package.json`, adicionando em `devDependencies`:

```json
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "@types/jest": "^29.5.12"
```

E em `scripts`, adicione:

```json
    "test": "jest"
```

Rode:

```bash
cd backend
npm install
```

- [ ] **Step 2: Criar `jest.config.js`**

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
};
```

- [ ] **Step 3: Escrever teste de sanidade (deve falhar antes de existir? Não — este é o próprio smoke test)**

Crie `backend/src/sanity.spec.ts`:

```ts
describe('sanity', () => {
  it('jest está funcionando', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npm test
```

Expected: `Tests: 1 passed, 1 total`.

- [ ] **Step 5: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/jest.config.js backend/src/sanity.spec.ts
git commit -m "chore(backend): configura Jest"
```

---

## Task 3: `LocalAdminAccountService` (login local, hash, bloqueio)

**Files:**
- Modify: `backend/package.json` (dependência `bcryptjs`)
- Create: `backend/src/auth/local-admin-account.service.ts`
- Test: `backend/src/auth/local-admin-account.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (de `../prisma/prisma.service`) — usa `prisma.localAdminAccount.findUnique({ where: { id: 1 } })` e `prisma.localAdminAccount.update(...)`.
- Produces: classe `LocalAdminAccountService` com:
  - `login(username: string, password: string): Promise<LocalLoginResult>` onde
    `LocalLoginResult = { ok: boolean; reason?: 'invalid' | 'locked'; lockedUntilMs?: number; mustChangePassword?: boolean; username?: string }`.
  - `changePassword(currentPassword: string, newPassword: string): Promise<void>` (rejeita com `Error('Senha atual incorreta')` se a senha atual não bater).
  Usado pela Task 7 (`AuthController`).

- [ ] **Step 1: Adicionar `bcryptjs`**

Em `backend/package.json`, `dependencies`:

```json
    "bcryptjs": "^2.4.3"
```

E em `devDependencies`:

```json
    "@types/bcryptjs": "^2.4.6"
```

```bash
cd backend
npm install
```

- [ ] **Step 2: Escrever o teste (falhando)**

Crie `backend/src/auth/local-admin-account.service.spec.ts`:

```ts
import * as bcrypt from 'bcryptjs';
import { LocalAdminAccountService } from './local-admin-account.service';

function makeAccount(overrides: Partial<any> = {}) {
  return {
    id: 1,
    username: 'admin',
    passwordHash: bcrypt.hashSync('admin', 4),
    mustChangePassword: true,
    failedAttempts: 0,
    lockedUntil: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('LocalAdminAccountService', () => {
  let prisma: any;
  let service: LocalAdminAccountService;

  beforeEach(() => {
    prisma = { localAdminAccount: { findUnique: jest.fn(), update: jest.fn() } };
    service = new LocalAdminAccountService(prisma);
  });

  it('rejeita usuário diferente do cadastrado', async () => {
    prisma.localAdminAccount.findUnique.mockResolvedValue(makeAccount());
    const result = await service.login('outro', 'admin');
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('aceita login correto e retorna mustChangePassword', async () => {
    prisma.localAdminAccount.findUnique.mockResolvedValue(makeAccount());
    const result = await service.login('admin', 'admin');
    expect(result.ok).toBe(true);
    expect(result.mustChangePassword).toBe(true);
    expect(prisma.localAdminAccount.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { failedAttempts: 0, lockedUntil: null },
    });
  });

  it('bloqueia após a 5ª tentativa errada', async () => {
    prisma.localAdminAccount.findUnique.mockResolvedValue(makeAccount({ failedAttempts: 4 }));
    const result = await service.login('admin', 'senha-errada');
    expect(result.reason).toBe('locked');
    expect(prisma.localAdminAccount.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ failedAttempts: 0, lockedUntil: expect.any(Date) }),
    });
  });

  it('recusa login enquanto a conta estiver bloqueada', async () => {
    prisma.localAdminAccount.findUnique.mockResolvedValue(
      makeAccount({ lockedUntil: new Date(Date.now() + 60_000) }),
    );
    const result = await service.login('admin', 'admin');
    expect(result.reason).toBe('locked');
    expect(prisma.localAdminAccount.update).not.toHaveBeenCalled();
  });

  it('troca de senha exige a senha atual correta', async () => {
    prisma.localAdminAccount.findUnique.mockResolvedValue(makeAccount());
    await expect(service.changePassword('errada', 'nova12345')).rejects.toThrow('Senha atual incorreta');
  });

  it('troca de senha zera mustChangePassword', async () => {
    prisma.localAdminAccount.findUnique.mockResolvedValue(makeAccount());
    await service.changePassword('admin', 'nova12345');
    expect(prisma.localAdminAccount.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { passwordHash: expect.any(String), mustChangePassword: false },
    });
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

```bash
npm test -- local-admin-account
```

Expected: `Cannot find module './local-admin-account.service'`.

- [ ] **Step 4: Implementar o serviço**

Crie `backend/src/auth/local-admin-account.service.ts`:

```ts
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
```

- [ ] **Step 5: Rodar e confirmar que passa**

```bash
npm test -- local-admin-account
```

Expected: `Tests: 6 passed, 6 total`.

- [ ] **Step 6: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/auth/local-admin-account.service.ts backend/src/auth/local-admin-account.service.spec.ts
git commit -m "feat(auth): LocalAdminAccountService com bloqueio por tentativas"
```

---

## Task 4: `SamlConfigService` (cache + CRUD)

**Files:**
- Create: `backend/src/auth/saml-config.service.ts`
- Test: `backend/src/auth/saml-config.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` — `prisma.samlConfig.upsert(...)`.
- Produces: classe `SamlConfigService` com:
  - `getConfig(): Promise<SamlConfigDto>` (cacheado em memória após a 1ª leitura).
  - `updateConfig(input: SamlConfigInput, updatedBy: string): Promise<SamlConfigDto>` (persiste e invalida o cache).
  - `invalidateCache(): void`.
  - `SamlConfigDto = { enabled: boolean; entryPoint: string | null; issuer: string; callbackUrl: string | null; idpCert: string | null; wantAssertionsSigned: boolean; updatedBy: string | null; updatedAt: Date }`.
  - `SamlConfigInput = { enabled: boolean; entryPoint: string | null; issuer: string; callbackUrl: string | null; idpCert: string | null; wantAssertionsSigned: boolean }`.
  Usado pelas Tasks 5 e 7.

- [ ] **Step 1: Escrever o teste (falhando)**

Crie `backend/src/auth/saml-config.service.spec.ts`:

```ts
import { SamlConfigService } from './saml-config.service';

function makeRow(overrides: Partial<any> = {}) {
  return {
    id: 1,
    enabled: false,
    entryPoint: null,
    issuer: 'sentinela-cis',
    callbackUrl: null,
    idpCert: null,
    wantAssertionsSigned: true,
    updatedBy: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('SamlConfigService', () => {
  let prisma: any;
  let service: SamlConfigService;

  beforeEach(() => {
    prisma = { samlConfig: { upsert: jest.fn() } };
    service = new SamlConfigService(prisma);
  });

  it('busca do banco na primeira chamada e cacheia depois', async () => {
    prisma.samlConfig.upsert.mockResolvedValue(makeRow());

    const first = await service.getConfig();
    const second = await service.getConfig();

    expect(first.issuer).toBe('sentinela-cis');
    expect(second).toBe(first);
    expect(prisma.samlConfig.upsert).toHaveBeenCalledTimes(1);
  });

  it('updateConfig persiste e invalida o cache', async () => {
    prisma.samlConfig.upsert.mockResolvedValueOnce(makeRow());
    await service.getConfig();

    prisma.samlConfig.upsert.mockResolvedValueOnce(
      makeRow({ enabled: true, entryPoint: 'https://idp.example.com/sso' }),
    );
    const updated = await service.updateConfig(
      {
        enabled: true,
        entryPoint: 'https://idp.example.com/sso',
        issuer: 'sentinela-cis',
        callbackUrl: null,
        idpCert: null,
        wantAssertionsSigned: true,
      },
      'admin@empresa.com',
    );

    expect(updated.enabled).toBe(true);
    expect(updated.entryPoint).toBe('https://idp.example.com/sso');

    const cached = await service.getConfig();
    expect(cached).toBe(updated);
    expect(prisma.samlConfig.upsert).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
cd backend && npm test -- saml-config.service
```

Expected: `Cannot find module './saml-config.service'`.

- [ ] **Step 3: Implementar o serviço**

Crie `backend/src/auth/saml-config.service.ts`:

```ts
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
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npm test -- saml-config.service
```

Expected: `Tests: 2 passed, 2 total`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/saml-config.service.ts backend/src/auth/saml-config.service.spec.ts
git commit -m "feat(auth): SamlConfigService com cache em memória"
```

---

## Task 5: `RolesGuard`, `@Roles` e `SamlConfigController`

**Files:**
- Create: `backend/src/auth/roles.decorator.ts`
- Create: `backend/src/auth/roles.guard.ts`
- Test: `backend/src/auth/roles.guard.spec.ts`
- Create: `backend/src/auth/saml-config.controller.ts`
- Test: `backend/src/auth/saml-config.controller.spec.ts`

**Interfaces:**
- Consumes: `SamlConfigService` (Task 4), `AuthenticatedGuard` (existente, ajustado na Task 6).
- Produces: decorator `Roles(...roles: string[])`, guard `RolesGuard`, e rotas `GET /api/auth/saml/config` / `PUT /api/auth/saml/config` restritas a `role === 'ADMIN'`.

- [ ] **Step 1: Escrever o teste do guard (falhando)**

Crie `backend/src/auth/roles.guard.spec.ts`:

```ts
import { RolesGuard } from './roles.guard';

function makeContext(role: string | undefined) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
  } as any;
}

describe('RolesGuard', () => {
  it('libera quando a rota não exige papéis', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as any;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext(undefined))).toBe(true);
  });

  it('libera quando o papel do usuário está na lista exigida', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']) } as any;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext('ADMIN'))).toBe(true);
  });

  it('bloqueia quando o papel do usuário não está na lista exigida', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']) } as any;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext('AUDITOR'))).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
cd backend && npm test -- roles.guard
```

Expected: `Cannot find module './roles.guard'`.

- [ ] **Step 3: Implementar decorator e guard**

Crie `backend/src/auth/roles.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

Crie `backend/src/auth/roles.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const role = req.user?.role;
    return required.includes(role);
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npm test -- roles.guard
```

Expected: `Tests: 3 passed, 3 total`.

- [ ] **Step 5: Escrever o teste do controller (falhando)**

Crie `backend/src/auth/saml-config.controller.spec.ts`:

```ts
import { SamlConfigController } from './saml-config.controller';

describe('SamlConfigController', () => {
  it('GET retorna a config do serviço', async () => {
    const svc = { getConfig: jest.fn().mockResolvedValue({ enabled: false }) } as any;
    const controller = new SamlConfigController(svc);
    const result = await controller.get();
    expect(result).toEqual({ enabled: false });
  });

  it('PUT repassa o body e o e-mail do usuário logado', async () => {
    const svc = { updateConfig: jest.fn().mockResolvedValue({ enabled: true }) } as any;
    const controller = new SamlConfigController(svc);
    const body = { enabled: true, entryPoint: null, issuer: 'x', callbackUrl: null, idpCert: null, wantAssertionsSigned: true };
    const req = { user: { email: 'admin@empresa.com' } } as any;

    const result = await controller.update(body, req);

    expect(svc.updateConfig).toHaveBeenCalledWith(body, 'admin@empresa.com');
    expect(result).toEqual({ enabled: true });
  });
});
```

- [ ] **Step 6: Rodar e confirmar que falha**

```bash
npm test -- saml-config.controller
```

Expected: `Cannot find module './saml-config.controller'`.

- [ ] **Step 7: Implementar o controller**

Crie `backend/src/auth/saml-config.controller.ts`:

```ts
import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedGuard } from './authenticated.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { SamlConfigService, SamlConfigInput } from './saml-config.service';

@Controller('auth/saml/config')
@UseGuards(AuthenticatedGuard, RolesGuard)
@Roles('ADMIN')
export class SamlConfigController {
  constructor(private svc: SamlConfigService) {}

  @Get()
  get() {
    return this.svc.getConfig();
  }

  @Put()
  update(@Body() body: SamlConfigInput, @Req() req: Request) {
    return this.svc.updateConfig(body, (req.user as any)?.email || (req.user as any)?.username);
  }
}
```

- [ ] **Step 8: Rodar e confirmar que passa**

```bash
npm test -- saml-config.controller
```

Expected: `Tests: 2 passed, 2 total`.

- [ ] **Step 9: Commit**

```bash
git add backend/src/auth/roles.decorator.ts backend/src/auth/roles.guard.ts backend/src/auth/roles.guard.spec.ts backend/src/auth/saml-config.controller.ts backend/src/auth/saml-config.controller.spec.ts
git commit -m "feat(auth): RolesGuard e tela de configuração SAML restrita a ADMIN"
```

---

## Task 6: `AuthenticatedGuard` — bloquear enquanto `mustChangePassword`

**Files:**
- Modify: `backend/src/auth/authenticated.guard.ts`
- Test: `backend/src/auth/authenticated.guard.spec.ts`

**Interfaces:**
- Produces: `AuthenticatedGuard.canActivate` retorna `false` (403) quando `req.user.mustChangePassword === true`, mesmo com sessão válida. Usado por `RisksController`/`AssessmentsController`/`ControlsController` (não muda a assinatura, só o comportamento).

- [ ] **Step 1: Escrever o teste (falhando)**

Crie `backend/src/auth/authenticated.guard.spec.ts`:

```ts
import { AuthenticatedGuard } from './authenticated.guard';

function makeContext(req: any) {
  return { switchToHttp: () => ({ getRequest: () => req }) } as any;
}

describe('AuthenticatedGuard', () => {
  const guard = new AuthenticatedGuard();
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = originalEnv; });

  it('bloqueia quando mustChangePassword é true, mesmo autenticado', () => {
    const req = { isAuthenticated: () => true, user: { role: 'ADMIN', mustChangePassword: true } };
    expect(guard.canActivate(makeContext(req))).toBe(false);
  });

  it('libera quando autenticado e mustChangePassword é false', () => {
    const req = { isAuthenticated: () => true, user: { role: 'ADMIN', mustChangePassword: false } };
    expect(guard.canActivate(makeContext(req))).toBe(true);
  });

  it('em produção, sem sessão, bloqueia', () => {
    process.env.NODE_ENV = 'production';
    const req = { isAuthenticated: () => false };
    expect(guard.canActivate(makeContext(req))).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
cd backend && npm test -- authenticated.guard
```

Expected: falha no primeiro teste (`mustChangePassword` ainda não é checado).

- [ ] **Step 3: Atualizar o guard**

Edite `backend/src/auth/authenticated.guard.ts` (arquivo completo):

```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

/**
 * Bloqueia rotas sem sessão, e também bloqueia se o usuário local
 * ainda precisa trocar a senha (mustChangePassword). Em desenvolvimento
 * (sem sessão nenhuma) injeta um usuário mock para facilitar o trabalho local.
 */
@Injectable()
export class AuthenticatedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    if (req.isAuthenticated?.()) {
      return !req.user?.mustChangePassword;
    }

    if (process.env.NODE_ENV !== 'production') {
      req.user = { id: 'dev', email: 'dev@local', name: 'Dev', role: 'ADMIN' };
      return true;
    }

    return false;
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npm test -- authenticated.guard
```

Expected: `Tests: 3 passed, 3 total`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/authenticated.guard.ts backend/src/auth/authenticated.guard.spec.ts
git commit -m "fix(auth): bloqueia rotas enquanto senha local não foi trocada"
```

---

## Task 7: `AuthController` dinâmico (SAML + login local) e `AuthModule`

**Files:**
- Modify: `backend/package.json` (adiciona `@node-saml/node-saml`, remove `@node-saml/passport-saml`)
- Modify: `backend/src/auth/auth.controller.ts` (reescrita completa)
- Modify: `backend/src/auth/auth.module.ts` (reescrita completa)
- Delete: `backend/src/auth/saml.strategy.ts`
- Test: `backend/src/auth/auth.controller.spec.ts`

**Interfaces:**
- Consumes: `SamlConfigService.getConfig()` (Task 4), `LocalAdminAccountService.login/changePassword` (Task 3), `PrismaService.user.upsert` (existente).
- Produces: rotas `GET /api/auth/login`, `POST /api/auth/saml/callback`, `POST /api/auth/local/login`, `POST /api/auth/local/change-password`, `GET /api/auth/me`, `POST /api/auth/logout`.

- [ ] **Step 1: Remover a dependência antiga e adicionar a nova**

Em `backend/package.json`, remova a linha `"@node-saml/passport-saml": "^5.0.0",` de `dependencies` e adicione:

```json
    "@node-saml/node-saml": "^4.0.5",
```

```bash
cd backend
npm install
```

- [ ] **Step 2: Escrever o teste do controller (falhando)**

Crie `backend/src/auth/auth.controller.spec.ts`:

```ts
jest.mock('@node-saml/node-saml', () => ({
  SAML: jest.fn().mockImplementation(() => ({
    getAuthorizeUrlAsync: jest.fn().mockResolvedValue('https://idp.example.com/sso?SAMLRequest=xyz'),
    validatePostResponseAsync: jest.fn().mockResolvedValue({
      profile: { email: 'ana@empresa.com', displayName: 'Ana', role: 'admin' },
    }),
  })),
}));

import { AuthController } from './auth.controller';

function makeRes() {
  return { redirect: jest.fn(), json: jest.fn(), status: jest.fn().mockReturnThis(), clearCookie: jest.fn() };
}

describe('AuthController', () => {
  let prisma: any;
  let samlConfig: any;
  let localAdmin: any;
  let controller: AuthController;

  beforeEach(() => {
    prisma = { user: { upsert: jest.fn().mockResolvedValue({ id: 'u1', email: 'ana@empresa.com', name: 'Ana', role: 'ADMIN' }) } };
    samlConfig = { getConfig: jest.fn() };
    localAdmin = { login: jest.fn(), changePassword: jest.fn() };
    controller = new AuthController(prisma, samlConfig, localAdmin);
  });

  it('login redireciona para /login?error=saml_indisponivel quando desabilitado', async () => {
    samlConfig.getConfig.mockResolvedValue({ enabled: false, entryPoint: null, idpCert: null });
    const res = makeRes();
    await controller.login(res as any);
    expect(res.redirect).toHaveBeenCalledWith('/login?error=saml_indisponivel');
  });

  it('login redireciona para a URL do IdP quando habilitado', async () => {
    samlConfig.getConfig.mockResolvedValue({
      enabled: true, entryPoint: 'https://idp.example.com/sso', issuer: 'sentinela-cis',
      callbackUrl: 'https://app/api/auth/saml/callback', idpCert: 'CERT', wantAssertionsSigned: true,
    });
    const res = makeRes();
    await controller.login(res as any);
    expect(res.redirect).toHaveBeenCalledWith('https://idp.example.com/sso?SAMLRequest=xyz');
  });

  it('callback faz upsert do usuário com o role vindo do claim', async () => {
    samlConfig.getConfig.mockResolvedValue({
      enabled: true, entryPoint: 'https://idp.example.com/sso', issuer: 'sentinela-cis',
      callbackUrl: 'https://app/api/auth/saml/callback', idpCert: 'CERT', wantAssertionsSigned: true,
    });
    const res = makeRes();
    const req: any = { body: {}, login: jest.fn((_user, cb) => cb(null)) };

    await controller.callback(req, res as any);

    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { email: 'ana@empresa.com' },
      update: { name: 'Ana', samlNameId: undefined },
      create: { email: 'ana@empresa.com', name: 'Ana', samlNameId: undefined, role: 'ADMIN' },
    });
    expect(req.login).toHaveBeenCalled();
  });

  it('localLogin retorna 423 quando a conta está bloqueada', async () => {
    localAdmin.login.mockResolvedValue({ ok: false, reason: 'locked', lockedUntilMs: Date.now() + 60_000 });
    const res = makeRes();
    const req: any = {};

    await controller.localLogin({ username: 'admin', password: 'x' }, req, res as any);

    expect(res.status).toHaveBeenCalledWith(423);
  });

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

  it('changePassword delega ao LocalAdminAccountService', async () => {
    const req: any = { user: { mustChangePassword: true } };
    await controller.changePassword({ currentPassword: 'admin', newPassword: 'nova12345' }, req);
    expect(localAdmin.changePassword).toHaveBeenCalledWith('admin', 'nova12345');
    expect(req.user.mustChangePassword).toBe(false);
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

```bash
cd backend && npm test -- auth.controller
```

Expected: falha de compilação — `AuthController` ainda tem a assinatura antiga (sem construtor com `PrismaService`/`SamlConfigService`/`LocalAdminAccountService`, sem os métodos `login`/`callback`/`localLogin`/`changePassword`).

- [ ] **Step 4: Deletar a estratégia SAML estática**

```bash
rm backend/src/auth/saml.strategy.ts
```

- [ ] **Step 5: Reescrever o `AuthController`**

Substitua todo o conteúdo de `backend/src/auth/auth.controller.ts`:

```ts
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SAML } from '@node-saml/node-saml';
import { PrismaService } from '../prisma/prisma.service';
import { SamlConfigService, SamlConfigDto } from './saml-config.service';
import { LocalAdminAccountService } from './local-admin-account.service';

@Controller('auth')
export class AuthController {
  constructor(
    private prisma: PrismaService,
    private samlConfig: SamlConfigService,
    private localAdmin: LocalAdminAccountService,
  ) {}

  // Inicia o SSO -> redireciona ao IdP. Config lida do banco a cada chamada
  // (via SamlConfigService, cacheada), então uma mudança salva na tela de
  // admin já vale na próxima tentativa de login, sem reiniciar o backend.
  @Get('login')
  async login(@Res() res: Response) {
    const config = await this.samlConfig.getConfig();
    if (!config.enabled || !config.entryPoint || !config.idpCert) {
      return res.redirect('/login?error=saml_indisponivel');
    }

    const saml = this.buildSaml(config);
    const url = await saml.getAuthorizeUrlAsync('', undefined, {});
    return res.redirect(url);
  }

  // ACS: IdP faz POST aqui após autenticar
  @Post('saml/callback')
  async callback(@Req() req: Request, @Res() res: Response) {
    const config = await this.samlConfig.getConfig();
    if (!config.enabled || !config.entryPoint || !config.idpCert) {
      return res.redirect('/login?error=saml_indisponivel');
    }

    const saml = this.buildSaml(config);
    const { profile } = await saml.validatePostResponseAsync(req.body as Record<string, string>);
    const user = await this.upsertSamlUser(profile);

    req.login(user, (err) => {
      if (err) return res.redirect('/login?error=saml_falha');
      res.redirect(process.env.APP_BASE_URL || '/');
    });
  }

  @Post('local/login')
  @HttpCode(HttpStatus.OK)
  async localLogin(
    @Body() body: { username: string; password: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.localAdmin.login(body.username, body.password);
    if (!result.ok) {
      const status = result.reason === 'locked' ? HttpStatus.LOCKED : HttpStatus.UNAUTHORIZED;
      return res.status(status).json(result);
    }

    const user = {
      id: 'local-admin',
      username: result.username,
      role: 'ADMIN',
      mustChangePassword: result.mustChangePassword,
      local: true,
    };
    req.login(user, (err) => {
      if (err) return res.status(500).json({ ok: false });
      res.json({ ok: true, mustChangePassword: result.mustChangePassword });
    });
  }

  @Post('local/change-password')
  async changePassword(
    @Body() body: { currentPassword: string; newPassword: string },
    @Req() req: Request,
  ) {
    await this.localAdmin.changePassword(body.currentPassword, body.newPassword);
    if (req.user) (req.user as any).mustChangePassword = false;
    return { ok: true };
  }

  @Get('me')
  me(@Req() req: Request) {
    if (req.isAuthenticated?.()) return req.user;
    if (process.env.NODE_ENV !== 'production') {
      return { id: 'dev', email: 'dev@local', name: 'Dev', role: 'ADMIN', dev: true };
    }
    return { authenticated: false };
  }

  @Post('logout')
  logout(@Req() req: Request, @Res() res: Response) {
    req.logout?.(() => {
      req.session?.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ ok: true });
      });
    });
  }

  private buildSaml(config: SamlConfigDto) {
    return new SAML({
      entryPoint: config.entryPoint!,
      issuer: config.issuer,
      callbackUrl: config.callbackUrl || undefined,
      idpCert: config.idpCert!,
      wantAssertionsSigned: config.wantAssertionsSigned,
      identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    } as any);
  }

  private async upsertSamlUser(profile: any) {
    const email =
      (profile.email as string) ||
      (profile.nameID as string) ||
      (profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] as string);

    if (!email) throw new Error('SAML sem e-mail/NameID');

    const name =
      (profile.displayName as string) ||
      (profile.name as string) ||
      (profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] as string) ||
      email;

    const roleClaim = (profile.role as string)?.toUpperCase();
    const role = ['ADMIN', 'AUDITOR', 'LEITOR'].includes(roleClaim) ? roleClaim : 'AUDITOR';

    const user = await this.prisma.user.upsert({
      where: { email },
      update: { name, samlNameId: profile.nameID as string },
      create: { email, name, samlNameId: profile.nameID as string, role: role as any },
    });

    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }
}
```

- [ ] **Step 6: Reescrever o `AuthModule`**

Substitua todo o conteúdo de `backend/src/auth/auth.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { SamlConfigController } from './saml-config.controller';
import { SessionSerializer } from './session.serializer';
import { AuthenticatedGuard } from './authenticated.guard';
import { RolesGuard } from './roles.guard';
import { SamlConfigService } from './saml-config.service';
import { LocalAdminAccountService } from './local-admin-account.service';

@Module({
  imports: [PassportModule.register({ session: true })],
  controllers: [AuthController, SamlConfigController],
  providers: [SessionSerializer, AuthenticatedGuard, RolesGuard, SamlConfigService, LocalAdminAccountService],
  exports: [AuthenticatedGuard, RolesGuard],
})
export class AuthModule {}
```

- [ ] **Step 7: Rodar e confirmar que passa**

```bash
cd backend && npm test
```

Expected: todas as suítes passando (sanity, local-admin-account, saml-config.service, roles.guard, saml-config.controller, authenticated.guard, auth.controller).

- [ ] **Step 8: Build para garantir que o TypeScript compila**

```bash
npm run build
```

Expected: sem erros do `tsc`/Nest CLI.

- [ ] **Step 9: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/auth
git commit -m "feat(auth): SAML dinâmico via node-saml + login local no AuthController"
```

---

## Task 8: Seed — `SamlConfig` a partir do `.env` + conta `admin`/`admin`

**Files:**
- Modify: `backend/prisma/seed.ts`

**Interfaces:**
- Consumes: `bcryptjs` (Task 3), models `SamlConfig`/`LocalAdminAccount` (Task 1).

- [ ] **Step 1: Editar o seed**

Em `backend/prisma/seed.ts`, adicione o import no topo (depois dos imports existentes):

```ts
import * as bcrypt from 'bcryptjs';
```

E adicione ao final da função `main()`, antes da linha `const total = await prisma.safeguard.count();`:

```ts
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

  const existingAdmin = await prisma.localAdminAccount.findUnique({ where: { id: 1 } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('admin', 12);
    await prisma.localAdminAccount.create({
      data: { id: 1, username: 'admin', passwordHash, mustChangePassword: true },
    });
    console.log('Conta local de emergência criada: admin / admin (troca de senha obrigatória no 1º login).');
  }

```

- [ ] **Step 2: Rodar o seed e verificar**

```bash
cd backend
npm run seed
```

Expected: log final incluindo `Seed concluído: ...` e (na primeira execução) `Conta local de emergência criada: admin / admin ...`.

Confirme com uma query rápida:

```bash
npx prisma studio
```

Abra as tabelas `SamlConfig` (1 linha, `id=1`) e `LocalAdminAccount` (1 linha, `username=admin`, `mustChangePassword=true`). Feche o Prisma Studio depois (Ctrl+C no terminal).

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat(seed): popula SamlConfig a partir do .env e cria conta admin local"
```

---

## Task 9: Atualizar `docs/SAML.md`

**Files:**
- Modify: `docs/SAML.md`

- [ ] **Step 1: Reescrever a introdução do documento**

Substitua as linhas 1-3 de `docs/SAML.md`:

```markdown
# SSO SAML 2.0

A aplicação é o **Service Provider (SP)**. A partir desta versão, a configuração do
SAML é feita pela tela **Configuração do SSO** (`/admin/saml`, visível só para
usuários com papel `ADMIN`) — não é mais necessário editar `.env` nem reiniciar o
backend para aplicar mudanças. As variáveis `SAML_*` abaixo continuam existindo
apenas como *seed* inicial (usadas uma única vez, na primeira execução do
`npm run seed`, para popular a configuração no banco).

Se o SSO estiver fora do ar, há uma conta local de emergência: usuário `admin`,
senha `admin` na primeira instalação — a aplicação exige a troca dessa senha no
primeiro login. Acesse pelo link "Problemas com o SSO? Entrar com conta local" na
tela de login.
```

- [ ] **Step 2: Commit**

```bash
git add docs/SAML.md
git commit -m "docs: atualiza SAML.md para configuração via web"
```

---

## Task 10: Frontend — `api/client.ts` (novos endpoints, sem redirect automático)

**Files:**
- Modify: `frontend/src/api/client.ts`

**Interfaces:**
- Produces: `api.localLogin(username, password)`, `api.changePassword(currentPassword, newPassword)`, `api.logout()`, `api.getSamlConfig()`, `api.updateSamlConfig(body)`, constante `SAML_LOGIN_URL`. Usado pelas Tasks 12-14.
- Muda comportamento: erros HTTP (incluindo 401) agora **lançam** uma exceção com `.status` em vez de redirecionar a página automaticamente para `/auth/login` — a Task 11 (`ProtectedRoute`) é quem decide para onde navegar.

- [ ] **Step 1: Substituir o arquivo**

Substitua todo o conteúdo de `frontend/src/api/client.ts`:

```ts
const BASE = import.meta.env.VITE_API_URL || '/api';

export const SAML_LOGIN_URL = BASE + '/auth/login';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(`API ${res.status}`), { status: res.status, body });
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  me: () => req<any>('/auth/me'),
  localLogin: (username: string, password: string) =>
    req<any>('/auth/local/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    req<any>('/auth/local/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  logout: () => req<any>('/auth/logout', { method: 'POST' }),
  getSamlConfig: () => req<any>('/auth/saml/config'),
  updateSamlConfig: (b: any) => req<any>('/auth/saml/config', { method: 'PUT', body: JSON.stringify(b) }),
  controls: () => req<any[]>('/controls'),
  control: (n: number) => req<any>(`/controls/${n}`),
  assessments: () => req<any[]>('/assessments'),
  createAssessment: (b: any) => req<any>('/assessments', { method: 'POST', body: JSON.stringify(b) }),
  assessment: (id: string) => req<any>(`/assessments/${id}`),
  summary: (id: string) => req<any>(`/assessments/${id}/summary`),
  setItem: (id: string, sg: string, b: any) =>
    req<any>(`/assessments/${id}/items/${sg}`, { method: 'PUT', body: JSON.stringify(b) }),
  risks: () => req<any[]>('/risks'),
  createRisk: (b: any) => req<any>('/risks', { method: 'POST', body: JSON.stringify(b) }),
  updateRisk: (id: string, b: any) => req<any>(`/risks/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  deleteRisk: (id: string) => req<void>(`/risks/${id}`, { method: 'DELETE' }),
};
```

- [ ] **Step 2: Verificação manual**

```bash
cd frontend
npm install
npm run dev
```

Com o backend rodando (`cd backend && npm run start:dev` em outro terminal) e **sem** estar logado, abra `http://localhost:5173`, abra o DevTools (F12) → Console, e rode:

```js
fetch('/api/auth/me', { credentials: 'include' }).then(r => r.status)
```

Expected: `401` (ou o status que seu backend retornar quando não autenticado) — e a página **não** deve navegar/recarregar sozinha (esse é o comportamento antigo que estamos removendo).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/client.ts
git commit -m "feat(frontend): novos endpoints de auth local/SAML e remove redirect automático em 401"
```

---

## Task 11: `ProtectedRoute` e roteamento em `App.tsx`

**Files:**
- Create: `frontend/src/components/ProtectedRoute.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `api.me()` (Task 10).
- Produces: componente `ProtectedRoute` que envolve as páginas existentes; rotas `/login` e `/trocar-senha` passam a existir (implementadas nas Tasks 12-13) e `/admin/saml` (Task 14).

- [ ] **Step 1: Criar o `ProtectedRoute`**

Crie `frontend/src/components/ProtectedRoute.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api/client';

type Status = 'loading' | 'authenticated' | 'change-password' | 'unauthenticated';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    api
      .me()
      .then((user) => {
        if (!user || user.authenticated === false) return setStatus('unauthenticated');
        if (user.mustChangePassword) return setStatus('change-password');
        setStatus('authenticated');
      })
      .catch(() => setStatus('unauthenticated'));
  }, []);

  if (status === 'loading') return null;
  if (status === 'unauthenticated') return <Navigate to="/login" replace />;
  if (status === 'change-password') return <Navigate to="/trocar-senha" replace />;
  return <>{children}</>;
}
```

- [ ] **Step 2: Atualizar `App.tsx`**

Substitua todo o conteúdo de `frontend/src/App.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Auditoria } from './pages/Auditoria';
import { Riscos } from './pages/Riscos';
import { Login } from './pages/Login';
import { ChangePassword } from './pages/ChangePassword';
import { AdminSaml } from './pages/AdminSaml';
import { ProtectedRoute } from './components/ProtectedRoute';
import { api } from './api/client';

export default function App() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    api
      .me()
      .then((u) => setRole(u?.role || null))
      .catch(() => setRole(null));
  }, []);

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" opacity=".5" />
              <circle cx="12" cy="12" r="4.6" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            </svg>
          </div>
          <div>
            <div className="brand-name">Sentinela CIS</div>
            <div className="brand-sub">Controls v8.1.2</div>
          </div>
        </div>
        <div className="nav">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/auditoria">Auditoria</NavLink>
          <NavLink to="/riscos">Riscos</NavLink>
          {role === 'ADMIN' && <NavLink to="/admin/saml">Config. SAML</NavLink>}
        </div>
      </nav>
      <main className="main">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/trocar-senha" element={<ChangePassword />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/auditoria" element={<ProtectedRoute><Auditoria /></ProtectedRoute>} />
          <Route path="/riscos" element={<ProtectedRoute><Riscos /></ProtectedRoute>} />
          <Route path="/admin/saml" element={<ProtectedRoute><AdminSaml /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
}
```

Isso referencia `./pages/Login`, `./pages/ChangePassword` e `./pages/AdminSaml`, criados nas próximas três tasks — o build só vai compilar depois delas. Prossiga direto para a Task 12 antes de tentar rodar `npm run dev`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ProtectedRoute.tsx frontend/src/App.tsx
git commit -m "feat(frontend): ProtectedRoute e novas rotas de autenticação"
```

---

## Task 12: Página `Login`

**Files:**
- Create: `frontend/src/pages/Login.tsx`
- Modify: `frontend/src/styles/tokens.css` (novas classes)

**Interfaces:**
- Consumes: `api.localLogin`, `SAML_LOGIN_URL` (Task 10).

- [ ] **Step 1: Adicionar estilos**

Ao final de `frontend/src/styles/tokens.css`, adicione:

```css
.login-page{min-height:100vh;display:grid;place-items:center;background:var(--surface-2)}
.login-card{width:100%;max-width:380px;display:flex;flex-direction:column;gap:14px;text-align:center}
.local-login-form{display:flex;flex-direction:column;gap:10px;text-align:left}
.local-login-form label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--ink-2)}
.local-login-form input,.local-login-form textarea{border:1px solid var(--border-2);border-radius:8px;padding:8px 10px;font-size:13px;font-family:var(--font-sans)}
.link-btn{background:none;border:none;color:var(--ink-3);text-decoration:underline;font-size:12px;cursor:pointer;padding:0}
.error{color:var(--crit);font-size:12px;margin:0}
```

- [ ] **Step 2: Criar a página**

Crie `frontend/src/pages/Login.tsx`:

```tsx
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, SAML_LOGIN_URL } from '../api/client';

export function Login() {
  const [showLocal, setShowLocal] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function submitLocal(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await api.localLogin(username, password);
      navigate(result.mustChangePassword ? '/trocar-senha' : '/dashboard');
    } catch (err: any) {
      if (err.status === 423) setError('Conta bloqueada temporariamente por tentativas incorretas.');
      else setError('Usuário ou senha inválidos.');
    }
  }

  return (
    <div className="login-page">
      <div className="card login-card">
        <h1 className="page-title">Sentinela CIS</h1>
        <a className="btn" href={SAML_LOGIN_URL}>Entrar com SSO corporativo</a>

        {!showLocal && (
          <button className="link-btn" onClick={() => setShowLocal(true)}>
            Problemas com o SSO? Entrar com conta local
          </button>
        )}

        {showLocal && (
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
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificação manual**

Com backend e frontend rodando (`npm run start:dev` no backend, `npm run dev` no frontend), abra `http://localhost:5173/login`:
1. Confirme que aparece o botão "Entrar com SSO corporativo" e o link "Problemas com o SSO? Entrar com conta local".
2. Clique no link — o formulário usuário/senha deve aparecer.
3. Digite `admin` / `admin` e envie. Expected: navega para `/trocar-senha` (porque `mustChangePassword` está `true` no seed).
4. Volte para `/login`, tente `admin` / `senha-errada` 5 vezes seguidas. Na 5ª, a resposta deve indicar bloqueio e a mensagem "Conta bloqueada temporariamente..." deve aparecer.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Login.tsx frontend/src/styles/tokens.css
git commit -m "feat(frontend): tela de login (SSO + fallback local)"
```

---

## Task 13: Página `ChangePassword`

**Files:**
- Create: `frontend/src/pages/ChangePassword.tsx`

**Interfaces:**
- Consumes: `api.changePassword` (Task 10).

- [ ] **Step 1: Criar a página**

Crie `frontend/src/pages/ChangePassword.tsx`:

```tsx
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) return setError('A nova senha precisa ter ao menos 8 caracteres.');
    if (newPassword !== confirm) return setError('As senhas não coincidem.');
    try {
      await api.changePassword(currentPassword, newPassword);
      navigate('/dashboard');
    } catch {
      setError('Senha atual incorreta.');
    }
  }

  return (
    <div className="login-page">
      <form onSubmit={submit} className="card login-card local-login-form">
        <h1 className="page-title">Troca de senha obrigatória</h1>
        <p className="page-sub">
          Este é o primeiro acesso com a conta local. Defina uma nova senha para continuar.
        </p>
        <label>
          Senha atual
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoFocus />
        </label>
        <label>
          Nova senha
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </label>
        <label>
          Confirmar nova senha
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn" type="submit">Salvar e continuar</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verificação manual**

Continuando do fluxo da Task 12 (logado como `admin`/`admin`, redirecionado para `/trocar-senha`):
1. Digite a senha atual errada → Expected: "Senha atual incorreta.".
2. Digite a senha atual correta (`admin`) e uma nova senha de 8+ caracteres, confirme igual → Expected: navega para `/dashboard` e o Dashboard carrega normalmente (prova que `AuthenticatedGuard` parou de bloquear).
3. Faça logout (chame `api.logout()` pelo console ou implemente um botão, se preferir) e faça login de novo em `/login` com a nova senha → Expected: vai direto para `/dashboard`, sem passar por `/trocar-senha`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ChangePassword.tsx
git commit -m "feat(frontend): tela de troca de senha obrigatória"
```

---

## Task 14: Página `AdminSaml`

**Files:**
- Create: `frontend/src/pages/AdminSaml.tsx`

**Interfaces:**
- Consumes: `api.getSamlConfig`, `api.updateSamlConfig` (Task 10).

- [ ] **Step 1: Criar a página**

Crie `frontend/src/pages/AdminSaml.tsx`:

```tsx
import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api/client';

export function AdminSaml() {
  const [config, setConfig] = useState<any>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getSamlConfig().then(setConfig);
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaved(false);
    const updated = await api.updateSamlConfig(config);
    setConfig(updated);
    setSaved(true);
  }

  if (!config) return null;

  return (
    <>
      <h1 className="page-title">Configuração do SSO (SAML)</h1>
      <p className="page-sub">Alterações aqui têm efeito imediato, sem precisar reiniciar a aplicação.</p>
      <form onSubmit={save} className="card local-login-form" style={{ maxWidth: 640 }}>
        <label>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
          />{' '}
          Habilitado
        </label>
        <label>
          Entry Point (URL de login do IdP)
          <input value={config.entryPoint || ''} onChange={(e) => setConfig({ ...config, entryPoint: e.target.value })} />
        </label>
        <label>
          Issuer / Entity ID
          <input value={config.issuer || ''} onChange={(e) => setConfig({ ...config, issuer: e.target.value })} />
        </label>
        <label>
          Callback URL (ACS)
          <input value={config.callbackUrl || ''} onChange={(e) => setConfig({ ...config, callbackUrl: e.target.value })} />
        </label>
        <label>
          Certificado do IdP (X.509)
          <textarea rows={6} value={config.idpCert || ''} onChange={(e) => setConfig({ ...config, idpCert: e.target.value })} />
        </label>
        <label>
          <input
            type="checkbox"
            checked={config.wantAssertionsSigned}
            onChange={(e) => setConfig({ ...config, wantAssertionsSigned: e.target.checked })}
          />{' '}
          Exigir asserções assinadas
        </label>
        <button className="btn" type="submit">Salvar</button>
        {saved && <p>Configuração salva.</p>}
      </form>
    </>
  );
}
```

- [ ] **Step 2: Verificação manual**

Logado como `admin` (após trocar a senha, Task 13):
1. Confirme que o link "Config. SAML" aparece na barra lateral (porque `role === 'ADMIN'`).
2. Abra `/admin/saml`, preencha `Entry Point` com uma URL de teste (ex.: `https://idp.example.com/sso`) e `Habilitado`, salve.
3. Sem reiniciar o backend, abra uma aba anônima e acesse `http://localhost:5173/login`, clique em "Entrar com SSO corporativo" → Expected: o navegador é redirecionado para a URL de teste que você acabou de salvar (prova que a config dinâmica funciona sem restart).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/AdminSaml.tsx
git commit -m "feat(frontend): tela de configuração do SAML (ADMIN)"
```

---

## Task 15: Verificação de ponta a ponta no WSL (Docker Compose)

**Files:** nenhum (só verificação).

- [ ] **Step 1: Subir o WSL e navegar até o projeto**

No Windows, rode (fora do WSL):

```powershell
wsl -d Ubuntu
```

Dentro do WSL, se o repositório ainda não estiver acessível lá, clone-o (o repositório já está em `C:\Users\LN-SDJIWOE1\projetos\cis-risk_monitor` no Windows; pelo WSL isso é `/mnt/c/Users/LN-SDJIWOE1/projetos/cis-risk_monitor`):

```bash
cd /mnt/c/Users/LN-SDJIWOE1/projetos/cis-risk_monitor
```

- [ ] **Step 2: Configurar `.env` e subir os containers**

```bash
cp .env.example .env   # se ainda não existir; ajuste POSTGRES_*, SESSION_SECRET, APP_BASE_URL
docker compose up -d --build
docker compose exec api npx prisma migrate deploy
docker compose exec api npm run seed
```

Expected: `docker compose ps` mostra `postgres`, `api` e `web` com status `running`/`healthy`.

- [ ] **Step 3: Validar o fluxo completo pelo navegador**

Acesse `http://localhost:8080`:
1. Deve redirecionar para `/login`.
2. Entre com a conta local `admin`/`admin` → deve forçar `/trocar-senha`.
3. Troque a senha → deve cair no `/dashboard`.
4. Acesse `/admin/saml`, configure um IdP de teste (ou os dados reais, se já tiver um) e salve.
5. Sem rodar `docker compose restart api`, tente o login SSO e confirme que usa a config recém-salva.

- [ ] **Step 4: Reportar o link**

Depois de validado, o endereço para o usuário acessar é `http://localhost:8080` (rodando no WSL, mas exposto na mesma rede do Windows via `localhost` — comportamento padrão do WSL2).
