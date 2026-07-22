# Contas locais multiusuário + Configurações de Segurança + MFA TOTP

Data: 2026-07-22

## Contexto

Hoje a autenticação local (`docs/superpowers/specs/2026-07-21-saml-local-auth-design.md`)
é deliberadamente uma **conta única de emergência** (`LocalAdminAccount`, singleton
`id=1`, usuário `admin`) — só existe para nunca depender exclusivamente do SAML. A tela
`Configurações > Usuários` (`frontend/src/pages/Usuarios.tsx`), construída na sessão
anterior, só lista quem já autenticou via SSO (`User`), somente leitura, e inclui uma
coluna "Primeiro login".

O usuário agora quer:

1. Remover a coluna "Primeiro login" da tela de Usuários.
2. Na mesma tela, também listar **usuários locais** (não só quem veio do SSO).
3. Poder **criar usuários locais** por essa tela.
4. Um novo tipo de configuração em Configurações: **"Segurança"**, com política de senha
   e uma flag de **MFA obrigatório** para contas locais.
5. Implementar **MFA TOTP** para quem autentica localmente.

Isso exige evoluir `LocalAdminAccount` de singleton para uma tabela real de múltiplas
contas.

## Fora de escopo (decidido explicitamente)

- MFA **não** se aplica a contas SAML — apenas a contas locais (o próprio pedido do
  usuário restringe a "contas locais"; MFA de usuários SSO é responsabilidade do IdP).
- Política de senha cobre só **tamanho mínimo + exigência de maiúscula/número/símbolo**.
  Sem expiração periódica nem histórico de senhas usadas (reduziria bastante a
  complexidade sem ter sido pedido).
- Sem edição/exclusão de contas locais nesta rodada — só listar e criar (edição de
  papel, reset de senha por admin, exclusão ficam como possível próxima iteração).
- Auto-serviço de desabilitar o próprio MFA fica de fora — só o admin pode resetar o
  MFA de uma conta (rota de recuperação em caso de perda do dispositivo).

## Modelo de dados (Prisma)

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

`LocalAdminAccount` é **renomeada** para `LocalAccount` (não recriada) — a migration
preserva a linha existente (`admin`), define seu `role` explicitamente como `ADMIN`, e
converte o `id` de inteiro fixo para texto (a partir daí, novas contas usam `cuid()`).
`mfaBackupCodes` guarda hashes bcrypt dos 10 códigos de recuperação, nunca o valor em
claro (mesmo tratamento que `passwordHash`).

## Backend

### `LocalAccountsService` (substitui `LocalAdminAccountService`)

- `login(username, password)`: busca por `username` (não mais por `id` fixo); mesma
  lógica de bloqueio (5 tentativas → 15 min) hoje em `LocalAdminAccountService`. Se a
  senha for válida:
  - se `mfaEnabled`: retorna `{ ok: true, mfaRequired: true, accountId }` **sem** logar a
    sessão ainda.
  - senão: retorna `{ ok: true, mustChangePassword, mfaEnrollRequired: securitySettings.mfaRequired, username, role, accountId }`.
- `verifyMfaLogin(accountId, token)`: valida TOTP (`otplib`) ou um código de backup
  (compara hash, consome-o se usado); reaproveita o mesmo contador de tentativas/bloqueio
  do `login`.
- `changePassword(accountId, currentPassword, newPassword)`: valida a política de senha
  corrente (via `SecuritySettingsService`) antes de trocar; agora recebe `accountId`
  (antes era fixo em `1`).
- `create({ username, name, role, password })` (ADMIN): valida política de senha, cria
  com `mustChangePassword: true`, `mfaEnabled: false`.
- `list()`: `{ id, username, name, role, mustChangePassword, mfaEnabled, lockedUntil, createdAt }` — nunca `passwordHash`/`mfaSecret`/`mfaBackupCodes`.
- `startMfaEnrollment(accountId)`: gera segredo TOTP novo (`otplib.authenticator.generateSecret()`),
  guarda em `mfaSecret` (ainda com `mfaEnabled=false`), retorna `otpauth://` URI + QR
  (data URL via `qrcode`).
