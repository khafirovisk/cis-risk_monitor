# SAML configurável via web + autenticação local de emergência

Data: 2026-07-21

## Contexto

Hoje a autenticação SAML do Sentinela CIS é configurada inteiramente por variáveis de
ambiente (`SAML_ENTRY_POINT`, `SAML_ISSUER`, `SAML_CALLBACK_URL`, `SAML_IDP_CERT`), lidas
uma única vez na inicialização do backend (`backend/src/auth/auth.module.ts`). Alterar a
configuração exige editar o `.env` e reiniciar o processo. Não existe nenhuma forma de
autenticação local: se o SAML/IdP tiver problema, ninguém consegue entrar no sistema
(fora o bypass de desenvolvimento, que só funciona com `NODE_ENV !== 'production'`).

O frontend também não tem tela de login nem proteção de rotas — todas as páginas são
acessíveis diretamente pela SPA.

## Objetivo

1. Permitir configurar o SAML (Entry Point, Issuer, Callback URL, certificado do IdP,
   habilitado/desabilitado) por uma tela web, com efeito imediato (sem reiniciar o
   backend).
2. Fornecer uma conta local de emergência (`admin` / `admin`) para nunca depender
   exclusivamente do SAML, com troca de senha obrigatória no primeiro uso.

## Fora de escopo (decidido explicitamente)

- **Não** mexer no enum `Role` (`ADMIN` / `AUDITOR` / `LEITOR`) nem criar um modelo de
  permissões "admin / read-only" — o usuário esclareceu que não conhecia os papéis já
  existentes e que isso não é necessário.
- **Não** criar gestão completa de múltiplas contas locais — apenas a conta única de
  emergência `admin`.

## Modelo de dados (Prisma)

```prisma
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
  id             Int       @id @default(1)
  username       String    @unique @default("admin")
  passwordHash   String
  mustChangePassword Boolean @default(true)
  failedAttempts Int       @default(0)
  lockedUntil    DateTime?
  updatedAt      DateTime  @updatedAt
}
```

Ambas as tabelas são **singleton** (uma única linha, `id` fixo), sem relação com `User`.
`User` e `Role` permanecem exatamente como estão hoje.

## Backend

### SAML dinâmico (sem restart)

- Remove o registro estático do `SamlStrategy` do Passport
  (`auth.module.ts` hoje só registra a estratégia se `SAML_ENTRY_POINT` existir no
  `.env` na inicialização).
- Novo `SamlConfigService`:
  - `getConfig()`: retorna a config atual, com cache em memória.
  - `updateConfig(data, updatedBy)`: valida, persiste no banco e invalida o cache.
- O SAML deixa de usar o wrapper `@node-saml/passport-saml` (que fixa as opções na
  construção da estratégia) e passa a usar a classe `SAML` do `@node-saml/node-saml`
  diretamente, instanciada a cada request com a config corrente:
  - `GET /api/auth/login`: carrega a config; se `enabled=false` ou faltar
    `entryPoint`/`idpCert`, redireciona para `/login?error=saml_indisponivel`; caso
    contrário monta `new SAML(config)` e redireciona ao `getAuthorizeUrlAsync()`.
  - `POST /api/auth/saml/callback`: mesma config, `validatePostResponseAsync(req.body)`,
    upsert do `User` (lógica igual à atual), depois `req.login(user, cb)` manual para
    abrir a sessão (o suporte a sessão do Passport — `serializeUser`/`deserializeUser` —
    continua sendo usado; só a estratégia SAML deixa de ser uma `PassportStrategy`
    estática).

### Login local (fallback)

- `POST /api/auth/local/login` `{ username, password }`:
  - Bloqueia se `lockedUntil` no futuro (retorna 423 com tempo restante).
  - Compara hash com bcrypt; se errar, incrementa `failedAttempts`; ao atingir 5,
    define `lockedUntil = now + 15min` e zera o contador.
  - Se acertar, zera `failedAttempts`/`lockedUntil`, abre sessão com
    `{ id: 'local-admin', username, role: 'ADMIN', mustChangePassword, local: true }`.
