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

## Dados do SP para cadastrar no IdP

| Campo | Valor |
|---|---|
| Entity ID / Issuer | `SAML_ISSUER` (ex.: `sentinela-cis`) |
| ACS URL (Reply URL) | `{APP_BASE_URL}/api/auth/saml/callback` |
| NameID | `emailAddress` (recomendado) |
| Binding | HTTP-POST |

## Atributos (claims) esperados
- `email` (ou o NameID no formato e-mail) — **obrigatório**
- `displayName` / `name` — opcional
- `role` — opcional; mapeado para `ADMIN` / `AUDITOR` / `LEITOR` (default `AUDITOR`)

## Do IdP para o `.env`
- `SAML_ENTRY_POINT` — URL de login SAML do IdP
- `SAML_IDP_CERT` — certificado de assinatura X.509 do IdP (conteúdo base64 em uma linha, sem `-----BEGIN/END-----`)

## Exemplos por IdP
- **Azure AD / Entra ID:** Enterprise Applications → New (Non-gallery) → Single sign-on → SAML. Identifier = `SAML_ISSUER`; Reply URL = ACS. Baixe o "Certificate (Base64)".
- **ADFS:** Relying Party Trust com o Entity ID e a ACS URL; exporte o Token-Signing Certificate.
- **Keycloak:** Client SAML com Client ID = `SAML_ISSUER`, Valid Redirect URIs = ACS; use o certificado do realm.

## Atualizando um banco já provisionado (upgrade)

Esta versão introduziu a primeira migration Prisma do projeto
(`20260721180209_saml_config_local_admin`). Em um banco **novo/vazio**,
`npx prisma migrate deploy` funciona normalmente. Mas se o banco já tinha sido
provisionado antes por outro meio (ex.: `npx prisma db push`, única opção
antes desta versão), rodar `migrate deploy` falha com o erro P3005
("database schema is not empty"), pois a migration tenta criar tabelas que já
existem. Nesse caso, rode uma única vez, antes do `migrate deploy`:

```
npx prisma migrate resolve --applied 20260721180209_saml_config_local_admin
```

Isso marca a migration como já aplicada (baseline), sem tentar recriar nada.

## Fluxo
1. Rota protegida sem sessão → `GET /api/auth/login` → redireciona ao `SAML_ENTRY_POINT`.
2. IdP autentica e faz `POST` na ACS (`/api/auth/saml/callback`).
3. A API valida a asserção com `SAML_IDP_CERT`, cria/atualiza o `User` e grava a sessão.
4. `GET /api/auth/me` retorna o usuário logado; `POST /api/auth/logout` encerra a sessão.

> Em desenvolvimento, use o **Keycloak** em Docker como IdP de teste, ou um mock SAML.