- `confirmMfaEnrollment(accountId, token)`: verifica o token contra o `mfaSecret`
  pendente; se válido, gera 10 códigos de backup, guarda os hashes, marca
  `mfaEnabled=true`, retorna os códigos em claro **uma única vez**.
- `resetMfa(accountId)` (ADMIN): zera `mfaEnabled`/`mfaSecret`/`mfaBackupCodes` (rota de
  recuperação).

### `SecuritySettingsService`

Mesmo padrão de cache do `SamlConfigService`: `getConfig()` / `updateConfig(data, updatedBy)`.

### `AuthController`

O objeto de sessão de uma conta local deixa de usar o `id` fixo `'local-admin'` — passa
a ser `{ id: account.id, username, role, mustChangePassword, mfaEnrollRequired, local: true }`,
usando o `id` real (`cuid`) do `LocalAccount`. Todas as referências abaixo a
"`req.user.id`" usam esse campo — não é introduzido nenhum campo `accountId` separado
no objeto de sessão.

- `POST /auth/local/login`: usa `LocalAccountsService.login`; se `mfaRequired` na
  resposta, guarda `req.session.pendingMfaAccountId = account.id` e responde
  `{ mfaRequired: true }` (sessão **não** autenticada ainda). Senão, `req.login(user)`
  como hoje, incluindo `mfaEnrollRequired` no objeto de usuário quando aplicável.
- `POST /auth/local/mfa/login-verify` `{ token }` (novo): exige
  `req.session.pendingMfaAccountId`; chama `verifyMfaLogin`; em sucesso, `req.login(user)`
  e limpa `pendingMfaAccountId`.
- `POST /auth/local/mfa/enroll` (novo, autenticado, conta local): chama
  `startMfaEnrollment(req.user.id)`.
- `POST /auth/local/mfa/enroll/verify` `{ token }` (novo, autenticado): chama
  `confirmMfaEnrollment`; em sucesso, zera `mfaEnrollRequired` na sessão.
- `POST /auth/local/change-password`: passa a repassar `req.user.id` para o serviço
  (hoje é implícito `id=1`).

**Precedência quando as duas pendências coexistem** (conta nova criada com
`mfaRequired` já ligado globalmente: `mustChangePassword=true` e `mfaEnrollRequired=true`
ao mesmo tempo): troca de senha vem **primeiro**. `AuthenticatedGuard` e `ProtectedRoute`
checam `mustChangePassword` antes de `mfaEnrollRequired` — só depois de trocar a senha o
usuário é redirecionado para `/mfa/configurar`. Isso evita vincular o segredo TOTP a uma
senha provisória definida pelo admin na criação da conta.

### `AuthenticatedGuard`

Passa a bloquear (retornar `false`) também quando `req.user?.mfaEnrollRequired` for
verdadeiro, **depois** de checar `mustChangePassword` (que continua bloqueando primeiro,
ver precedência acima): `return !req.user?.mustChangePassword && !req.user?.mfaEnrollRequired`.
Os endpoints de enrollment de MFA ficam fora do guard (checagem manual de
`req.isAuthenticated()`), igual ao padrão já usado em `change-password`.

### Novos controllers (ADMIN-only, mesmo padrão de `UsersController`/`SamlConfigController`)

- `LocalAccountsController`: `GET /local-accounts`, `POST /local-accounts`,
  `POST /local-accounts/:id/reset-mfa`.
- `SecurityController`: `GET /security-settings`, `PUT /security-settings`.

### Nova dependência

- `otplib` (geração/verificação TOTP) e `qrcode` (renderizar `otpauth://` como PNG data
  URL) — adicionadas a `backend/package.json`.

## Frontend

### `Usuarios.tsx` (reescrita)

- Remove a coluna "Primeiro login" da tabela de usuários SSO.
- Adiciona uma segunda seção "Usuários locais": tabela com usuário, nome, papel, status
  de MFA (Habilitado / Pendente / Desabilitado), bloqueado até (se aplicável).
- Botão "+ Novo usuário local" abre um formulário (usuário, nome, papel, senha inicial)
  → `POST /local-accounts`. Reaproveita o padrão de modal já usado em `RiskForm.tsx`.

### `Configuracoes.tsx`

Novo card "Segurança" → `/configuracoes/seguranca`.

### `Seguranca.tsx` (nova página)

