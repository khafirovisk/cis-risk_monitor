# SSO SAML 2.0

A aplicação é o **Service Provider (SP)**. Cadastre-a no seu IdP e preencha o bloco `SAML_*` no `.env`.

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

## Fluxo
1. Rota protegida sem sessão → `GET /api/auth/login` → redireciona ao `SAML_ENTRY_POINT`.
2. IdP autentica e faz `POST` na ACS (`/api/auth/saml/callback`).
3. A API valida a asserção com `SAML_IDP_CERT`, cria/atualiza o `User` e grava a sessão.
4. `GET /api/auth/me` retorna o usuário logado; `POST /api/auth/logout` encerra a sessão.

> Em desenvolvimento, use o **Keycloak** em Docker como IdP de teste, ou um mock SAML.