- `AuthenticatedGuard` passa a checar `mustChangePassword`: se verdadeiro, todas as
  rotas exceto `/api/auth/local/change-password` e `/api/auth/me` retornam 403.
- `POST /api/auth/local/change-password` `{ currentPassword, newPassword }`: valida a
  senha atual, gera novo hash (bcrypt custo 12), zera `mustChangePassword`.

### Configuração SAML pela API (só ADMIN)

- Novo `RolesGuard` + decorator `@Roles(...roles)` (não existe hoje no projeto).
- `GET /api/auth/saml/config` e `PUT /api/auth/saml/config`, protegidas por
  `@UseGuards(AuthenticatedGuard, RolesGuard)` + `@Roles('ADMIN')`. Como a sessão local
  sempre carrega `role: 'ADMIN'`, a conta de emergência também acessa essa tela.
- `PUT` chama `SamlConfigService.updateConfig(...)` — o cache é invalidado e a próxima
  tentativa de login SAML já usa os novos valores, sem reiniciar nada.

## Frontend

- **`/login`** (nova página): botão "Entrar com SSO corporativo" em destaque
  (`GET /api/auth/login`) + link discreto "Problemas com o SSO? Entrar com conta
  local", que revela um formulário usuário/senha (`POST /api/auth/local/login`).
- **`/trocar-senha`** (nova página): exibida obrigatoriamente quando
  `GET /api/auth/me` retorna `mustChangePassword: true`; qualquer outra rota redireciona
  para cá enquanto isso for verdade.
- **`/admin/saml`** (nova página, só no menu e só acessível se `role === 'ADMIN'`):
  formulário com Entry Point, Issuer, Callback URL, certificado do IdP (textarea) e
  toggle Habilitado/Desabilitado. Salva via `PUT /api/auth/saml/config`.
- **`ProtectedRoute`** (novo, `App.tsx` hoje não tem nenhuma proteção de rota): consulta
  `GET /api/auth/me` uma vez; se não autenticado, redireciona para `/login`.

## Segurança

- Senha local com bcrypt, custo 12; nunca retornada em nenhuma resposta de API.
- Rate limiting simples embutido na própria tabela `LocalAdminAccount`
  (`failedAttempts` / `lockedUntil`), sem depender de infraestrutura nova (Redis etc.).
- O certificado do IdP não é segredo (é o certificado público de assinatura do IdP),
  mas a tela de configuração continua restrita a `ADMIN`.

## Migração / rollout

- Migration Prisma cria `SamlConfig` e `LocalAdminAccount`.
- Seed (`backend/prisma/seed.ts`):
  - Popula `SamlConfig` a partir de `SAML_ENTRY_POINT` / `SAML_ISSUER` /
    `SAML_CALLBACK_URL` / `SAML_IDP_CERT` do `.env`, se existirem (`enabled: true` nesse
    caso), para não quebrar quem já usa SAML hoje.
  - Cria `LocalAdminAccount` com usuário `admin`, senha `admin` (hasheada) e
    `mustChangePassword: true`.
- `docs/SAML.md` é atualizado: a configuração passa a ser feita pela tela `/admin/saml`;
  as variáveis de ambiente `SAML_*` ficam documentadas apenas como seed inicial opcional.

## Testes

- Unitários (backend): `SamlConfigService` (cache e invalidação), fluxo de
  `LocalAdminAccount` (hash, troca de senha obrigatória, bloqueio por tentativas
  falhas e expiração do bloqueio).
- Manual (roteiro no PR/plano de implementação): login local `admin`/`admin` → forçado a
  trocar senha → configurar SAML pela tela → login via SSO validando que não precisou
  reiniciar o backend.