Formulário: tamanho mínimo de senha (number input), 3 checkboxes (maiúscula / número /
símbolo), toggle "MFA obrigatório para contas locais". Salva via
`PUT /security-settings`.

### `MfaEnroll.tsx` (nova página, `/mfa/configurar`)

- Ao montar, chama `POST /auth/local/mfa/enroll`, mostra QR (`<img src={dataUrl}>`) +
  segredo em texto (fallback manual) + campo para digitar o código de 6 dígitos.
- Ao confirmar (`POST /auth/local/mfa/enroll/verify`), mostra os 10 códigos de backup
  uma única vez, com aviso para guardar em local seguro, e um botão "Concluir" que segue
  para `/dashboard`.
- Acessível tanto por redirecionamento forçado (`mfaEnrollRequired`) quanto
  voluntariamente (ação "Configurar MFA" na lista de usuários locais, para a própria
  conta).

### `ProtectedRoute.tsx`

Novo estado `mfa-enroll` (quando `GET /auth/me` retorna `mfaEnrollRequired: true`) →
redireciona para `/mfa/configurar`, mesmo padrão do estado `change-password` existente.
A checagem de `mustChangePassword` continua vindo antes: se os dois vierem verdadeiros
na mesma resposta, o estado resultante é `change-password`, não `mfa-enroll` (mesma
precedência do backend).

### `Login.tsx`

Após `POST /auth/local/login` responder `{ mfaRequired: true }`, mostra um segundo passo
inline (campo de 6 dígitos + link "usar código de backup") que chama
`POST /auth/local/mfa/login-verify`.

## Segurança

- `mfaSecret` fica em texto simples na coluna (mesmo nível de proteção que
  `passwordHash` hoje — acesso de banco já é uma fronteira de confiança nesta aplicação).
- Códigos de backup: só o hash bcrypt é persistido; o valor em claro é devolvido uma
  única vez, na resposta de `confirmMfaEnrollment`.
- Política de senha validada no backend (não só no frontend) em toda troca/criação de
  senha de conta local.
- Mesmo contador de `failedAttempts`/`lockedUntil` cobre falhas de senha **e** de TOTP —
  não há bypass de força bruta trocando de fator.

## Migração / rollout

- Migration Prisma (escrita à mão, não gerada por `prisma migrate dev` puro, para não
  perder a linha existente): `ALTER TABLE "LocalAdminAccount" RENAME TO "LocalAccount"`,
  conversão do `id` para `TEXT`, novas colunas (`name`, `role` default `AUDITOR`,
  `mfaEnabled`, `mfaSecret`, `mfaBackupCodes`, `createdAt`), e
  `UPDATE "LocalAccount" SET role = 'ADMIN' WHERE username = 'admin'` para a conta
  existente. Nova tabela `SecuritySettings`.
- `backend/prisma/seed.ts`: troca `prisma.localAdminAccount` por `prisma.localAccount`
  (mesma lógica de bootstrap do `admin`/`admin`), e adiciona
  `prisma.securitySettings.upsert` com os defaults.
- `CLAUDE.md`: atualizar a seção de reset manual de senha do `admin` (hoje referencia
  `LocalAdminAccount` e `id=1` — passa a ser `LocalAccount` e buscar por `username='admin'`).

## Testes

- Unitários (backend): `LocalAccountsService` (login com/sem MFA, bloqueio, política de
  senha, enrollment/verify de TOTP, consumo de código de backup, reset de MFA),
  `SecuritySettingsService` (cache/invalidação, mesmo padrão do `SamlConfigService`),
  controllers (`LocalAccountsController`, `SecurityController`, novos endpoints de
  `AuthController`) com Prisma mockado — mesmo padrão usado em todo o resto do backend.
- Manual (roteiro no plano de implementação): criar usuário local pela tela, logar com
  ele (troca de senha obrigatória), habilitar "MFA obrigatório" em Segurança, deslogar e
  logar de novo → deve forçar `/mfa/configurar`; confirmar QR com um autenticador TOTP
  real (ex. app de terceiros) ou biblioteca de teste, guardar códigos de backup, deslogar
  e logar de novo → deve pedir o código TOTP; testar login com um código de backup
  também. Resetar MFA pela tela de Usuários e confirmar que a conta volta a pedir
  enrollment.
